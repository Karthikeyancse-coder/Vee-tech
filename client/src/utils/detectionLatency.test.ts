/**
 * Automated Acceptance Tests for Detection Latency Formatter & Classifier
 * 
 * Verifies all 7 Acceptance Test criteria specified by VEE-ALERT requirements:
 * TEST 1: 10:00:00 -> 10:00:45 => 45s, ✓ WITHIN 2m TARGET
 * TEST 2: 10:00:00 -> 10:01:59 => 1m 59s, ✓ WITHIN 2m TARGET
 * TEST 3: 10:00:00 -> 10:02:00 => 2m, ✓ WITHIN 2m TARGET
 * TEST 4: 10:00:00 -> 10:02:01 => 2m 1s, ⚠ ABOVE 2m TARGET
 * TEST 5: 10:00:00 -> 11:35:00 => 1h 35m, ⚠ ABOVE 2m TARGET
 * TEST 6: Missing published timestamp => Unavailable, Unavailable
 * TEST 7: Detected earlier than published => Timestamp anomaly
 */

import {
  calculateDetectionLatency,
  formatDurationCompact,
  formatUtcTimestamp,
  calculateAggregateLatencyMetrics
} from './detectionLatency';

function runAcceptanceTests() {
  const results: { test: string; passed: boolean; actual: string; expected: string }[] = [];

  function assert(name: string, actual: string, expected: string) {
    const passed = actual === expected;
    results.push({ test: name, passed, actual, expected });
    if (!passed) {
      console.error(`❌ FAILED: ${name}. Expected "${expected}", got "${actual}"`);
    } else {
      console.log(`✅ PASSED: ${name}`);
    }
  }

  // TEST 1
  const t1 = calculateDetectionLatency('2026-09-19T10:00:00Z', '2026-09-19T10:00:45Z');
  assert('TEST 1 - Latency', t1.formattedLatency, '45s');
  assert('TEST 1 - Status Badge', t1.statusBadgeText, '✓ WITHIN 2m TARGET');

  // TEST 2
  const t2 = calculateDetectionLatency('2026-09-19T10:00:00Z', '2026-09-19T10:01:59Z');
  assert('TEST 2 - Latency', t2.formattedLatency, '1m 59s');
  assert('TEST 2 - Status Badge', t2.statusBadgeText, '✓ WITHIN 2m TARGET');

  // TEST 3 (Exact 2 minutes = 120 seconds boundary)
  const t3 = calculateDetectionLatency('2026-09-19T10:00:00Z', '2026-09-19T10:02:00Z');
  assert('TEST 3 - Latency', t3.formattedLatency, '2m');
  assert('TEST 3 - Status Badge', t3.statusBadgeText, '✓ WITHIN 2m TARGET');

  // TEST 4 (121 seconds = Above 2m target)
  const t4 = calculateDetectionLatency('2026-09-19T10:00:00Z', '2026-09-19T10:02:01Z');
  assert('TEST 4 - Latency', t4.formattedLatency, '2m 1s');
  assert('TEST 4 - Status Badge', t4.statusBadgeText, '⚠ ABOVE 2m TARGET');

  // TEST 5 (1 hour 35 minutes)
  const t5 = calculateDetectionLatency('2026-09-19T10:00:00Z', '2026-09-19T11:35:00Z');
  assert('TEST 5 - Latency', t5.formattedLatency, '1h 35m');
  assert('TEST 5 - Status Badge', t5.statusBadgeText, '⚠ ABOVE 2m TARGET');

  // TEST 6 (Missing published timestamp)
  const t6 = calculateDetectionLatency(null, '2026-09-19T10:00:00Z');
  assert('TEST 6 - Latency', t6.formattedLatency, 'Unavailable');
  assert('TEST 6 - Status Badge', t6.statusBadgeText, 'Unavailable');

  // TEST 7 (Detected earlier than published: Clock skew / Timestamp anomaly)
  const t7 = calculateDetectionLatency('2026-09-19T10:00:05Z', '2026-09-19T09:59:58Z');
  assert('TEST 7 - Latency', t7.formattedLatency, 'Timestamp anomaly');
  assert('TEST 7 - Is Anomaly', String(t7.isAnomaly), 'true');

  // TEST 8: Timezone difference (+05:30 vs Z)
  const t8 = calculateDetectionLatency('2026-09-19T13:30:00+05:30', '2026-09-19T08:01:45Z');
  assert('TEST 8 - Timezone normalized latency', t8.formattedLatency, '1m 45s');
  assert('TEST 8 - Timezone normalized badge', t8.statusBadgeText, '✓ WITHIN 2m TARGET');

  // TEST 9: Exact match (0s)
  const t9 = calculateDetectionLatency('2026-09-19T10:00:00Z', '2026-09-19T10:00:00Z');
  assert('TEST 9 - 0s latency', t9.formattedLatency, '0s');
  assert('TEST 9 - 0s badge', t9.statusBadgeText, '✓ WITHIN 2m TARGET');

  // TEST 10: 24h+ formatting
  const t10 = calculateDetectionLatency('2026-09-18T10:00:00Z', '2026-09-19T13:00:00Z');
  assert('TEST 10 - 24h+ latency', t10.formattedLatency, '1d 3h');

  // USER SCENARIO TEST A: Real article arrives within target
  const testA = calculateDetectionLatency('2026-09-19T15:00:00Z', '2026-09-19T15:01:10Z');
  assert('TEST A - Latency 70s', testA.formattedLatency, '1m 10s');
  assert('TEST A - Within 2m', testA.statusBadgeText, '✓ WITHIN 2m TARGET');

  // USER SCENARIO TEST B: Real article delayed above target
  const testB = calculateDetectionLatency('2026-09-19T15:00:00Z', '2026-09-19T15:05:10Z');
  assert('TEST B - Latency 310s', testB.formattedLatency, '5m 10s');
  assert('TEST B - Above 2m', testB.statusBadgeText, '⚠ ABOVE 2m TARGET');

  // USER SCENARIO TEST F: Historical article (3 days ago / 2020) excluded from live metrics
  const sampleArticles = [
    { published_at: '2026-09-19T10:00:00Z', ingested_at: '2026-09-19T10:01:30Z' }, // 90s (live)
    { published_at: '2026-09-19T09:00:00Z', ingested_at: '2026-09-19T09:02:00Z' }, // 120s (live)
    { published_at: '2020-09-14T07:20:24Z', ingested_at: '2026-09-18T17:40:04Z' }, // 2,195 days (historical archive)
    { published_at: '2026-09-10T08:00:00Z', ingested_at: '2026-09-18T12:00:00Z' }, // 8 days (historical archive)
  ];
  const liveMetrics = calculateAggregateLatencyMetrics(sampleArticles, { maxLatencyHours: 24 });
  assert('TEST F - Live Metrics count excludes archives', String(liveMetrics.count), '2');
  assert('TEST F - Archival count', String(liveMetrics.archivalCount), '2');
  assert('TEST F - Live Avg latency not distorted', liveMetrics.formattedAverage, '1m 45s'); // (90 + 120) / 2 = 105s = 1m 45s

  // USER SCENARIO TEST G: Anomaly excluded from aggregate
  const anomalyArticles = [
    { published_at: '2026-09-19T10:00:00Z', ingested_at: '2026-09-19T10:01:00Z' }, // 60s
    { published_at: '2026-09-19T10:05:00Z', ingested_at: '2026-09-19T10:02:00Z' }, // -180s anomaly
  ];
  const anomalyMetrics = calculateAggregateLatencyMetrics(anomalyArticles);
  assert('TEST G - Valid count excludes anomaly', String(anomalyMetrics.count), '1');
  assert('TEST G - Anomaly recorded', String(anomalyMetrics.anomalyCount), '1');
  assert('TEST G - Average reflects only valid', anomalyMetrics.formattedAverage, '1m');

  // TEST H: NIST Linear Interpolation P95 mathematical check
  // With 20 values from 10s to 200s (step 10s):
  // N = 20. Rank = (20 - 1) * 0.95 = 19 * 0.95 = 18.05
  // low = 18 (value 190s), high = 19 (value 200s), weight = 0.05
  // P95 = 190 + 0.05 * (200 - 190) = 190 + 0.5 = 190.5 => 191s (3m 11s)
  const twentyArticles = Array.from({ length: 20 }, (_, i) => ({
    published_at: '2026-09-19T10:00:00Z',
    ingested_at: new Date(new Date('2026-09-19T10:00:00Z').getTime() + (i + 1) * 10 * 1000).toISOString()
  }));
  const p95Test = calculateAggregateLatencyMetrics(twentyArticles);
  assert('TEST H - Linear Interpolation P95 seconds', String(p95Test.p95Seconds), '191');
  assert('TEST H - Formatted P95', p95Test.formattedP95, '3m 11s');

  const allPassed = results.every(r => r.passed);
  console.log(`\n========================================`);
  console.log(`Summary: ${results.filter(r => r.passed).length}/${results.length} tests passed.`);
  console.log(`========================================\n`);

  return allPassed;
}

if (typeof window === 'undefined') {
  runAcceptanceTests();
}

export { runAcceptanceTests };
