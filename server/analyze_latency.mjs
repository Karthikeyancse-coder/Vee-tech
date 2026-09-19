import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const { data: articles, error } = await supabase
  .from('articles')
  .select('id, title, api_source, source_name, published_at, ingested_at')
  .order('ingested_at', { ascending: false })
  .limit(160);

if (error) {
  console.error('Error fetching articles:', error);
  process.exit(1);
}

console.log('Total articles fetched:', articles.length);

function isPushSource(apiSource) {
  const s = (apiSource || '').toLowerCase();
  return s.includes('bluesky') || s.includes('jetstream') || s.includes('firehose');
}

const pushArticles = [];
const polledArticles = [];

for (const a of articles) {
  const isPush = isPushSource(a.api_source);
  const pub = new Date(a.published_at).getTime();
  const ing = new Date(a.ingested_at).getTime();
  const diffSec = Math.round((ing - pub) / 1000);

  const item = { ...a, diffSec };
  if (isPush) {
    pushArticles.push(item);
  } else {
    polledArticles.push(item);
  }
}

function calculateStats(items, name) {
  const valid = items
    .map(i => i.diffSec)
    .filter(s => !isNaN(s) && s >= 0); // exclude negative anomalies if any

  valid.sort((a, b) => a - b);

  if (valid.length === 0) {
    return { name, count: items.length, validCount: 0, avgSec: null, p95Sec: null, minSec: null, maxSec: null };
  }

  const sum = valid.reduce((a, b) => a + b, 0);
  const avgSec = Math.round(sum / valid.length);

  // NIST / Standard Linear Interpolation Percentile (P95)
  let p95Sec;
  const n = valid.length;
  if (n === 1) {
    p95Sec = valid[0];
  } else {
    const rank = (n - 1) * 0.95;
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    const weight = rank - low;
    p95Sec = Math.round(valid[low] + weight * (valid[high] - valid[low]));
  }

  return {
    name,
    totalCount: items.length,
    validCount: valid.length,
    avgSec,
    avgFormatted: formatSec(avgSec),
    p95Sec,
    p95Formatted: formatSec(p95Sec),
    minSec: valid[0],
    minFormatted: formatSec(valid[0]),
    maxSec: valid[valid.length - 1],
    maxFormatted: formatSec(valid[valid.length - 1]),
    medianSec: valid[Math.floor(valid.length / 2)],
    medianFormatted: formatSec(valid[Math.floor(valid.length / 2)])
  };
}

function formatSec(s) {
  if (s == null) return 'N/A';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (s < 86400) return `${h}h ${m}m`;
  const d = Math.floor(s / 86400);
  return `${d}d ${h % 24}h`;
}

console.log('\n================== PUSH (Bluesky) STATS ==================');
console.log(JSON.stringify(calculateStats(pushArticles, 'Push (Bluesky Jetstream)'), null, 2));

console.log('\n================= POLLED (All Others) STATS =================');
console.log(JSON.stringify(calculateStats(polledArticles, 'Polled Sources'), null, 2));

console.log('\n================= POLLED BREAKDOWN BY SOURCE =================');
const bySource = {};
for (const a of polledArticles) {
  const src = a.api_source || a.source_name || 'Unknown';
  if (!bySource[src]) bySource[src] = [];
  if (a.diffSec >= 0) bySource[src].push(a.diffSec);
}
for (const [src, lats] of Object.entries(bySource)) {
  lats.sort((a, b) => a - b);
  const sum = lats.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / lats.length);
  const p95 = lats[Math.floor(lats.length * 0.95)] || lats[lats.length - 1];
  console.log(`${src} (count: ${lats.length}) -> Avg: ${formatSec(avg)} | P95: ${formatSec(p95)} | Min: ${formatSec(lats[0])}`);
}

process.exit(0);
