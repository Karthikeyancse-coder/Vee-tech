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
  console.error(error);
  process.exit(1);
}

const now = Date.now();
const CUTOFF_HOURS = 12;
const cutoffMs = CUTOFF_HOURS * 3600 * 1000;

const fresh = [];
const stale = [];

for (const a of articles) {
  const pubTime = new Date(a.published_at).getTime();
  const ageHours = (now - pubTime) / (3600 * 1000);

  if (ageHours <= CUTOFF_HOURS) {
    fresh.push({ ...a, ageHours: Number(ageHours.toFixed(1)) });
  } else {
    stale.push({ ...a, ageHours: Number(ageHours.toFixed(1)) });
  }
}

console.log(`Total articles in DB: ${articles.length}`);
console.log(`Fresh articles (<= 12 hours): ${fresh.length}`);
console.log(`Stale articles (> 12 hours to purge): ${stale.length}`);

console.log('\n--- SAMPLE OF STALE ARTICLES TO BE PURGED (> 12 HOURS) ---');
stale.sort((a, b) => b.ageHours - a.ageHours);
for (const s of stale.slice(0, 10)) {
  console.log(`• [${s.ageHours}h old | ${s.published_at}] "${s.title.slice(0, 60)}..."`);
  console.log(`  ${s.source_name} (${s.api_source}) | ID: ${s.id}`);
}

console.log('\n--- SAMPLE OF FRESH ARTICLES TO BE KEPT (<= 12 HOURS) ---');
fresh.sort((a, b) => a.ageHours - b.ageHours);
for (const f of fresh.slice(0, 5)) {
  console.log(`• [${f.ageHours}h old | ${f.published_at}] "${f.title.slice(0, 60)}..."`);
}

process.exit(0);
