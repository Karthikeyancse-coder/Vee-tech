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
  .select('id, title, source_name, api_source, published_at, ingested_at')
  .order('published_at', { ascending: false });

if (error) {
  console.error('Fetch error:', error);
  process.exit(1);
}

const now = Date.now();

const windows = [
  { name: 'Within 24 hours (≤ 24h)', min: 0, max: 24, count: 0 },
  { name: '24 to 48 hours', min: 24, max: 48, count: 0 },
  { name: '48 to 72 hours', min: 48, max: 72, count: 0 },
  { name: '3 to 7 days', min: 72, max: 168, count: 0 },
  { name: '7 to 30 days', min: 168, max: 720, count: 0 },
  { name: '> 30 days (months/years old)', min: 720, max: Infinity, count: 0 }
];

const stale72h = [];
const stale48h = [];

for (const a of articles) {
  const pubTime = new Date(a.published_at).getTime();
  const ageHours = (now - pubTime) / (3600 * 1000);
  const ageDays = (ageHours / 24).toFixed(1);

  for (const w of windows) {
    if (ageHours >= w.min && ageHours < w.max) {
      w.count++;
    }
  }

  const item = {
    id: a.id,
    title: a.title,
    source: a.source_name,
    api_source: a.api_source,
    published_at: a.published_at,
    ageDays: Number(ageDays)
  };

  if (ageHours > 48) stale48h.push(item);
  if (ageHours > 72) stale72h.push(item);
}

console.log('Total articles in DB:', articles.length);
console.log('\n================ PUBLICATION AGE BREAKDOWN ================');
for (const w of windows) {
  console.log(`${w.name.padEnd(30)}: ${w.count} articles`);
}

console.log(`\nTotal articles older than 48 hours: ${stale48h.length}`);
console.log(`Total articles older than 72 hours: ${stale72h.length}`);

console.log('\n================ TOP 15 OLDEST ARTICLES IN DB ================');
stale72h.sort((a, b) => b.ageDays - a.ageDays);
for (const s of stale72h.slice(0, 15)) {
  console.log(`• [${s.ageDays}d old | ${s.published_at.slice(0, 10)}] "${s.title.slice(0, 60)}..."`);
  console.log(`  Source: ${s.source} (${s.api_source}) | ID: ${s.id}`);
}

process.exit(0);
