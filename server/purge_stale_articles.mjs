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

export async function getStaleArticles(cutoffHours = 12) {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, source_name, api_source, published_at, ingested_at')
    .order('published_at', { ascending: false });

  if (error) throw error;

  const now = Date.now();
  const cutoffMs = cutoffHours * 3600 * 1000;

  const fresh = [];
  const stale = [];

  for (const a of articles) {
    const pubTime = new Date(a.published_at).getTime();
    const ageHours = (now - pubTime) / (3600 * 1000);
    if (!isNaN(pubTime) && ageHours > cutoffHours) {
      stale.push({ ...a, ageHours: Number(ageHours.toFixed(1)) });
    } else {
      fresh.push({ ...a, ageHours: Number(ageHours.toFixed(1)) });
    }
  }

  return { total: articles.length, fresh, stale };
}

export async function executeStalePurge(cutoffHours = 12) {
  const { total, fresh, stale } = await getStaleArticles(cutoffHours);

  if (stale.length === 0) {
    console.log(`✅ No stale articles older than ${cutoffHours}h found.`);
    return { purgedCount: 0, remainingCount: total };
  }

  const staleIds = stale.map(s => s.id);
  console.log(`🗑 Purging ${staleIds.length} stale articles older than ${cutoffHours} hours...`);

  // Batch delete in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < staleIds.length; i += BATCH_SIZE) {
    const batch = staleIds.slice(i, i + BATCH_SIZE);

    // 1. Delete dependent alert_logs
    await supabase.from('alert_logs').delete().in('article_id', batch);

    // 2. Delete stale articles
    const { error } = await supabase.from('articles').delete().in('id', batch);
    if (error) {
      throw new Error(`Batch delete error at ${i}: ${error.message}`);
    }
  }

  console.log(`✅ Successfully purged ${staleIds.length} stale articles.`);
  console.log(`📊 DB Articles count is now: ${fresh.length}`);

  return { purgedCount: staleIds.length, remainingCount: fresh.length };
}

if (process.argv.includes('--execute')) {
  executeStalePurge(12)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Purge error:', err);
      process.exit(1);
    });
}
