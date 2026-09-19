import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

const testId = randomUUID();
console.log('Testing insert with null triaged_at and dispatched_at. Test UUID:', testId);

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
    risk_score: 5.0,
    risk_level: 'Medium',
    five_bullet_summary: ['test'],
    status: 'ACTIVE',
    published_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    theme: 'Test',
    triaged_at: null,
    dispatched_at: null
  });

if (insertErr) {
  console.log('\n❌ Insert FAILED:', insertErr.message);
  console.log('Full error:', insertErr);
  console.log('\n▶ MIGRATION REQUIRED — Run in Supabase Dashboard → SQL Editor:');
  console.log('  ALTER TABLE articles ALTER COLUMN triaged_at DROP NOT NULL;');
  console.log('  ALTER TABLE articles ALTER COLUMN dispatched_at DROP NOT NULL;');
} else {
  console.log('\n✅ Insert with null triaged_at/dispatched_at SUCCEEDED');
  console.log('   Migration is already applied OR columns were already nullable.');
  // Clean up
  await supabase.from('articles').delete().eq('id', testId);
  console.log('✅ Test row deleted.');
}

process.exit(0);
