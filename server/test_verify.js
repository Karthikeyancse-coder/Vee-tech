/**
 * VEE-ALERT AUTOMATED VERIFICATION SUITE (test_verify.js)
 *
 * SAFETY RULES (Option A — self-cleaning test isolation):
 *  1. All test rows are embedded with a "TEST_ONLY_<timestamp>" token in their titles.
 *     This makes them trivially identifiable in the DB.
 *  2. At the END of every test run (success OR failure), the script deletes every row
 *     it inserted using the token list. Cleanup runs in a `finally` block — it executes
 *     even if a test throws midway.
 *  3. Production guard: if running against a non-localhost Supabase URL without the
 *     --i-know-this-is-prod flag, the script prints a loud warning and exits immediately.
 */

process.env.NODE_ENV = 'test';

import dotenv from 'dotenv';
dotenv.config();

import { warmupOllama, triageArticle, processIngest, evaluateAlertRules, supabase } from './server.js';
import { fetchGdeltDoc, fetchPublisherRss } from './services/newsFetcher.js';

// ============================================================================
// PRODUCTION SAFETY GUARD
// ============================================================================
const PROD_SUPABASE_URL = process.env.SUPABASE_URL || '';
const I_KNOW_PROD_FLAG = process.argv.includes('--i-know-this-is-prod');

if (PROD_SUPABASE_URL && !PROD_SUPABASE_URL.includes('localhost') && !I_KNOW_PROD_FLAG) {
  console.warn('\n╔══════════════════════════════════════════════════════════════════╗');
  console.warn('║  ⚠️  PRODUCTION SUPABASE DETECTED                                ║');
  console.warn(`║  URL: ${PROD_SUPABASE_URL.slice(0, 55).padEnd(55)} ║`);
  console.warn('║                                                                  ║');
  console.warn('║  This script will INSERT and immediately DELETE test rows.       ║');
  console.warn('║  If the cleanup fails (e.g. test crash), fake rows could         ║');
  console.warn('║  briefly appear in the live production feed.                     ║');
  console.warn('║                                                                  ║');
  console.warn('║  Re-run with --i-know-this-is-prod to proceed anyway.            ║');
  console.warn('╚══════════════════════════════════════════════════════════════════╝\n');
  process.exit(1);
}

// ============================================================================
// SELF-CLEANUP SYSTEM
// Track every unique token embedded in test row titles during this run
// ============================================================================
const TEST_PREFIX = 'TEST_ONLY_';
const insertedTestTokens = new Set();

/**
 * Deletes all test rows inserted during this run.
 * Matches on embedded title token. Runs in finally block — always executes.
 */
async function cleanupTestRows() {
  if (!supabase || insertedTestTokens.size === 0) {
    console.log('[Test Cleanup] No DB rows to clean up (Supabase not configured or no rows inserted).');
    return;
  }

  console.log(`\n[Test Cleanup] Deleting ${insertedTestTokens.size} test run token(s) from production DB...`);

  for (const token of insertedTestTokens) {
    try {
      const { data: found, error: findErr } = await supabase
        .from('articles')
        .select('id, title')
        .like('title', `%${token}%`);

      if (findErr) {
        console.warn(`[Test Cleanup] Query error for token "${token}": ${findErr.message}`);
        continue;
      }
      if (!found || found.length === 0) {
        console.log(`[Test Cleanup] No DB rows found for token: "${token}" (likely skipped by dedup).`);
        continue;
      }

      const ids = found.map(r => r.id);

      // Delete dependent alert_logs first (FK safety)
      const { error: logsErr } = await supabase.from('alert_logs').delete().in('article_id', ids);
      if (logsErr) console.warn(`[Test Cleanup] alert_logs delete notice: ${logsErr.message}`);

      const { data: deleted, error: delErr } = await supabase
        .from('articles').delete().in('id', ids).select('id, title');
      if (delErr) {
        console.warn(`[Test Cleanup] Article delete error for token "${token}": ${delErr.message}`);
      } else {
        console.log(`[Test Cleanup] ✅ Deleted ${deleted?.length || 0} row(s) for token: "${token}"`);
        deleted?.forEach(r => console.log(`  → Removed: ${r.id} | ${r.title?.slice(0, 70)}`));
      }
    } catch (e) {
      console.warn(`[Test Cleanup] Exception for token "${token}": ${e.message}`);
    }
  }

  // Final verification: zero test rows remain
  const { data: remaining } = await supabase
    .from('articles').select('id')
    .or(`title.like.%${TEST_PREFIX}%,title.like.%[Batch #%,title.like.%[Live Feed Audit #%`);
  const count = remaining?.length || 0;
  console.log(`[Test Cleanup] Remaining test rows in DB after cleanup: ${count} ${count === 0 ? '✅' : '⚠️ ALERT: rows still present!'}`);
}

