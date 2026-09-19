/**
 * Detection Latency Calculation and Formatting Utility
 *
 * Formula:
 * DETECTION LATENCY = DETECTED TIME - PUBLISHED TIME
 *
 * Target: <= 120 seconds (2 minutes)
 * Classification:
 *   <= 120s -> WITHIN TARGET ("✓ WITHIN 2m TARGET")
 *   > 120s  -> ABOVE TARGET ("⚠ ABOVE 2m TARGET")
 *
 * Data-quality safeguards:
 *   - Missing published or detected -> "Unavailable"
 *   - detectedAt == publishedAt -> "0s", "✓ WITHIN 2m TARGET"
 *   - detectedAt < publishedAt -> "Timestamp anomaly" (clock skew / bad data)
 */

export interface DetectionLatencyResult {
  diffSeconds: number | null;
  formattedLatency: string;
  status: 'WITHIN_TARGET' | 'ABOVE_TARGET' | 'ANOMALY' | 'UNAVAILABLE';
  statusBadgeText: string;
  isAnomaly: boolean;
  clockSkewSeconds?: number;
  publishedUtc?: string;
  detectedUtc?: string;
  targetText: string;
  statusText: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a Date object into a readable UTC string:
 * "Sep 19, 2026 • 08:01:45 UTC"
 */
export function formatUtcTimestamp(date: Date): string {
  const month = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${month} ${day}, ${year} • ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Formats a duration in whole seconds into compact human-readable duration:
 * Examples:
 *   0s
 *   42s
 *   45s
 *   1m 12s
 *   1m 59s
 *   2m (for 120s)
 *   2m 1s
 *   4m 21s
 *   1h 35m
 *   1d 3h
 */
export function formatDurationCompact(totalSeconds: number): string {
  const s = Math.floor(Math.abs(totalSeconds));

  // 0 - 59 seconds
  if (s < 60) {
    return `${s}s`;
  }

  // 60 - 3599 seconds (minutes range)
  if (s < 3600) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  // 1 hour to < 24 hours
  if (s < 86400) {
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // 24 hours+
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/**
 * Calculates the detection latency between publication and ingestion timestamps.
 * Normalizes both to UTC milliseconds before computing the difference.
 */
export function calculateDetectionLatency(
  publishedRaw?: string | number | Date | null,
  detectedRaw?: string | number | Date | null
): DetectionLatencyResult {
  const defaultTarget = '≤ 2m';

  // Case 1 & 2: Missing or invalid timestamps
  if (!publishedRaw || !detectedRaw) {
    return {
      diffSeconds: null,
      formattedLatency: 'Unavailable',
      status: 'UNAVAILABLE',
      statusBadgeText: 'Unavailable',
      isAnomaly: false,
      targetText: defaultTarget,
      statusText: 'UNAVAILABLE'
    };
  }

  const pubDate = new Date(publishedRaw);
  const detDate = new Date(detectedRaw);

  const pubTime = pubDate.getTime();
  const detTime = detDate.getTime();

  if (isNaN(pubTime) || isNaN(detTime)) {
    return {
      diffSeconds: null,
      formattedLatency: 'Unavailable',
      status: 'UNAVAILABLE',
      statusBadgeText: 'Unavailable',
      isAnomaly: false,
      targetText: defaultTarget,
      statusText: 'UNAVAILABLE'
    };
  }

  const publishedUtc = formatUtcTimestamp(pubDate);
  const detectedUtc = formatUtcTimestamp(detDate);

  // Difference in seconds
  const diffMs = detTime - pubTime;
  const diffSeconds = Math.round(diffMs / 1000);

  // Case 4: detectedAt < publishedAt (Anomaly / clock skew)
  if (diffSeconds < 0) {
    const clockSkewSec = Math.abs(diffSeconds);
    return {
      diffSeconds,
      formattedLatency: 'Timestamp anomaly',
      status: 'ANOMALY',
      statusBadgeText: clockSkewSec <= 15 ? `⚠ ${clockSkewSec}s clock skew` : '⚠ Timestamp anomaly',
      isAnomaly: true,
      clockSkewSeconds: clockSkewSec,
      publishedUtc,
      detectedUtc,
      targetText: defaultTarget,
      statusText: 'TIMESTAMP ANOMALY'
    };
  }

  // Case 3: publishedAt == detectedAt (diffSeconds === 0)
  // or positive latency
  const formattedLatency = formatDurationCompact(diffSeconds);
  const isWithinTarget = diffSeconds <= 120;

  return {
    diffSeconds,
    formattedLatency,
    status: isWithinTarget ? 'WITHIN_TARGET' : 'ABOVE_TARGET',
    statusBadgeText: isWithinTarget ? '✓ WITHIN 2m TARGET' : '⚠ ABOVE 2m TARGET',
    isAnomaly: false,
    publishedUtc,
    detectedUtc,
    targetText: defaultTarget,
    statusText: isWithinTarget ? 'WITHIN TARGET' : 'ABOVE TARGET'
  };
}

export interface AggregateLatencyOptions {
  /**
   * Maximum latency in hours to consider for live operational velocity.
   * Articles with latency greater than this (e.g. 2,000-day archival search results from Google RSS)
   * are historical archive articles and excluded from live velocity metrics.
   * Default: 24 hours.
   */
  maxLatencyHours?: number | null;
  /**
   * Only include articles published within the last N hours from now.
   * Default: null (no publication age limit unless specified).
   */
  publishedWithinHours?: number | null;
  /**
   * Custom label describing the scope of the evaluation.
   */
  scopeLabel?: string;
}

export interface AggregateLatencyResult {
  count: number;
  totalArticlesConsidered: number;
  anomalyCount: number;
  archivalCount: number;
  averageSeconds: number | null;
  p95Seconds: number | null;
  formattedAverage: string;
  formattedP95: string;
  scopeLabel: string;
}

/**
 * Calculates aggregate detection latency metrics (Average and P95)
 * strictly across articles with valid positive latencies in the operational live window.
 * Uses NIST/standard linear interpolation for deterministic P95 calculation.
 */
export function calculateAggregateLatencyMetrics(
  articles: Array<{
    published_at?: string;
    publishedAt?: string;
    ingested_at?: string;
    detected_at?: string;
    detectedAt?: string;
    sla?: { publishedAt?: string };
  }>,
  options: AggregateLatencyOptions = {}
): AggregateLatencyResult {
  const maxLatencySec = options.maxLatencyHours != null
    ? options.maxLatencyHours * 3600
    : 24 * 3600; // default 24h operational ceiling

  const now = Date.now();
  const maxPubAgeMs = options.publishedWithinHours != null
    ? options.publishedWithinHours * 3600 * 1000
    : null;

  const validLatencies: number[] = [];
  let anomalyCount = 0;
  let archivalCount = 0;

  for (const a of articles) {
    const pub = a.published_at || a.publishedAt || a.sla?.publishedAt;
    const det = a.ingested_at || a.detected_at || a.detectedAt;
    const res = calculateDetectionLatency(pub, det);

    if (res.diffSeconds === null) {
      continue;
    }

    if (res.diffSeconds < 0) {
      anomalyCount++;
      continue;
    }

    // Check published age if option provided
    if (maxPubAgeMs !== null && pub) {
      const pubTime = new Date(pub).getTime();
      if (!isNaN(pubTime) && (now - pubTime) > maxPubAgeMs) {
        archivalCount++;
        continue;
      }
    }

    // Check operational latency ceiling to exclude multi-year archive backfills
    if (maxLatencySec !== null && res.diffSeconds > maxLatencySec) {
      archivalCount++;
      continue;
    }

    validLatencies.push(res.diffSeconds);
  }

  const scopeLabel = options.scopeLabel || (maxLatencySec ? 'Last 24 hours' : 'All Stream');

  if (validLatencies.length === 0) {
    return {
      count: 0,
      totalArticlesConsidered: articles.length,
      anomalyCount,
      archivalCount,
      averageSeconds: null,
      p95Seconds: null,
      formattedAverage: 'N/A',
      formattedP95: 'N/A',
      scopeLabel
    };
  }

  // 1. Sort ascending for deterministic metrics
  validLatencies.sort((a, b) => a - b);

  // 2. Exact Average
  const sum = validLatencies.reduce((acc, curr) => acc + curr, 0);
  const averageSeconds = Math.round(sum / validLatencies.length);

  // 3. NIST / Standard Linear Interpolation Percentile (P95)
  // R = (N - 1) * 0.95
  // P = v[low] + (R - low) * (v[high] - v[low])
  let p95Seconds: number;
  const n = validLatencies.length;
  if (n === 1) {
    p95Seconds = validLatencies[0];
  } else {
    const rank = (n - 1) * 0.95;
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    const weight = rank - low;
    p95Seconds = Math.round(
      validLatencies[low] + weight * (validLatencies[high] - validLatencies[low])
    );
  }

  return {
    count: validLatencies.length,
    totalArticlesConsidered: articles.length,
    anomalyCount,
    archivalCount,
    averageSeconds,
    p95Seconds,
    formattedAverage: formatDurationCompact(averageSeconds),
    formattedP95: formatDurationCompact(p95Seconds),
    scopeLabel
  };
}
