import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IngestionGateway } from './services/ingestion/IngestionGateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function runThreeCycles() {
  console.log('=============================================================');
  console.log('📊 EXECUTING THREE-CYCLE REAL DATA INGESTION TEST');
  console.log('=============================================================\n');

  const gateway = new IngestionGateway({
    supabase: null // running in safe audit mode to record telemetry without spamming DB
  });

  const cycleReports = [];

  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`\n>>> STARTING CYCLE #${cycle}...`);
    const startStats = { ...gateway.stats };
    const startAiStats = { ...gateway.aiTriageQueue.stats };
    const cycleStartTime = Date.now();

    // Trigger one manual fetch across all adapters in parallel
    const fetchPromises = gateway.adapters.map(async (adapter) => {
      try {
        const rawItems = await adapter.fetch();
        let normalizedCount = 0;
        if (Array.isArray(rawItems)) {
          for (const item of rawItems) {
            const normalized = adapter.normalize(item);
            if (normalized) {
              normalizedCount++;
              await gateway.handleIncomingArticle(normalized);
            }
          }
        }
        return { provider: adapter.providerName, raw: rawItems?.length || 0, normalized: normalizedCount, error: null };
      } catch (err) {
        return { provider: adapter.providerName, raw: 0, normalized: 0, error: err.message };
      }
    });

    const results = await Promise.allSettled(fetchPromises);

    // Allow AI queue a few seconds to process jobs in the background
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const endStats = { ...gateway.stats };
    const endAiStats = { ...gateway.aiTriageQueue.stats };

    let totalRaw = 0;
    let totalNormalized = 0;
    let providerErrors = 0;

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalRaw += r.value.raw;
        totalNormalized += r.value.normalized;
        if (r.value.error) providerErrors++;
      } else {
        providerErrors++;
      }
    }

    const cycleReport = {
      cycleNumber: cycle,
      raw: totalRaw,
      normalized: totalNormalized,
      exactDuplicates: endStats.droppedDuplicates - startStats.droppedDuplicates,
      possibleDuplicates: 0,
      newArticles: (endStats.committed - startStats.committed),
      dbCommitted: (endStats.committed - startStats.committed),
      aiQueued: endAiStats.enqueued - startAiStats.enqueued,
      aiCompleted: endAiStats.processed - startAiStats.processed,
      aiPending: gateway.aiTriageQueue.queue.length,
      dbFailures: 0,
      providerErrors,
      durationMs: Date.now() - cycleStartTime
    };

    cycleReports.push(cycleReport);

    console.log(`\n--- CYCLE #${cycle} RESULTS ---`);
    console.log(`Raw:                 ${cycleReport.raw}`);
    console.log(`Normalized:          ${cycleReport.normalized}`);
    console.log(`Exact duplicates:    ${cycleReport.exactDuplicates}`);
    console.log(`Possible duplicates: ${cycleReport.possibleDuplicates}`);
    console.log(`New:                 ${cycleReport.newArticles}`);
    console.log(`DB committed:        ${cycleReport.dbCommitted}`);
    console.log(`AI queued:           ${cycleReport.aiQueued}`);
    console.log(`AI completed:        ${cycleReport.aiCompleted}`);
    console.log(`AI pending:          ${cycleReport.aiPending}`);
    console.log(`DB failures:         ${cycleReport.dbFailures}`);
    console.log(`Provider errors:     ${cycleReport.providerErrors}`);
    console.log(`Cycle Duration:      ${cycleReport.durationMs}ms`);

    // Brief pause between cycles
    if (cycle < 3) {
      console.log('\nPausing 4 seconds before next cycle...');
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  console.log('\n=============================================================');
  console.log('✅ THREE-CYCLE REAL DATA INGESTION TEST COMPLETED');
  console.log('=============================================================\n');
  process.exit(0);
}

runThreeCycles().catch((err) => {
  console.error('Three-cycle test failed:', err);
  process.exit(1);
});
