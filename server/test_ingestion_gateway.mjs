import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IngestionGateway } from './services/ingestion/IngestionGateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function runTest() {
  console.log('Testing IngestionGateway initialization and adapters...\n');

  const gateway = new IngestionGateway({
    supabase: null // test without modifying real DB
  });

  const initialHealth = gateway.getHealthSummary();
  console.log('Initial Providers Registered:', initialHealth.providers.map(p => `${p.providerName} (${p.fetchMode}, P${p.priority}, status: ${p.status})`));

  console.log('\nStarting gateway for 15 seconds to observe provider polling and fast-path handling...');
  await gateway.start();

  await new Promise(r => setTimeout(r, 15000));

  const liveHealth = gateway.getHealthSummary();
  console.log('\n--- GATEWAY HEALTH REPORT ---');
  console.log('Gateway Stats:', liveHealth.gatewayStats);
  console.log('AI Queue Stats:', liveHealth.aiTriageQueueStats);
  console.log('\nProvider Statuses:');
  for (const p of liveHealth.providers) {
    console.log(`  - [${p.providerName}] status: ${p.status} | requests: ${p.requests} | successes: ${p.successCount} | errors: ${p.errorCount} | rateLimits: ${p.rateLimitCount} | avgLatency: ${p.averageLatencyMs}ms`);
  }

  await gateway.stop();
  console.log('\n✅ IngestionGateway test complete.');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
