import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProviderAdapter } from '../ProviderAdapter.js';

const TARGET_REGEX = /(Infosys|Infosys\s+ADR|NYSE:\s*INFY|TCS|Tata\s+Consultancy|Wipro|Wipro\s+ADR|Accenture|Finacle)/i;
const MAX_ARTICLES_PER_FEED = 12;

export class GoogleRssAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'googlenews',
      displayName: 'Google News RSS (Verified Wire)',
      fetchMode: 'RSS',
      intervalMs: options.intervalMs || 20000,
      priority: 3
    });
    this.seenGuids = new Set();
    this.maxGuids = 1000;
  }

  _isSeenGuid(guid) {
    if (!guid) return false;
    if (this.seenGuids.has(guid)) return true;
    if (this.seenGuids.size >= this.maxGuids) {
      const oldest = this.seenGuids.values().next().value;
      if (oldest) this.seenGuids.delete(oldest);
    }
    this.seenGuids.add(guid);
    return false;
  }

  buildUrl() {
    const query = encodeURIComponent(
      '(Infosys OR "Infosys ADR" OR "NYSE: INFY" OR TCS OR "Tata Consultancy Services" OR Wipro OR "Wipro ADR" OR Accenture OR Finacle) when:2h'
    );
    return `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en&_cb=${Date.now()}`;
  }

  async fetch() {
    const url = this.buildUrl();
    const res = await axios.get(url, {
      timeout: 8000, // 8s timeout to avoid false aborts during peak activity
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    const $ = cheerio.load(res.data, { xmlMode: true });
    const items = $('item').toArray().slice(0, MAX_ARTICLES_PER_FEED);
    const freshItems = [];

    for (const el of items) {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const guid = $(el).find('guid').text().trim() || link;
      const pubDate = $(el).find('pubDate').text().trim();
      const rawDesc = $(el).find('description').text();
      const sourceName = $(el).find('source').text().trim() || 'Google News';

      if (!title || !link) continue;
      if (this._isSeenGuid(guid)) continue;
      if (!TARGET_REGEX.test(title) && !TARGET_REGEX.test(rawDesc)) continue;

      let imageUrl = null;
      if (rawDesc) {
        try {
          const $desc = cheerio.load(rawDesc);
          imageUrl = $desc('img').attr('src') || null;
        } catch {}
      }

      freshItems.push({
        guid,
        title,
        link,
        pubDate,
        rawDesc,
        sourceName,
        imageUrl
      });
    }

    return freshItems;
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
      providerArticleId: raw.guid || raw.link,
      provider: 'googlenews',
      publisher: raw.sourceName || 'Google News RSS',
      publisherDomain: 'news.google.com',
      title: raw.title,
      url: raw.link,
      canonicalUrl: raw.link,
      description: raw.rawDesc ? cheerio.load(raw.rawDesc).text().trim() : null,
      content: raw.rawDesc ? cheerio.load(raw.rawDesc).text().trim() : raw.title,
      image: raw.imageUrl || null,
      language: 'en',
      country: 'IN',
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
