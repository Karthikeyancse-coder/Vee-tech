process.env.NODE_ENV = 'test';
import { warmupOllama, triageArticle, processIngest, evaluateAlertRules } from './server.js';
import { fetchGdeltDoc, fetchPublisherRss } from './services/newsFetcher.js';

async function runVerification() {
  console.log('\n=============================================================');
  console.log('🧪 VEE-ALERT AUTOMATED VERIFICATION SUITE');
  console.log('=============================================================\n');

  // TEST 1: Ollama Warm-Up Ping
  console.log('--- TEST 1: OLLAMA WARMUP ---');
  const warmed = await warmupOllama();
  console.log(`Warmup result: ${warmed ? 'SUCCESS' : 'FAILED'}\n`);

  // TEST 2: Ollama Real Inference Test (The key test requested by user)
  console.log('--- TEST 2: REAL OLLAMA INFERENCE (BUG 1 ROOT CAUSE PROOF) ---');
  const sampleTitle = 'SEBI issues urgent regulatory audit inquiry into Infosys enterprise Finacle cloud deployment';
  const sampleContent = 'The Securities and Exchange Board of India (SEBI) has initiated a formal regulatory compliance inquiry into Infosys banking software architecture following reported latency spikes in core transaction processing. Enterprise audit teams have requested complete system logs within 48 hours.';
  
  const triageResult = await triageArticle(sampleContent, sampleTitle, 'The Economic Times');
  console.log('Triage Output Result:');
  console.log(JSON.stringify(triageResult, null, 2));
  console.log('\n');

  // TEST 3: Alert Rules Evaluation
  console.log('--- TEST 3: CONFIGURABLE ALERT RULES ENGINE ---');
  const ruleEvaluation = evaluateAlertRules(triageResult);
  console.log('Rule evaluation:', ruleEvaluation);
  console.log('\n');

  // TEST 4: End-to-End Pipeline Dispatch with 5 Timestamps & Correlation ID
  console.log('--- TEST 4: END-TO-END DISPATCH (5 TIMESTAMPS & TELEMETRY) ---');
  const runId = Date.now();
  const testArticle = {
    correlation_id: `corr_verify_${runId}`,
    api_source: 'ET RSS',
    source_name: 'The Economic Times',
    title: `${sampleTitle} [Batch #${runId.toString().slice(-4)}]`,
    url: `https://economictimes.indiatimes.com/tech/ites/infosys-sebi-audit-verify-${runId}`,
    raw_content: sampleContent,
    published_at: new Date(Date.now() - 30000).toISOString()
  };

  const ingestResult = await processIngest(testArticle);
  console.log('Pipeline Ingest Telemetry:');
  console.log(JSON.stringify(ingestResult.sla, null, 2));
  console.log('\n');

  // TEST 5: GDELT Cooldown Verification
  console.log('--- TEST 5: GDELT COOLDOWN AND TIMEOUT RESILIENCE ---');
  const gdeltResults = await fetchGdeltDoc();
  console.log(`GDELT fetch completed safely without blocking. Result count: ${gdeltResults.length}\n`);

  // TEST 6: REAL LIVE RSS ARTICLE INGESTION (ITEM 4)
  console.log('--- TEST 6: REAL LIVE RSS ARTICLE INGESTION & TELEMETRY ---');
  const liveRssItems = await fetchPublisherRss();
  if (liveRssItems && liveRssItems.length > 0) {
    const realLiveArticle = { ...liveRssItems[0] };
    const runId = Date.now();
    realLiveArticle.correlation_id = `corr_live_rss_${runId}`;
    realLiveArticle.url = `${realLiveArticle.url}#test-${runId}`;
    realLiveArticle.title = `${realLiveArticle.title} [Live Feed Audit #${runId.toString().slice(-4)}]`;
    console.log(`Live headline: "${realLiveArticle.title}"`);
    console.log(`Live publisher: "${realLiveArticle.source_name}" [${realLiveArticle.api_source}]`);
    console.log(`Feed publication timestamp: ${realLiveArticle.published_at}`);

    const liveIngestResult = await processIngest(realLiveArticle);
    console.log('Real Live Article Telemetry JSON:');
    console.log(JSON.stringify(liveIngestResult.sla, null, 2));
  } else {
    console.log('No live RSS articles returned.');
  }

  console.log('\n=============================================================');
  console.log('✅ ALL VERIFICATION SUITE TESTS COMPLETED');
  console.log('=============================================================\n');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
