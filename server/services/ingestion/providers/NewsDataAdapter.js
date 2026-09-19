import axios from 'axios';
import { ProviderAdapter } from '../ProviderAdapter.js';

export class NewsDataAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'newsdata',
      displayName: 'NewsData.io Real-Time Wire',
      fetchMode: 'POLL', // Supports STREAM when registration succeeds
      intervalMs: options.intervalMs || 60000,
      priority: 1
    });
    this.apiKey = options.apiKey || (process.env.NEWSDATA_API_KEY || '').trim();
    this.lastCursor = null;
    this.wsClient = null;
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

    // REST latest endpoint
    const query = encodeURIComponent('(Infosys OR TCS OR Wipro OR Accenture)');
    const url = `https://newsdata.io/api/1/latest?apikey=${this.apiKey}&q=${query}&language=en`;

    const res = await axios.get(url, {
      timeout: this.timeoutMs,
      headers: { 'Accept': 'application/json' }
    });

    const results = res.data?.results || [];

    if (results.length > 0) {
      const newestDate = results
        .map(r => r.pubDate)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      if (newestDate) {
        this.saveCursor(newestDate);
      }
    }

    return results;
  }

  normalize(raw) {
    if (!raw || !raw.title || !raw.link) return null;

    let publishedAt = null;
    if (raw.pubDate) {
      const d = new Date(raw.pubDate);
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    const now = new Date().toISOString();

    return {
      providerArticleId: String(raw.article_id || raw.link),
      provider: 'newsdata',
      publisher: raw.source_id || raw.source_name || 'NewsData Wire',
      publisherDomain: raw.source_url ? new URL(raw.source_url).hostname : null,
      title: raw.title,
      url: raw.link,
      canonicalUrl: raw.link,
      description: raw.description || null,
      content: raw.content || raw.description || raw.title,
      image: raw.image_url || null,
      language: raw.language || 'en',
      country: Array.isArray(raw.country) ? raw.country[0] : raw.country,
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
