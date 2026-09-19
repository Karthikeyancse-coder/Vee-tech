import EventEmitter from 'node:events';

/**
 * Base ProviderAdapter class
 *
 * Implements standard provider lifecycle, rate-limiting, exponential backoff,
 * health metric collection, and event emission.
 */
export class ProviderAdapter extends EventEmitter {
  /**
   * @param {object} config
   * @param {string} config.providerName Unique identifier (e.g. 'guardian', 'newsdata')
   * @param {string} config.displayName Human-readable name
   * @param {'STREAM' | 'MINUTE_STREAM' | 'POLL' | 'RSS'} config.fetchMode Ingestion pattern
   * @param {number} [config.intervalMs=30000] Polling interval in ms (for POLL/RSS)
   * @param {number} [config.timeoutMs=10000] Request timeout in ms
   * @param {number} [config.priority=2] P0 (Stream), P1 (Minute-stream), P2 (REST), P3 (RSS)
   */
  constructor(config) {
    super();
    this.providerName = config.providerName;
    this.displayName = config.displayName || config.providerName;
    this.fetchMode = config.fetchMode || 'POLL';
    this.intervalMs = config.intervalMs || 30000;
    this.timeoutMs = config.timeoutMs || 10000;
    this.priority = config.priority ?? 2;

    this.isRunning = false;
    this.timer = null;
    this.isFetching = false;
    this.cooldownUntil = 0;

    // Health Telemetry
    this.metrics = {
      status: 'INITIALIZING', // CONNECTED, HEALTHY, POLLING, DEGRADED, RATE_LIMITED, ERROR, DISABLED
      lastSuccessAt: null,
      lastFailureAt: null,
      lastArticleAt: null,
      lastLatencyMs: null,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      requests: 0,
      successCount: 0,
      errorCount: 0,
      rateLimitCount: 0,
      reconnectCount: 0,
      eventsPerMinute: 0,
      lastErrorMessage: null
    };

    this._latencyHistory = [];
    this._recentEvents = [];

    // Periodic eventsPerMinute calculation
    this._metricsInterval = setInterval(() => {
      const oneMinAgo = Date.now() - 60000;
      this._recentEvents = this._recentEvents.filter(t => t > oneMinAgo);
      this.metrics.eventsPerMinute = this._recentEvents.length;
    }, 15000);
    if (this._metricsInterval?.unref) {
      this._metricsInterval.unref();
    }
  }

