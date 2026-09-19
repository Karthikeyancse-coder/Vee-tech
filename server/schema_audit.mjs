/**
 * Schema introspection script — finds which columns in `articles` are NOT NULL
 * and which ones the fast-path insert does NOT provide a value for.
 */
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

// Pull one article to see all column names + values
const { data: sample, error: sampleErr } = await supabase
  .from('articles')
  .select('*')
  .order('ingested_at', { ascending: false })
  .limit(1)
  .single();

if (sampleErr) {
  console.error('Could not fetch sample:', sampleErr);
  process.exit(1);
}

console.log('=== ALL COLUMNS IN articles TABLE (from live row) ===\n');
const colNames = Object.keys(sample);
for (const col of colNames) {
  const val = sample[col];
  const valStr = val === null ? 'NULL' : (typeof val === 'string' ? `"${val.slice(0,60)}"` : JSON.stringify(val)?.slice(0,80));
  console.log(`  ${col.padEnd(25)} = ${valStr}`);
}

// The fast-path insert provides these fields:
const fastPathFields = new Set([
  'id', 'api_source', 'source_name', 'title', 'url', 'image_url',
  'raw_content', 'entity_mentioned', 'sentiment', 'risk_score', 'risk_level',
  'five_bullet_summary', 'status', 'published_at', 'ingested_at', 'theme'
]);

console.log('\n=== COLUMNS NOT IN FAST-PATH INSERT (could be NOT NULL violations) ===\n');
for (const col of colNames) {
  if (!fastPathFields.has(col)) {
    const val = sample[col];
    console.log(`  ${col.padEnd(25)} = ${val === null ? 'NULL (could be NOT NULL problem)' : JSON.stringify(val)?.slice(0,60)}`);
  }
}

process.exit(0);
