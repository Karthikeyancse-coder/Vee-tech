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

export async function getDuplicateGroups() {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, url, source_name, api_source, ingested_at')
    .order('ingested_at', { ascending: true });

  if (error) throw error;

  const byKey = new Map();

  for (const a of articles) {
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

    const groupKey = normUrl && normUrl.length > 10 ? `URL:${normUrl}` : `TITLE:${normTitle}`;

    if (!byKey.has(groupKey)) {
      byKey.set(groupKey, []);
    }
    byKey.get(groupKey).push(a);
  }

  const groups = [];
  const allDeleteIds = [];

  for (const [key, group] of byKey.entries()) {
    if (group.length > 1) {
      const keep = group[0]; // earliest ingested
      const remove = group.slice(1);
      const deleteIds = remove.map(r => r.id);
      allDeleteIds.push(...deleteIds);

      groups.push({
        key,
        title: keep.title,
        source: keep.source_name,
        count: group.length,
        keep: { id: keep.id, ingested_at: keep.ingested_at },
        deleteIds,
        redundantRows: remove.map(r => ({ id: r.id, ingested_at: r.ingested_at, api_source: r.api_source }))
      });
    }
  }

  groups.sort((a, b) => b.count - a.count);

  return { totalArticles: articles.length, groups, allDeleteIds };
}

export async function executePurge() {
  const { totalArticles, groups, allDeleteIds } = await getDuplicateGroups();

  if (allDeleteIds.length === 0) {
    console.log('✅ No duplicate rows found to delete.');
    return { purgedCount: 0, remainingCount: totalArticles };
  }

  console.log(`🗑 Purging ${allDeleteIds.length} redundant rows across ${groups.length} duplicate groups...`);

  // 1. Delete dependent alert_logs first
  const { error: alertErr } = await supabase
    .from('alert_logs')
    .delete()
    .in('article_id', allDeleteIds);

  if (alertErr) {
    console.warn('⚠️ Alert logs deletion warning:', alertErr.message);
  } else {
    console.log('✅ Dependent alert_logs cleaned up.');
  }

  // 2. Delete redundant articles
  const { error: articleErr } = await supabase
    .from('articles')
    .delete()
    .in('id', allDeleteIds);

  if (articleErr) {
    throw new Error(`Failed to delete articles: ${articleErr.message}`);
  }

  console.log(`✅ Successfully deleted ${allDeleteIds.length} duplicate rows.`);
  const remainingCount = totalArticles - allDeleteIds.length;
  console.log(`📊 DB Articles count is now: ${remainingCount}`);

  return { purgedCount: allDeleteIds.length, remainingCount };
}

// If run directly with --execute flag
if (process.argv.includes('--execute')) {
  executePurge()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Purge failed:', err);
      process.exit(1);
    });
} else if (process.argv.includes('--dry-run')) {
  getDuplicateGroups()
    .then(({ totalArticles, groups, allDeleteIds }) => {
      console.log(`Total Articles: ${totalArticles}`);
      console.log(`Duplicate Groups: ${groups.length}`);
      console.log(`Redundant rows to delete: ${allDeleteIds.length}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Dry run failed:', err);
      process.exit(1);
    });
}
