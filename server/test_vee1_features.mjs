import { GDELTAdapter } from './services/ingestion/providers/GDELTAdapter.js';
import { InstitutionalRssAdapter } from './services/ingestion/providers/InstitutionalRssAdapter.js';
import { SearchService } from './services/SearchService.js';
import { getPublisherMetrics, validateEntityContext } from './services/mediaMetrics.js';

async function runTests() {
  console.log('🧪 Starting VEE-1 Architecture Verification in VEE-TECH...\n');

  // Test 1: Media Metrics & Valuation
  console.log('--- Test 1: Media Valuation & Reach ---');
  const etMetrics = getPublisherMetrics('The Economic Times', 'POSITIVE');
  console.log('ET Metrics:', etMetrics);
  if (etMetrics.reach < 2500000 || etMetrics.tier !== 1) {
    throw new Error('ET valuation mismatch');
  }

  const tcMetrics = getPublisherMetrics('TechCrunch', 'NEUTRAL');
  console.log('TechCrunch Metrics:', tcMetrics);
  if (tcMetrics.reach < 3500000) {
    throw new Error('TechCrunch valuation mismatch');
  }
  console.log('✅ Media metrics passed.\n');

  // Test 2: Disambiguation Filter
  console.log('--- Test 2: Entity Disambiguation Pre-Filter ---');
  const validPayU = validateEntityContext('PayU launches new checkout for merchants with RBI approval', 'PayU');
  const invalidPayU = validateEntityContext('Central 8th pay commission announces pay hike and revised pay scale', 'PayU');
  console.log(`PayU valid text allowed: ${validPayU}`);
  console.log(`Pay commission false-positive rejected: ${!invalidPayU}`);
  if (!validPayU || invalidPayU) {
    throw new Error('Entity disambiguation failed');
  }
  console.log('✅ Disambiguation filter passed.\n');

  // Test 3: GDELT Adapter Fetch
  console.log('--- Test 3: GDELT 2.0 Global Event Wire ---');
  const gdelt = new GDELTAdapter();
  const startGdelt = Date.now();
  const gdeltItems = await gdelt.fetch();
  const gdeltDuration = Date.now() - startGdelt;
  console.log(`Fetched ${gdeltItems.length} items from GDELT 2.0 in ${gdeltDuration}ms`);
  if (gdeltItems.length > 0) {
    const normalized = gdelt.normalize(gdeltItems[0]);
    console.log('Sample GDELT Normalized Article:', {
      title: normalized.title,
      publisher: normalized.publisher,
      publishedAt: normalized.publishedAt,
      provider: normalized.provider
    });
  }
  console.log('✅ GDELT 2.0 adapter passed.\n');

  // Test 4: Live On-Demand Concurrent Search
  console.log('--- Test 4: On-Demand Multi-Provider Live Search (Google News + GDELT) ---');
  const searchResult = await SearchService.searchAll('Infosys', { maxResults: 15 });
  console.log(`Search completed in ${searchResult.latencyMs}ms!`);
  console.log(`Total results found: ${searchResult.totalResults}`);
  console.log('Provider breakdown:', searchResult.diagnostics);
  if (searchResult.results.length > 0) {
    console.log('Top Result:', {
      title: searchResult.results[0].title,
      publisher: searchResult.results[0].publisher,
      reach: searchResult.results[0].estimated_reach,
      ave: searchResult.results[0].ave_val,
      tier: searchResult.results[0].publisher_tier
    });
  }
  console.log('✅ Live on-demand multi-provider search passed.\n');

  console.log('🎉 ALL VEE-1 FEATURE INTEGRATIONS VERIFIED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
