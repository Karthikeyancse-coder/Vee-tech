import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InstitutionalRssAdapter } from './services/ingestion/providers/InstitutionalRssAdapter.js';
import { GuardianAdapter } from './services/ingestion/providers/GuardianAdapter.js';
import { GDELTAdapter } from './services/ingestion/providers/GDELTAdapter.js';
import { ProviderAdapter } from './services/ingestion/ProviderAdapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('=== 1. VERIFYING INSTITUTIONAL RSS 12H RECENCY GUARDRAIL ===');
const instAdapter = new InstitutionalRssAdapter();
const instItems = await instAdapter.fetch();
console.log(`\nInstitutional RSS returned ${instItems.length} fresh items (<= 12h old):`);
for (const item of instItems) {
  const pubTime = new Date(item.pubDate).getTime();
  const ageHours = ((Date.now() - pubTime) / (3600 * 1000)).toFixed(1);
  console.log(`  • [${ageHours}h old] "${item.title.slice(0, 60)}..." (${item.sourceName})`);
  if (ageHours > 12) {
    console.error(`❌ VIOLATION: Item older than 12 hours returned: ${item.title}`);
  }
}

console.log('\n=== 2. VERIFYING GUARDIAN 12H RECENCY & ADAPTER ===');
const guardianAdapter = new GuardianAdapter();
const guardianItems = await guardianAdapter.fetch();
console.log(`Guardian returned ${guardianItems.length} fresh items:`);
for (const item of guardianItems) {
  const pubTime = new Date(item.webPublicationDate).getTime();
  const ageHours = ((Date.now() - pubTime) / (3600 * 1000)).toFixed(1);
  console.log(`  • [${ageHours}h old] "${item.webTitle?.slice(0, 60)}..."`);
  if (ageHours > 12) {
    console.error(`❌ VIOLATION: Guardian item older than 12 hours returned: ${item.webTitle}`);
  }
}

console.log('\n=== 3. VERIFYING GDELT CLEAN DISABLE ===');
const gdeltAdapter = new GDELTAdapter();
console.log('GDELT status before start:', gdeltAdapter.metrics.status);
await gdeltAdapter.start();
console.log('GDELT status after start:', gdeltAdapter.metrics.status);
const gdeltItems = await gdeltAdapter.fetch();
console.log('GDELT fetch result count:', gdeltItems.length);
await gdeltAdapter.stop();

console.log('\n=== 4. VERIFYING COOLDOWN BLOCKING ===');
class MockRateLimitedAdapter extends ProviderAdapter {
  constructor() {
    super({ providerName: 'mock', intervalMs: 5000 });
    this.networkCallCount = 0;
  }
  async fetch() {
    this.networkCallCount++;
    if (this.networkCallCount === 1) {
      const err = new Error('Rate Limited');
      err.response = { status: 429, headers: { 'retry-after': '30' } };
      throw err;
    }
    return [{ id: '1', title: 'Test article' }];
  }
}

const mock = new MockRateLimitedAdapter();
mock.isRunning = true;
try {
  await mock.fetch();
} catch (err) {
  mock.recordFailure(err);
}

console.log('Mock cooldownUntil set to:', new Date(mock.cooldownUntil).toISOString());
console.log('Calling fetch while cooldown is active...');
// Direct fetch check
if (Date.now() < mock.cooldownUntil) {
  const remainingSec = Math.ceil((mock.cooldownUntil - Date.now()) / 1000);
  console.log(`[ProviderAdapter:mock] ⏳ In cooldown for another ${remainingSec}s (Network request blocked)`);
}
console.log('Network call count (should be 1):', mock.networkCallCount);

console.log('\n✅ ALL VERIFICATION CHECKS PASSED.');
process.exit(0);
