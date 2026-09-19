import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Deduplicator } from './services/ingestion/Deduplicator.js';
import { IngestionGateway } from './services/ingestion/IngestionGateway.js';
import { AiTriageQueue } from './services/ingestion/AiTriageQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function runArchitectureAudit() {
  console.log('=============================================================');
  console.log('🧪 LOW-LATENCY REAL-TIME NEWS INGESTION ARCHITECTURE AUDIT');
  console.log('=============================================================\n');

  // TEST 1: Deduplication Engine (5-Layer Test)
  console.log('--- TEST 1: MULTI-LAYER DEDUPLICATION ENGINE ---');
  const dedup = new Deduplicator();

  const baseArticle = {
    articleId: 'test-guid-101',
    url: 'https://economictimes.indiatimes.com/tech/ites/infosys-ai-deal-2026?utm_source=twitter&ref=wire',
    title: 'Infosys signs $1B multi-year enterprise AI contract',
    publisher: 'The Economic Times',
    provider: 'institutional'
  };

  const eval1 = dedup.evaluate(baseArticle);
  console.log('1. Base Article Evaluation:', eval1.dedupDecision, `(${eval1.dedupReason})`);
  if (eval1.isDuplicate) throw new Error('Base article should be ALLOWED');

  // Exact ID duplicate
  const eval2 = dedup.evaluate({ ...baseArticle, url: 'https://other.com/different' });
  console.log('2. Exact ID Re-check:', eval2.dedupDecision, `(${eval2.dedupLayer})`);
  if (!eval2.isDuplicate) throw new Error('Exact ID should be DROPPED');

  // URL normalization & canonical duplicate (different query parameters)
  const eval3 = dedup.evaluate({
    articleId: 'test-guid-102',
    url: 'https://economictimes.indiatimes.com/tech/ites/infosys-ai-deal-2026?utm_source=linkedin&utm_campaign=newsletter',
    title: 'Different Title Here',
    publisher: 'The Economic Times',
    provider: 'institutional'
  });
  console.log('3. Canonical URL (tracking stripped) Re-check:', eval3.dedupDecision, `(${eval3.dedupLayer})`);
  if (!eval3.isDuplicate) throw new Error('Canonical URL match should be DROPPED');

  // Title + Publisher Fingerprint (same title by same publisher)
  const eval4 = dedup.evaluate({
    articleId: 'test-guid-103',
    url: 'https://economictimes.indiatimes.com/tech/ites/alternate-url-path',
    title: 'Infosys signs $1B multi-year enterprise AI contract!',
    publisher: 'The Economic Times',
    provider: 'institutional'
  });
  console.log('4. Same Title + Same Publisher Re-check:', eval4.dedupDecision, `(${eval4.dedupLayer})`);
  if (!eval4.isDuplicate) throw new Error('Same Title + Publisher should be DROPPED');

  // MULTI-PUBLISHER COVERAGE PRESERVATION & STORY CLUSTERING:
  const eval5 = dedup.evaluate({
    articleId: 'test-guid-104',
    url: 'https://www.livemint.com/companies/news/infosys-ai-deal-mint-coverage',
    title: 'Infosys signs $1B multi-year enterprise AI contract',
    publisher: 'Livemint',
    provider: 'institutional'
  });
  console.log('5. Same Title + DIFFERENT Publisher (Preservation Check):', eval5.dedupDecision, `(${eval5.dedupReason})`);
  console.log(`   Story Cluster ID: ${eval5.storyClusterId} | Source Corroboration Count: ${eval5.sourceCount}`);
  if (eval5.isDuplicate) throw new Error('Legitimate multi-publisher coverage must be ALLOWED');
  if (eval5.sourceCount < 2) throw new Error('Source count should reflect multi-publisher corroboration');
  console.log('✅ TEST 1 PASSED: 5-Layer Deduplication Engine & Story Clustering working accurately.\n');

  // TEST 2: Fast-Path Ingestion Latency Measurement
  console.log('--- TEST 2: FAST-PATH INGESTION LATENCY (<100ms) ---');
  let fastPathHandled = false;
  let receivedArticle = null;

  const gateway = new IngestionGateway({
    supabase: null, // test in-memory to benchmark pure pipeline speed
    onArticleCommitted: (art) => {
      fastPathHandled = true;
      receivedArticle = art;
    }
  });

  const testArticle = {
    providerArticleId: 'test-fast-path-001',
    provider: 'guardian',
    publisher: 'The Guardian',
    title: 'Infosys accelerates enterprise cloud migration across European banking sectors',
    url: 'https://www.theguardian.com/business/2026/sep/19/infosys-cloud-europe',
    canonicalUrl: 'https://theguardian.com/business/2026/sep/19/infosys-cloud-europe',
    content: 'Infosys today announced expanded digital transformation engagements with top European financial institutions.',
    publishedAt: new Date(Date.now() - 15000).toISOString(),
    receivedAt: new Date().toISOString()
  };

  const t0 = Date.now();
  await gateway.handleIncomingArticle(testArticle);
  const fastPathTimeMs = Date.now() - t0;

  console.log(`Fast-path execution latency: ${fastPathTimeMs}ms`);
  console.log(`Article committed? ${fastPathHandled ? 'YES' : 'NO'}`);
  console.log(`Assigned ID: ${receivedArticle?.id}`);
  console.log(`Target entity detected: ${receivedArticle?.entity_mentioned}`);
  console.log(`Initial Status: ${receivedArticle?.status}`);

  if (!fastPathHandled || fastPathTimeMs > 100) {
    throw new Error(`Fast-path failed SLA check: ${fastPathTimeMs}ms (Must be < 100ms)`);
  }
  console.log('✅ TEST 2 PASSED: Fast-path raw commit in < 100ms without blocking on AI inference.\n');

  // TEST 3: Priority AI Queue Ordering
  console.log('--- TEST 3: PRIORITY AI QUEUE SCHEDULING ---');
  const aiQueue = new AiTriageQueue({ supabase: null, maxConcurrency: 0 }); // pause dispatch to inspect queue ordering

  const normalJob = { id: 'job-1', title: 'TCS quarterly earnings commentary', raw_content: 'TCS reports solid margins in tech consulting.', entity_mentioned: 'TCS' };
  const crisisJob = { id: 'job-2', title: 'SEBI issues urgent regulatory audit inquiry into Infosys enterprise Finacle', raw_content: 'SEBI initiated a formal compliance probe into Infosys.', entity_mentioned: 'Infosys' };
  const clientJob = { id: 'job-3', title: 'Infosys partners with global automotive supplier', raw_content: 'Infosys signs cloud deal.', entity_mentioned: 'Infosys' };

  aiQueue.enqueue(normalJob); // P2 (Competitor)
  aiQueue.enqueue(crisisJob); // P0 (Infosys Crisis)
  aiQueue.enqueue(clientJob); // P3 (Infosys Normal)

  console.log('Queued jobs ordering:');
  aiQueue.queue.forEach((j, idx) => console.log(`  ${idx + 1}. [P${j.priority}] ${j.article.title.slice(0, 50)}...`));

  if (aiQueue.queue[0].priority !== 0) {
    throw new Error('Crisis job must be prioritized to front of queue (P0)');
  }
  console.log('✅ TEST 3 PASSED: Priority AI queue correctly orders crisis events before competitor news.\n');

  // TEST 4: Parallel Provider Health Inspection
  console.log('--- TEST 4: PROVIDER HEALTH MONITORING & TELEMETRY ---');
  const health = gateway.getHealthSummary();
  console.log('Gateway status:', health.status);
  console.log('Registered providers count:', health.providers.length);
  for (const p of health.providers) {
    console.log(`  • ${p.displayName} [${p.providerName}] - Mode: ${p.fetchMode} | Priority: P${p.priority} | Interval: ${p.intervalMs}ms | Status: ${p.status}`);
  }
  if (health.providers.length !== 9) {
    throw new Error(`Expected 9 registered providers, got ${health.providers.length}`);
  }
  console.log('✅ TEST 4 PASSED: All 8 providers monitored and reporting status.\n');

  console.log('=============================================================');
  console.log('🎉 ALL ARCHITECTURE VERIFICATION CHECKS PASSED!');
  console.log('=============================================================\n');
}

runArchitectureAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
