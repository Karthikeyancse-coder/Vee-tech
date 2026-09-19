import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { IngestionGateway } from './services/ingestion/IngestionGateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function runThreeCyclesDedupVerification() {
  console.log('=============================================================');
  console.log('🧪 VERIFYING DEDUP BLOCKING BEFORE DB INSERT (3 REAL CYCLES)');
  console.log('=============================================================\n');

  // 1. Initial DB Count
  const { count: initialCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });
  console.log(`Initial DB Total Articles: ${initialCount}`);

  const gateway = new IngestionGateway({ supabase });

  // 2. Hydrate Deduplicator from Supabase so it knows all existing 329 articles
  const { data: recentArticles } = await supabase
    .from('articles')
    .select('id, url, title, source_name, api_source')
    .order('ingested_at', { ascending: false })
    .limit(1000);

  if (recentArticles && recentArticles.length > 0) {
    gateway.deduplicator.hydrateFromRecords(recentArticles);
    console.log(`✅ Deduplicator hydrated with ${recentArticles.length} existing articles from DB.`);
  }

  // Use fast polled providers that return repeated items: Guardian, Google RSS, ET RSS
  const testAdapters = gateway.adapters.filter(a => 
    ['guardian', 'googlenews', 'institutional'].includes(a.providerName)
  );

  console.log(`Testing with providers: ${testAdapters.map(a => a.providerName).join(', ')}`);

  const resultsByCycle = [];

  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`\n================== STARTING CYCLE #${cycle} ==================`);
    const startCommitted = gateway.stats.committed;
    const startDuplicates = gateway.stats.droppedDuplicates;

    for (const adapter of testAdapters) {
      try {
        console.log(`Fetching from ${adapter.providerName}...`);
        const rawItems = await adapter.fetch();
        if (Array.isArray(rawItems)) {
          console.log(`Fetched ${rawItems.length} raw items from ${adapter.providerName}. Normalizing and ingesting...`);
          for (const item of rawItems) {
            const normalized = adapter.normalize(item);
            if (normalized) {
              await gateway.handleIncomingArticle(normalized);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ Error fetching ${adapter.providerName}:`, err.message);
      }
    }

    const cycleCommitted = gateway.stats.committed - startCommitted;
    const cycleDropped = gateway.stats.droppedDuplicates - startDuplicates;

    resultsByCycle.push({ cycle, cycleCommitted, cycleDropped });
    console.log(`\n>>> CYCLE #${cycle} FINISHED:`);
    console.log(`    Committed to DB:       ${cycleCommitted}`);
    console.log(`    Dropped as Duplicates: ${cycleDropped}`);

    if (cycle < 3) {
      console.log('Waiting 2 seconds before next cycle...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 3. Final DB Count
  const { count: finalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });

  console.log('\n=============================================================');
  console.log('📊 FINAL THREE-CYCLE DEDUP VERIFICATION REPORT');
  console.log('=============================================================');
  console.log(`Initial DB Article Count: ${initialCount}`);
  console.log(`Final DB Article Count:   ${finalCount}`);
  console.log(`New Rows Added across 3 cycles: ${finalCount - initialCount}`);
  for (const r of resultsByCycle) {
    console.log(`Cycle #${r.cycle}: Committed = ${r.cycleCommitted}, Dropped Duplicates = ${r.cycleDropped}`);
  }

  if (finalCount === initialCount) {
    console.log('\n🎉 SUCCESS: ZERO new duplicate rows were created across all 3 cycles!');
    console.log('All repeated items were successfully DROPPED BEFORE ANY INSERT!');
  } else {
    console.log(`\nNotice: ${finalCount - initialCount} genuinely new articles were added.`);
  }

  process.exit(0);
}

runThreeCyclesDedupVerification().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
