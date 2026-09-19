/**
 * Dedup Audit Script — Priority 5
 * Pulls 20 most recent DUPLICATE-status articles from Supabase and shows
 * both the duplicate article and the article it was matched against.
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

// Fetch last 20 articles marked as DUPLICATE
const { data: dupes, error } = await supabase
  .from('articles')
  .select('id, title, url, source_name, api_source, theme, ingested_at')
  .eq('status', 'DUPLICATE')
  .order('ingested_at', { ascending: false })
  .limit(20);

if (error) {
  console.error('Query error:', error);
  process.exit(1);
}

if (!dupes || dupes.length === 0) {
  console.log('No DUPLICATE-status articles found in the last query window.');
  process.exit(0);
}

console.log(`\n=== DEDUP AUDIT: ${dupes.length} most recent DUPLICATE articles ===\n`);

let falsePositiveCount = 0;

for (let i = 0; i < dupes.length; i++) {
  const d = dupes[i];
  console.log(`[${i + 1}/${dupes.length}] DROPPED DUPLICATE`);
  console.log(`  Title:      "${d.title?.slice(0, 100)}"`);
  console.log(`  URL:        ${d.url}`);
  console.log(`  Source:     ${d.source_name} via ${d.api_source}`);
  console.log(`  Theme:      ${d.theme}`);
  console.log(`  Ingested:   ${d.ingested_at}`);

  // Try to find the "original" article this was a duplicate of
  // The theme field contains "DUPLICATE [LayerX]: of <id|url>" 
  // Parse the original reference from the theme
  const ofMatch = d.theme?.match(/of (.+)$/);
  const originalRef = ofMatch ? ofMatch[1].trim() : null;

  if (originalRef && originalRef !== 'prior') {
    // Try by ID first (UUID format)
    const isUuid = /^[0-9a-f-]{36}$/.test(originalRef);
    let origData = null;

    if (isUuid) {
      const { data } = await supabase
        .from('articles')
        .select('id, title, url, source_name, api_source, ingested_at')
        .eq('id', originalRef)
        .single();
      origData = data;
    } else {
      // Try by URL (canonical form: domain/path)
      const { data } = await supabase
        .from('articles')
        .select('id, title, url, source_name, api_source, ingested_at')
        .ilike('url', `%${originalRef.split('/').slice(-2).join('/')}%`)
        .order('ingested_at', { ascending: false })
        .limit(1)
        .single();
      origData = data;
    }

    if (origData) {
      console.log(`  ORIGINAL:`);
      console.log(`    Title:    "${origData.title?.slice(0, 100)}"`);
      console.log(`    URL:      ${origData.url}`);
      console.log(`    Source:   ${origData.source_name} via ${origData.api_source}`);
      console.log(`    Ingested: ${origData.ingested_at}`);

      // Simple same-story check: if titles share >50% words it's the same story
      const t1 = (d.title || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const t2 = (origData.title || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const set1 = new Set(t1);
      const set2 = new Set(t2);
      const intersection = [...set1].filter(w => set2.has(w)).length;
      const union = new Set([...t1, ...t2]).size;
      const similarity = union > 0 ? (intersection / union) : 0;

      const verdict = similarity > 0.4 ? '✅ GENUINE DUPLICATE' : (d.url === origData.url ? '✅ SAME URL' : '⚠️ POSSIBLE FALSE POSITIVE — review manually');
      console.log(`  VERDICT:  ${verdict} (title similarity: ${(similarity * 100).toFixed(0)}%)`);
      if (!verdict.startsWith('✅')) falsePositiveCount++;
    } else {
      console.log(`  ORIGINAL: Could not locate original in DB (ref: ${originalRef.slice(0, 60)})`);
    }
  } else {
    console.log(`  ORIGINAL: Reference in theme: "${d.theme}" — no parseable ID`);
  }

  console.log('');
}

console.log(`=== SUMMARY ===`);
console.log(`Total duplicates audited: ${dupes.length}`);
console.log(`Confirmed genuine: ${dupes.length - falsePositiveCount}`);
console.log(`Possible false positives: ${falsePositiveCount}`);
