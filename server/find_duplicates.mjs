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

// Fetch all articles
const { data: articles, error } = await supabase
  .from('articles')
  .select('id, title, url, source_name, api_source, ingested_at, published_at')
  .order('ingested_at', { ascending: true });

if (error) {
  console.error('Error fetching articles:', error);
  process.exit(1);
}

console.log('Total articles currently in DB:', articles.length);

// Group by canonical URL or normalized title
const byUrl = new Map();
const byTitle = new Map();

for (const a of articles) {
  // Normalize URL (strip protocol, trailing slash, query params for matching)
  const normUrl = (a.url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .split('?')[0];

  const normTitle = (a.title || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');

  // Use normUrl if meaningful, else normTitle
  const groupKey = normUrl && normUrl.length > 10 ? `URL:${normUrl}` : `TITLE:${normTitle}`;

  if (!byUrl.has(groupKey)) {
    byUrl.set(groupKey, []);
  }
  byUrl.get(groupKey).push(a);
}

const duplicateGroups = [];
let totalDuplicateRows = 0;

for (const [key, group] of byUrl.entries()) {
  if (group.length > 1) {
    duplicateGroups.push({
      key,
      title: group[0].title,
      source: group[0].source_name,
      count: group.length,
      keepId: group[0].id, // earliest ingested
      keepIngestedAt: group[0].ingested_at,
      deleteIds: group.slice(1).map(g => g.id),
      allRows: group.map(g => ({ id: g.id, ingested_at: g.ingested_at, api_source: g.api_source }))
    });
    totalDuplicateRows += (group.length - 1);
  }
}

console.log('\n=============================================================');
console.log(`🔍 DUPLICATE AUDIT REPORT: Found ${duplicateGroups.length} duplicate groups (${totalDuplicateRows} redundant rows to delete)`);
console.log('=============================================================\n');

duplicateGroups.sort((a, b) => b.count - a.count);

for (const g of duplicateGroups) {
  console.log(`📌 Title: "${g.title}"`);
  console.log(`   Source: ${g.source} | Count: ${g.count} rows`);
  console.log(`   Keep earliest: ${g.keepId} (${g.keepIngestedAt})`);
  console.log(`   Redundant IDs (${g.deleteIds.length}): ${g.deleteIds.join(', ')}`);
  console.log('---');
}

console.log(`\nTotal DB articles: ${articles.length}`);
console.log(`After purging ${totalDuplicateRows} duplicates: ${articles.length - totalDuplicateRows} unique articles will remain.`);
