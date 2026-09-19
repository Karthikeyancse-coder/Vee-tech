import axios from 'axios';
import { ProviderAdapter } from '../ProviderAdapter.js';

function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export class NewsApiAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'newsapi',
      displayName: 'NewsAPI (Global Aggregator)',
      fetchMode: 'POLL',
      // NewsAPI free tier allows 100 requests / 24 hours. Poll every 15 minutes.
      intervalMs: options.intervalMs || 15 * 60 * 1000,
      priority: 2
    });
    this.apiKey = options.apiKey || (process.env.NEWSAPI_KEY || '').trim();
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

    const query = '(Infosys OR "Tata Consultancy Services" OR Wipro OR Accenture)';
    const fromParam = this.lastCursor || new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 20,
        from: fromParam
      },
      headers: {
        'X-Api-Key': this.apiKey,
        'User-Agent': 'VeeAlert/2.0 (Realtime News Architecture)'
      },
      timeout: this.timeoutMs
    });

    const articles = res.data?.articles || [];

    if (articles.length > 0) {
      const newestDate = articles
        .map(a => a.publishedAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      if (newestDate) {
        this.saveCursor(newestDate);
      }
    }

    return articles;
  }

  normalize(raw) {
    if (!raw || !raw.title || !raw.url || raw.title.includes('[Removed]')) return null;

    const publishedAt = raw.publishedAt ? new Date(raw.publishedAt).toISOString() : null;
    const now = new Date().toISOString();
    let publisherDomain = null;
    try {
      publisherDomain = new URL(raw.url).hostname.replace(/^www\./, '');
    } catch (_) {}

    return {
      providerArticleId: String(raw.url),
      provider: 'newsapi',
      publisher: raw.source?.name || publisherDomain || 'NewsAPI Wire',
      publisherDomain: publisherDomain || 'newsapi.org',
      title: cleanHtml(raw.title),
      url: raw.url,
      canonicalUrl: raw.url,
      description: cleanHtml(raw.description || ''),
      content: cleanHtml(raw.content || raw.description || raw.title),
      image: raw.urlToImage || null,
      language: 'en',
      country: null,
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
