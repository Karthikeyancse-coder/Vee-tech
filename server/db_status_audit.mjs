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

// Check all statuses in the DB
const { data: statusCounts, error: e1 } = await supabase
  .from('articles')
  .select('status')
  .limit(2000);

if (e1) { console.error('Error:', e1); process.exit(1); }

const counts = {};
for (const r of statusCounts) {
  counts[r.status || 'NULL'] = (counts[r.status || 'NULL'] || 0) + 1;
}
console.log('Article status distribution in DB:');
for (const [status, count] of Object.entries(counts)) {
  console.log(`  ${status}: ${count}`);
}
console.log(`  TOTAL: ${statusCounts.length}`);

// Check if any articles are truly stuck (received > 15 min ago, not ACTIVE)
const { data: stuck } = await supabase
  .from('articles')
  .select('id, title, status, ingested_at, api_source')
  .neq('status', 'ACTIVE')
  .order('ingested_at', { ascending: false })
  .limit(10);

console.log('\nRecent non-ACTIVE articles (should be empty or contain only very recent RECEIVED):');
if (!stuck || stuck.length === 0) {
  console.log('  None — all articles are ACTIVE. Pipeline is clean.');
} else {
  for (const a of stuck) {
    const ageSec = Math.round((Date.now() - new Date(a.ingested_at).getTime()) / 1000);
    console.log(`  [${a.status}] ID:${a.id.slice(0,8)} age:${ageSec}s | "${a.title?.slice(0,60)}" via ${a.api_source}`);
  }
}

process.exit(0);