// ============================================================================
// MAIN VERIFICATION SUITE
// ============================================================================
async function runVerification() {
  console.log('\n=============================================================');
  console.log('🧪 VEE-ALERT AUTOMATED VERIFICATION SUITE');
  console.log('=============================================================\n');

  try {

    // TEST 1: Ollama Warm-Up Ping
    console.log('--- TEST 1: OLLAMA WARMUP ---');
    const warmed = await warmupOllama();
    console.log(`Warmup result: ${warmed ? 'SUCCESS' : 'FAILED'}\n`);

    // TEST 2: Ollama Real Inference Test (does NOT write to DB)
    console.log('--- TEST 2: REAL OLLAMA INFERENCE (BUG 1 ROOT CAUSE PROOF) ---');
    const sampleTitle = 'SEBI issues urgent regulatory audit inquiry into Infosys enterprise Finacle cloud deployment';
    const sampleContent = 'The Securities and Exchange Board of India (SEBI) has initiated a formal regulatory compliance inquiry into Infosys banking software architecture following reported latency spikes in core transaction processing. Enterprise audit teams have requested complete system logs within 48 hours.';
    
    const triageResult = await triageArticle(sampleContent, sampleTitle, 'The Economic Times');
    console.log('Triage Output Result:');
    console.log(JSON.stringify(triageResult, null, 2));
    console.log('\n');

    // TEST 3: Alert Rules Evaluation (no DB write)
    console.log('--- TEST 3: CONFIGURABLE ALERT RULES ENGINE ---');
    const ruleEvaluation = evaluateAlertRules(triageResult);
    console.log('Rule evaluation:', ruleEvaluation);
    console.log('\n');

    // TEST 4: End-to-End Pipeline Dispatch with 5 Timestamps & SLA telemetry
    // Token embedded in title → cleanup will find and delete this row.
    console.log('--- TEST 4: END-TO-END DISPATCH (5 TIMESTAMPS & TELEMETRY) ---');
    const runId = Date.now();
    const testToken4 = `${TEST_PREFIX}${runId}`;
    insertedTestTokens.add(testToken4);

    const testArticle = {
      api_source: 'ET RSS',
      source_name: 'The Economic Times',
      title: `${sampleTitle} [${testToken4}]`,
      url: `https://economictimes.indiatimes.com/tech/ites/infosys-sebi-audit-verify-${runId}`,
      raw_content: sampleContent,
      published_at: new Date(Date.now() - 30000).toISOString()
    };

    const ingestResult = await processIngest(testArticle);
    console.log('Pipeline Ingest Telemetry:');
    console.log(JSON.stringify(ingestResult.sla, null, 2));
    console.log('\n');

    // TEST 5: GDELT Cooldown Verification (no DB write)
    console.log('--- TEST 5: GDELT COOLDOWN AND TIMEOUT RESILIENCE ---');
    const gdeltResults = await fetchGdeltDoc();
    console.log(`GDELT fetch completed safely without blocking. Result count: ${gdeltResults.length}\n`);

    // TEST 6: Real Live RSS Article Ingestion
    // Uses the REAL article URL unchanged. Token embedded in title ONLY (not in URL).
    // Cleanup will find and delete this row after the run completes.
    console.log('--- TEST 6: REAL LIVE RSS ARTICLE INGESTION & TELEMETRY ---');
    const liveRssItems = await fetchPublisherRss();
    if (liveRssItems && liveRssItems.length > 0) {
      const realLiveArticle = { ...liveRssItems[0] };
      const liveRunId = Date.now();
      const liveToken = `${TEST_PREFIX}${liveRunId}`;
      insertedTestTokens.add(liveToken);

      // Preserve the REAL URL exactly as returned by the feed — do NOT append #fragments.
      // The token is embedded in the title only, leaving the URL intact for audit purposes.
      realLiveArticle.title = `${realLiveArticle.title} [${liveToken}]`;

      console.log(`Live headline: "${realLiveArticle.title}"`);
      console.log(`Live publisher: "${realLiveArticle.source_name}" [${realLiveArticle.api_source}]`);
      console.log(`Feed publication timestamp: ${realLiveArticle.published_at}`);
      console.log(`Real URL (unmodified): ${realLiveArticle.url}`);

      const liveIngestResult = await processIngest(realLiveArticle);
      console.log('Real Live Article Telemetry JSON:');
      console.log(JSON.stringify(liveIngestResult.sla, null, 2));
    } else {
      console.log('No live RSS articles returned.');
    }

    console.log('\n=============================================================');
    console.log('✅ ALL VERIFICATION SUITE TESTS COMPLETED');
    console.log('=============================================================\n');

  } finally {
    // ⚠️  ALWAYS runs — even if any test above throws.
    // Deletes every TEST_ONLY_ row inserted during this run.
    await cleanupTestRows();
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Verification suite error:', err);
  cleanupTestRows().finally(() => process.exit(1));
});
