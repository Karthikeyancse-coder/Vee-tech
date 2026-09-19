import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { InstitutionalRssAdapter } from './services/ingestion/providers/InstitutionalRssAdapter.js';
import { GuardianAdapter } from './services/ingestion/providers/GuardianAdapter.js';
import { IngestionGateway } from './services/ingestion/IngestionGateway.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);

const gateway = new IngestionGateway({ supabase, maxArticleAgeHours: 12 });
const instAdapter = new InstitutionalRssAdapter();
const guardianAdapter = new GuardianAdapter();

console.log('========================================================================');
console.log('⚡ RUNNING 3 REAL INGESTION CYCLES (INSTITUTIONAL RSS & GUARDIAN)');
console.log('========================================================================\n');

for (let cycle = 1; cycle <= 3; cycle++) {
  console.log(`--- [CYCLE #${cycle}/3 START] ---`);
  
  // 1. Institutional RSS
  console.log(`[Cycle #${cycle}] Polling Institutional RSS...`);
  const instItems = await instAdapter.fetch();
  console.log(`[Cycle #${cycle}] Institutional RSS returned ${instItems.length} fresh articles.`);
  for (const item of instItems) {
    const norm = instAdapter.normalize(item);
    if (norm) await gateway.handleIncomingArticle(norm);
  }

  // 2. Guardian Content API
  console.log(`[Cycle #${cycle}] Polling The Guardian Content API...`);
  const guardianItems = await guardianAdapter.fetch();
  console.log(`[Cycle #${cycle}] Guardian Content API returned ${guardianItems.length} fresh articles.`);
  for (const item of guardianItems) {
    const norm = guardianAdapter.normalize(item);
    if (norm) await gateway.handleIncomingArticle(norm);
  }

  console.log(`--- [CYCLE #${cycle}/3 COMPLETE] ---\n`);
  if (cycle < 3) {
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Check database to ensure no stale articles exist
const { data: dbArticles } = await supabase
  .from('articles')
  .select('id, title, source_name, api_source, published_at')
  .order('published_at', { ascending: false });

console.log('========================================================================');
console.log(`FINAL DB CHECK: Total articles in DB = ${dbArticles.length}`);
const now = Date.now();
let violations = 0;
for (const a of dbArticles) {
  const ageHours = (now - new Date(a.published_at).getTime()) / (3600 * 1000);
  if (ageHours > 12) {
    violations++;
    console.error(`❌ VIOLATION STILL IN DB: "${a.title}" | age: ${ageHours.toFixed(1)}h | pub: ${a.published_at}`);
  }
}

if (violations === 0) {
  console.log('✅ ZERO VIOLATIONS: 100% of articles in the database are <= 12 hours old.');
} else {
  console.error(`❌ Found ${violations} violations in database.`);
}
console.log('========================================================================');
process.exit(0);
