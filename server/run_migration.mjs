/**
 * Run the triaged_at / dispatched_at nullable migration against Supabase
 * using the management API (service role key required).
 *
 * Supabase does not expose DDL via the JS client directly, so we use
 * the Postgres REST extension endpoint if available, or via rpc().
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

console.log('Running migration: make triaged_at and dispatched_at nullable...\n');

// Run via rpc to postgres function if available, otherwise via direct SQL
// Supabase exposes pg_catalog via RPC using the sql() helper on service role
// Use the direct REST SQL execution endpoint for management operations
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const sql = `
ALTER TABLE articles ALTER COLUMN triaged_at DROP NOT NULL;
ALTER TABLE articles ALTER COLUMN dispatched_at DROP NOT NULL;
`;

// Try via Supabase RPC sql execution (requires pg_net or exec_sql function)
try {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.log('RPC exec_sql not available:', error.message);
    console.log('\n⚠️  Please run this SQL manually in Supabase Dashboard → SQL Editor:\n');
    console.log('ALTER TABLE articles ALTER COLUMN triaged_at DROP NOT NULL;');
    console.log('ALTER TABLE articles ALTER COLUMN dispatched_at DROP NOT NULL;');
  } else {
    console.log('✅ Migration applied via RPC:', data);
  }
} catch (e) {
  console.log('RPC not available:', e.message);
}

// Verify current nullability by trying to insert a test record with null triaged_at
console.log('\nVerifying: inserting a test row with null triaged_at...');
const testId = 'test-schema-audit-' + Date.now();
const { error: insertErr } = await supabase
  .from('articles')
  .insert({
    id: testId,
    api_source: 'schema-audit-test',
    source_name: 'Schema Audit',
    title: 'Schema audit test — delete me',
    url: 'https://schema-test.internal/' + testId,
    raw_content: 'test',
    entity_mentioned: 'Infosys',
    sentiment: 'Neutral',
    risk_score: 50,
    risk_level: 'Medium',
    five_bullet_summary: ['test'],
    status: 'RECEIVED',
    published_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    theme: 'Test',
    triaged_at: null,
    dispatched_at: null
  });

if (insertErr) {
  console.log('❌ Insert test FAILED (migration not applied yet):', insertErr.message);
  console.log('\n▶ ACTION REQUIRED: Run this SQL in Supabase Dashboard → SQL Editor:');
  console.log('  ALTER TABLE articles ALTER COLUMN triaged_at DROP NOT NULL;');
  console.log('  ALTER TABLE articles ALTER COLUMN dispatched_at DROP NOT NULL;');
} else {
  console.log('✅ Insert with null triaged_at SUCCEEDED — migration is applied!');
  // Clean up test row
  await supabase.from('articles').delete().eq('id', testId);
  console.log('✅ Test row cleaned up.');
}

process.exit(0);
