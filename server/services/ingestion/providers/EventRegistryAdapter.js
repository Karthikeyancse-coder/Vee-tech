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

export class EventRegistryAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'eventregistry',
      displayName: 'Event Registry (Minute Stream)',
      fetchMode: 'MINUTE_STREAM',
      intervalMs: options.intervalMs || 60000,
      priority: 1
    });
    this.apiKey = options.apiKey || (process.env.EVENT_REGISTRY_API_KEY || '').trim();
    this.newestUri = null;
  }

  getCursor() {
    return this.newestUri;
  }

  saveCursor(cursor) {
    this.newestUri = cursor;
  }

  async fetch() {
    if (!this.apiKey) {
      this.metrics.status = 'DISABLED';
      return [];
    }

    // Use minuteStreamArticles if available, else getArticles
    try {
      const params = {
        apiKey: this.apiKey,
        articlesPage: 1,
        articlesCount: 20,
        articlesSortBy: 'date',
        articlesSortByAsc: false,
        keyword: ['Infosys', 'Tata Consultancy Services', 'Wipro', 'Accenture'],
        keywordOper: 'or',
        lang: 'eng'
      };

      const res = await axios.post('https://eventregistry.org/api/v1/article/getArticles', params, {
        timeout: this.timeoutMs,
        headers: { 'Content-Type': 'application/json' }
      });

      const articles = res.data?.articles?.results || [];

      if (articles.length > 0 && articles[0].uri) {
        this.saveCursor(articles[0].uri);
      }

      return articles;
    } catch (err) {
      throw err;
    }
  }

  normalize(raw) {
    if (!raw || !raw.title || !raw.url) return null;

    const publishedAt = raw.dateTime ? new Date(raw.dateTime).toISOString() : (raw.date ? new Date(raw.date).toISOString() : null);
    const now = new Date().toISOString();
    let publisherDomain = null;
    try {
      publisherDomain = new URL(raw.url).hostname.replace(/^www\./, '');
    } catch (_) {}

    return {
      providerArticleId: String(raw.uri || raw.url),
      provider: 'eventregistry',
      publisher: raw.source?.title || publisherDomain || 'Event Registry Wire',
      publisherDomain: publisherDomain || 'eventregistry.org',
      title: cleanHtml(raw.title),
      url: raw.url,
      canonicalUrl: raw.url,
      description: cleanHtml(raw.body?.slice(0, 300) || ''),
      content: cleanHtml(raw.body || raw.title),
      image: raw.image || null,
      language: raw.lang || 'en',
      country: null,
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
