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

export class GNewsAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'gnews',
      displayName: 'GNews AI-Curated Wire',
      fetchMode: 'POLL',
      intervalMs: options.intervalMs || 15 * 60 * 1000,
      priority: 2
    });
    this.apiKey = options.apiKey || (process.env.GNEWS_API_KEY || '').trim();
    this.lastCursor = null;
  }

  getCursor() {
    return this.lastCursor;
  }

  saveCursor(cursor) {
    this.lastCursor = cursor;
  }

  async fetch() {
    if (!this.apiKey) {
      this.metrics.status = 'DISABLED';
      return [];
    }

    // Cooldown gate: abort network request immediately if in cooldown
    if (Date.now() < this.cooldownUntil) {
      const remainingSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      console.log(`[ProviderAdapter:${this.providerName}] ⏳ In cooldown for another ${remainingSec}s`);
      return [];
    }

    const query = '(Infosys OR "Tata Consultancy Services" OR Wipro OR Accenture)';
    const fromParam = this.lastCursor || new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const res = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: query,
        lang: 'en',
        sortby: 'publishedAt',
        max: 10,
        apikey: this.apiKey,
        from: fromParam
      },
      headers: {
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
    if (!raw || !raw.title || !raw.url) return null;

    const publishedAt = raw.publishedAt ? new Date(raw.publishedAt).toISOString() : null;
    const now = new Date().toISOString();
    let publisherDomain = null;
    try {
      publisherDomain = new URL(raw.url).hostname.replace(/^www\./, '');
    } catch (_) {}

    return {
      providerArticleId: String(raw.url),
      provider: 'gnews',
      publisher: raw.source?.name || publisherDomain || 'GNews Wire',
      publisherDomain: publisherDomain || 'gnews.io',
      title: cleanHtml(raw.title),
      url: raw.url,
      canonicalUrl: raw.url,
      description: cleanHtml(raw.description || ''),
      content: cleanHtml(raw.content || raw.description || raw.title),
      image: raw.image || null,
      language: 'en',
      country: null,
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
