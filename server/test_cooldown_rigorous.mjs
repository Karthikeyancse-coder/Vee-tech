import { ProviderAdapter } from './services/ingestion/ProviderAdapter.js';

class MockApiAdapter extends ProviderAdapter {
  constructor() {
    super({
      providerName: 'test-wire',
      intervalMs: 2000
    });
    this.networkAttempts = 0;
    this.simulatedErrorOccurred = false;
  }

  async fetch() {
    // 1. Line 1 Cooldown Check
    if (Date.now() < this.cooldownUntil) {
      const remainingSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      console.log(`[ProviderAdapter:${this.providerName}] ⏭ Skipped fetch — ${remainingSec}s remaining in cooldown`);
      return [];
    }

    // 2. Real network attempt simulation
    this.networkAttempts++;
    console.log(`[ProviderAdapter:${this.providerName}] 🌐 Outgoing HTTP request #${this.networkAttempts} firing...`);

    if (!this.simulatedErrorOccurred) {
      this.simulatedErrorOccurred = true;
      const err = new Error('Rate Limited');
      err.response = { status: 429, headers: { 'retry-after': '5' } };
      throw err;
    }

    return [{ id: 'art-100', title: 'Real Article after clean cooldown recovery' }];
  }
}

console.log('========================================================================');
console.log('⚡ VERIFYING COOLDOWN ENFORCEMENT & ZERO-NETWORK-CALL GUARANTEE');
console.log('========================================================================\n');

const adapter = new MockApiAdapter();
await adapter.start();

// Wait 100ms for initial poll to execute and trigger 429
await new Promise(r => setTimeout(r, 150));

console.log(`\nAdapter initial network attempts: ${adapter.networkAttempts}`);
console.log(`Cooldown until: ${new Date(adapter.cooldownUntil).toISOString()}`);
console.log(`Current status: ${adapter.metrics.status}\n`);

// Attempt 1: Call fetch directly at t+1s while cooldown is active
await new Promise(r => setTimeout(r, 1000));
console.log('--- Direct fetch attempt during active cooldown (t=1s) ---');
const res1 = await adapter.fetch();
console.log(`Attempt 1 returned items: ${res1.length} | Network attempts: ${adapter.networkAttempts}`);

// Attempt 2: Call fetch directly at t+3s while cooldown is active
await new Promise(r => setTimeout(r, 2000));
console.log('\n--- Direct fetch attempt during active cooldown (t=3s) ---');
const res2 = await adapter.fetch();
console.log(`Attempt 2 returned items: ${res2.length} | Network attempts: ${adapter.networkAttempts}`);

// Wait for 10s cooldown to expire (t=10.5s) and verify timer fires genuine retry
console.log('\n--- Waiting for cooldown to reach 0 and timer to trigger real retry ---');
await new Promise(r => setTimeout(r, 8000));

console.log(`\nFinal network attempts count: ${adapter.networkAttempts} (Expected: 2)`);
console.log(`Final adapter status: ${adapter.metrics.status} (Expected: HEALTHY)`);
console.log(`Total rate limits during cooldown window: ${adapter.metrics.rateLimitCount} (Expected: 1)`);

await adapter.stop();

if (adapter.networkAttempts === 2 && adapter.metrics.rateLimitCount === 1) {
  console.log('\n✅ VERIFICATION PASSED: Cooldown completely blocked all requests during window, and retried cleanly upon reaching 0.');
  process.exit(0);
} else {
  console.error('\n❌ VERIFICATION FAILED.');
  process.exit(1);
}
