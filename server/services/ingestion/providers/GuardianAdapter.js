import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { ProviderAdapter } from '../ProviderAdapter.js';

const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

export class GuardianAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'guardian',
      displayName: 'The Guardian Content API',
      fetchMode: 'POLL',
      intervalMs: options.intervalMs || 45000,
      priority: 2
    });
    this.apiKey = options.apiKey || (process.env.GUARDIAN_API_KEY || '').trim();
    this.lastCursor = null;
  }

  getCursor() {
    return this.lastCursor;
  }

  saveCursor(cursor) {
    this.lastCursor = cursor;
  }

  async fetch() {
    if (Date.now() < this.cooldownUntil) {
      const remainingSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      console.log(`[ProviderAdapter:${this.providerName}] ⏭ Skipped fetch — ${remainingSec}s remaining in cooldown`);
      return [];
    }

    if (!this.apiKey) {
      this.metrics.status = 'DISABLED';
      return [];
    }

    const query = encodeURIComponent('(Infosys OR "Tata Consultancy Services" OR TCS OR Wipro OR Accenture)');
    // Restrict strictly to 12-hour recency window
    const maxAgeMs = 12 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;
    const fallbackFrom = new Date(cutoffTime).toISOString().split('T')[0];
    const fromDate = (this.lastCursor && new Date(this.lastCursor).getTime() > cutoffTime)
      ? new Date(this.lastCursor).toISOString().split('T')[0]
      : fallbackFrom;
    const url = `https://content.guardianapis.com/search?q=${query}&show-fields=headline,byline,trailText,bodyText,thumbnail&order-by=newest&page-size=15&from-date=${encodeURIComponent(fromDate)}&api-key=${this.apiKey}`;

    const maxRetries = 3;
    let res = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        res = await axios.get(url, {
          timeout: this.timeoutMs,
          httpAgent,
          httpsAgent,
          headers: { 'Accept': 'application/json' }
        });
        break;
      } catch (err) {
        const isConnReset = err.code === 'ECONNRESET' ||
                            err.message?.includes('ECONNRESET') ||
                            (err.code === 'ETIMEDOUT' && err.message?.includes('socket'));

        if (isConnReset && attempt < maxRetries) {
          const backoffMs = attempt * 1000;
          console.warn(`[GuardianAdapter] ⚠️ Connection reset (${err.code || err.message}). Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
        throw err;
      }
    }

    const rawResults = res.data?.response?.results || [];

    // Filter results through 12-hour recency guardrail
    const results = rawResults.filter(r => {
      if (!r.webPublicationDate) return true;
      const pubTime = new Date(r.webPublicationDate).getTime();
      if (isNaN(pubTime)) return true;
      const ageHours = (Date.now() - pubTime) / (3600 * 1000);
      if (ageHours > 12) {
        const ageDesc = ageHours >= 48 ? `${(ageHours / 24).toFixed(1)} days` : `${ageHours.toFixed(1)} hours`;
        console.log(`[GuardianAdapter] 🚫 DROPPED STALE: "${(r.webTitle || '').slice(0, 50)}..." (published ${ageDesc} ago exceeds 12h window)`);
        return false;
      }
      return true;
    });

    if (results.length > 0) {
      // Update cursor to newest publication date
      const newestDate = results
        .map(r => r.webPublicationDate)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      if (newestDate) {
        this.saveCursor(newestDate);
      }
    }

    return results;
  }

  normalize(raw) {
    if (!raw || !raw.webTitle || !raw.webUrl) return null;

    const fields = raw.fields || {};
    const publishedAt = raw.webPublicationDate ? new Date(raw.webPublicationDate).toISOString() : null;
    const now = new Date().toISOString();

    return {
      providerArticleId: String(raw.id || raw.webUrl),
      provider: 'guardian',
      publisher: 'The Guardian',
      publisherDomain: 'theguardian.com',
      title: fields.headline || raw.webTitle,
      url: raw.webUrl,
      canonicalUrl: raw.webUrl,
      description: fields.trailText || null,
      content: fields.bodyText || fields.trailText || raw.webTitle,
      image: fields.thumbnail || null,
      language: 'en',
      country: 'GB',
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
