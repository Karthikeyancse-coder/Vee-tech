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

async function testRecencyGuardrailCycles() {
  console.log('=============================================================');
  console.log('🧪 RUNNING 3 INGESTION CYCLES TO VERIFY RECENCY GUARDRAIL');
  console.log('=============================================================\n');

  const gateway = new IngestionGateway({
    supabase,
    maxArticleAgeHours: 12
  });

  // Inject a synthetic stale article into each cycle alongside real adapter fetches
  // to prove the guardrail actively intercepts and drops stale items
  const adapters = gateway.adapters.filter(a => ['guardian', 'googlenews', 'institutional'].includes(a.providerName));

  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`\n================== STARTING CYCLE #${cycle} ==================`);
    const startStale = gateway.stats.droppedStale;
    const startCommitted = gateway.stats.committed;

    // 1. Fetch from live adapters
    for (const adapter of adapters) {
      try {
        const rawItems = await adapter.fetch();
        if (Array.isArray(rawItems)) {
          for (const item of rawItems) {
            const normalized = adapter.normalize(item);
            if (normalized) {
              await gateway.handleIncomingArticle(normalized);
            }
          }
        }
      } catch (err) {
        console.warn(`[${adapter.providerName}] error:`, err.message);
      }
    }

    // 2. Feed test stale item to explicitly verify the guardrail intercept
    const staleTest = {
      provider: 'guardian',
      publisher: 'The Guardian',
      title: `PwC partners who fail to embrace AI have no future at firm (Cycle ${cycle} Test)`,
      url: `https://theguardian.com/business/2026/mar/19/pwc-stale-test-cycle-${cycle}`,
      content: 'Accenture and PwC test content.',
      publishedAt: '2026-03-19T12:04:06Z',
      receivedAt: new Date().toISOString()
    };
    await gateway.handleIncomingArticle(staleTest);

    const cycleStale = gateway.stats.droppedStale - startStale;
    const cycleCommitted = gateway.stats.committed - startCommitted;

    console.log(`>>> CYCLE #${cycle} SUMMARY:`);
    console.log(`    Articles Committed:     ${cycleCommitted}`);
    console.log(`    Stale Articles Dropped: ${cycleStale}`);
  }

  console.log('\n=============================================================');
  console.log('✅ ALL 3 CYCLES COMPLETED');
  console.log(`Total Stale Articles Dropped Across Test: ${gateway.stats.droppedStale}`);
  console.log('=============================================================');

  process.exit(0);
}

testRecencyGuardrailCycles().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
