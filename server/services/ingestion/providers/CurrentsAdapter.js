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

export class CurrentsAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'currents',
      displayName: 'Currents Global News API',
      fetchMode: 'POLL',
      intervalMs: options.intervalMs || 10 * 60 * 1000,
      priority: 2
    });
    this.apiKey = options.apiKey || (process.env.CURRENTS_API_KEY || '').trim();
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

    const query = 'Infosys OR TCS OR Wipro OR Accenture';
    const startDate = this.lastCursor || new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const res = await axios.get('https://api.currentsapi.services/v1/search', {
      params: {
        keywords: query,
        language: 'en',
        apiKey: this.apiKey,
        start_date: startDate
      },
      headers: {
        'User-Agent': 'VeeAlert/2.0 (Realtime News Architecture)'
      },
      timeout: this.timeoutMs
    });

    const articles = res.data?.news || [];

    if (articles.length > 0) {
      const newestDate = articles
        .map(a => a.published)
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

    const publishedAt = raw.published ? new Date(raw.published).toISOString() : null;
    const now = new Date().toISOString();
    let publisherDomain = null;
    try {
      publisherDomain = new URL(raw.url).hostname.replace(/^www\./, '');
    } catch (_) {}

    return {
      providerArticleId: String(raw.id || raw.url),
      provider: 'currents',
      publisher: raw.author || publisherDomain || 'Currents Wire',
      publisherDomain: publisherDomain || 'currentsapi.services',
      title: cleanHtml(raw.title),
      url: raw.url,
      canonicalUrl: raw.url,
      description: cleanHtml(raw.description || ''),
      content: cleanHtml(raw.description || raw.title),
      image: (raw.image && raw.image !== 'None' && String(raw.image).startsWith('http')) ? raw.image : null,
      language: raw.language || 'en',
      country: null,
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