  /**
   * Start provider ingestion
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.metrics.status = this.fetchMode === 'STREAM' ? 'CONNECTING' : 'POLLING';
    console.log(`[ProviderAdapter:${this.providerName}] 🚀 Starting adapter (${this.fetchMode}, priority P${this.priority})`);

    try {
      await this.onStart();
    } catch (err) {
      this.recordFailure(err);
    }

    if (this.fetchMode === 'POLL' || this.fetchMode === 'RSS' || this.fetchMode === 'MINUTE_STREAM') {
      this._scheduleNextPoll(100); // Trigger initial fetch quickly
    }
  }

  /**
   * Stop provider ingestion
   */
  async stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this._metricsInterval) {
      clearInterval(this._metricsInterval);
    }
    await this.onStop();
    this.metrics.status = 'DISABLED';
    console.log(`[ProviderAdapter:${this.providerName}] 🛑 Stopped adapter`);
  }

  /**
   * Internal loop scheduler for polling / minute-stream adapters
   */
  _scheduleNextPoll(delayMs = this.intervalMs) {
    if (!this.isRunning) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    let effectiveDelay = delayMs;
    // If currently cooling down, schedule the countdown check at reasonable intervals (max 30s)
    if (Date.now() < this.cooldownUntil) {
      const remainingMs = this.cooldownUntil - Date.now();
      effectiveDelay = Math.min(Math.max(remainingMs, 1000), 30000);
    }

    this.timer = setTimeout(async () => {
      this.timer = null;
      if (!this.isRunning) return;

      // Rate limit cooldown check — completely block network request during cooldown
      if (Date.now() < this.cooldownUntil) {
        const remainingSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
        console.log(`[ProviderAdapter:${this.providerName}] ⏳ In cooldown for another ${remainingSec}s`);
        this._scheduleNextPoll(Math.min(Math.max(remainingSec * 1000, 1000), 30000));
        return;
      }

      if (!this.isFetching) {
        this.isFetching = true;
        const start = Date.now();
        this.metrics.requests++;

        try {
          // Double-check cooldown before triggering network call
          if (Date.now() < this.cooldownUntil) {
            const remainingSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
            console.log(`[ProviderAdapter:${this.providerName}] ⏳ In cooldown for another ${remainingSec}s`);
            return;
          }

          const rawItems = await this.fetch();
          const latency = Date.now() - start;
          this.recordSuccess(latency, rawItems?.length || 0);

          if (Array.isArray(rawItems) && rawItems.length > 0) {
            for (const item of rawItems) {
              const normalized = this.normalize(item);
              if (normalized) {
                this._recentEvents.push(Date.now());
                this.emit('article', normalized);
              }
            }
          }
        } catch (err) {
          this.recordFailure(err);
        } finally {
          this.isFetching = false;
        }
      }

      // Schedule next poll: if cooldown was activated during fetch, use cooldown countdown delay
      if (Date.now() < this.cooldownUntil) {
        const remainingMs = this.cooldownUntil - Date.now();
        this._scheduleNextPoll(Math.min(Math.max(remainingMs, 1000), 30000));
      } else {
        this._scheduleNextPoll(this.intervalMs);
      }
    }, effectiveDelay);
  }

  /**
   * Records a successful fetch or stream event
   */
  recordSuccess(latencyMs, count = 1) {
    this.metrics.successCount++;
    this.metrics.lastSuccessAt = new Date().toISOString();
    this.metrics.status = this.fetchMode === 'STREAM' ? 'CONNECTED' : 'HEALTHY';
    this.metrics.lastErrorMessage = null;

    if (count > 0) {
      this.metrics.lastArticleAt = new Date().toISOString();
    }

    if (latencyMs != null && latencyMs >= 0) {
      this.metrics.lastLatencyMs = latencyMs;
      this._latencyHistory.push(latencyMs);
      if (this._latencyHistory.length > 50) this._latencyHistory.shift();

      const sum = this._latencyHistory.reduce((a, b) => a + b, 0);
      this.metrics.averageLatencyMs = Math.round(sum / this._latencyHistory.length);

      const sorted = [...this._latencyHistory].sort((a, b) => a - b);
      const p95Idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
      this.metrics.p95LatencyMs = sorted[p95Idx] || latencyMs;
    }
  }

  /**
   * Records an error and triggers rate-limit backoff if applicable
   */
  recordFailure(error) {
    this.metrics.errorCount++;
    this.metrics.lastFailureAt = new Date().toISOString();
    this.metrics.lastErrorMessage = error.message;

    const status = error.response?.status;

    if (status === 429) {
      this.metrics.rateLimitCount++;
      this.metrics.status = 'RATE_LIMITED';

      // Check Retry-After header — some APIs (e.g. Currents) send a Unix epoch
      // timestamp instead of a seconds-duration. Detect and convert accordingly.
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      let cooldownSec = 120; // default 2 minutes
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed)) {
          if (parsed > 86400) {
            // This looks like a Unix epoch timestamp, not a duration.
            // Convert: epoch_value - now_seconds = seconds until that time.
            const nowSec = Math.floor(Date.now() / 1000);
            const durationSec = parsed - nowSec;
            cooldownSec = durationSec > 0 ? Math.min(durationSec, 900) : 120; // cap at 15 min
          } else {
            cooldownSec = Math.min(Math.max(parsed, 10), 900); // clamp: 10s <= x <= 15min
          }
        }
      }
      this.cooldownUntil = Date.now() + cooldownSec * 1000;
      console.warn(`[ProviderAdapter:${this.providerName}] ⚠️ 429 Rate Limited. Cooling down for ${cooldownSec}s (raw Retry-After: "${retryAfterHeader || 'none'}").`);
    } else if (status === 401 || status === 403) {
      this.metrics.status = 'DEGRADED';
      this.cooldownUntil = Date.now() + 300 * 1000; // 5 min cooldown
      console.warn(`[ProviderAdapter:${this.providerName}] ⚠️ ${status} Auth / Quota Limit. Cooling down for 5min.`);
    } else {
      this.metrics.status = 'ERROR';
      console.warn(`[ProviderAdapter:${this.providerName}] ⚠️ Error: ${error.message}`);
    }
  }

  /**
   * Health snapshot for telemetry APIs
   */
  getHealth() {
    return {
      providerName: this.providerName,
      displayName: this.displayName,
      fetchMode: this.fetchMode,
      priority: this.priority,
      intervalMs: this.intervalMs,
      ...this.metrics
    };
  }

  // Hook methods to be overridden by subclasses
  async onStart() {}
  async onStop() {}
  async fetch() { return []; }
  normalize(_raw) { return null; }
  getCursor() { return null; }
  saveCursor(_cursor) {}
  async reconnect() {}
}
