import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProviderAdapter } from '../ProviderAdapter.js';

const TARGET_REGEX = /(Infosys|Infosys\s+ADR|NYSE:\s*INFY|TCS|Tata\s+Consultancy|Wipro|Wipro\s+ADR|Accenture|Finacle)/i;

const FEEDS = [
  { name: 'The Economic Times Tech', url: 'https://economictimes.indiatimes.com/tech/ites/rssfeeds/13357555.cms' },
  { name: 'The Economic Times Top Stories', url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms' },
  { name: 'Livemint Companies', url: 'https://www.livemint.com/rss/companies' },
  { name: 'Livemint News', url: 'https://www.livemint.com/rss/news' },
  { name: 'Business Standard Companies', url: 'https://www.business-standard.com/rss/companies-101.rss' },
  { name: 'Business Standard Latest', url: 'https://www.business-standard.com/rss/latest.rss' },
  { name: 'The Hindu Business Line', url: 'https://www.thehindubusinessline.com/news/feeder/default.rss' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'NDTV Profit', url: 'https://feeds.feedburner.com/ndtvprofit-latest' },
  { name: 'YourStory', url: 'https://yourstory.com/feed' },
  { name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms' }
];

const MAX_ITEMS_PER_FEED = 30;
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

export class InstitutionalRssAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({
      providerName: 'institutional',
      displayName: 'Institutional Publisher Wires (ET, Mint, BS)',
      fetchMode: 'RSS',
      intervalMs: options.intervalMs || 30000,
      priority: 3
    });
    this.seenGuids = new Set();
  }

  _isSeen(guid) {
    if (!guid) return false;
    if (this.seenGuids.has(guid)) return true;
    if (this.seenGuids.size >= 1000) {
      const oldest = this.seenGuids.values().next().value;
      if (oldest) this.seenGuids.delete(oldest);
    }
    this.seenGuids.add(guid);
    return false;
  }

  async fetch() {
    if (Date.now() < this.cooldownUntil) {
      const remainingSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
      console.log(`[ProviderAdapter:${this.providerName}] ⏭ Skipped fetch — ${remainingSec}s remaining in cooldown`);
      return [];
    }

    // Stagger feed batches to avoid saturating the DNS resolver and TCP connection
    // ramp simultaneously — feeds launched all-at-once compete for the same socket
    // pool and all time out together. Batching 3 at a time with a 500ms gap spreads
    // the connection load cleanly across time.
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 500;
    const PER_FEED_TIMEOUT = 12000; // 12s — accommodates slow publisher CDNs

    const allItems = [];

    for (let batchStart = 0; batchStart < FEEDS.length; batchStart += BATCH_SIZE) {
      const batch = FEEDS.slice(batchStart, batchStart + BATCH_SIZE);

      const batchPromises = batch.map(async (feed) => {
        try {
          const res = await axios.get(feed.url, {
            timeout: PER_FEED_TIMEOUT,
            httpAgent,
            httpsAgent,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
            }
          });
          return { feed, data: res.data, ok: true };
        } catch (err) {
          console.warn(`[InstitutionalRss] ⚠️ ${feed.name} skipped: ${err.message}`);
          return { feed, data: null, ok: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'rejected') continue;
        const { feed, data, ok } = result.value;
        if (!ok || !data) continue;

        try {
          const $ = cheerio.load(data, { xmlMode: true });
          const items = $('item').toArray().slice(0, MAX_ITEMS_PER_FEED);

          for (const el of items) {
            const title = $(el).find('title').text().trim();
            const link = $(el).find('link').text().trim();
            const guid = $(el).find('guid').text().trim() || link;
            const pubDate = $(el).find('pubDate').text().trim();
            const rawDesc = $(el).find('description').text();

            if (!title || !link) continue;
            if (this._isSeen(guid)) continue;
            if (!TARGET_REGEX.test(title) && !TARGET_REGEX.test(rawDesc)) continue;

            // Recency guardrail: Reject any item published > 12 hours ago
            if (pubDate) {
              const pubTime = new Date(pubDate).getTime();
              if (!isNaN(pubTime)) {
                const ageHours = (Date.now() - pubTime) / (3600 * 1000);
                if (ageHours > 12) {
                  const ageDesc = ageHours >= 48 ? `${(ageHours / 24).toFixed(1)} days` : `${ageHours.toFixed(1)} hours`;
                  console.log(`[InstitutionalRss] 🚫 DROPPED STALE: "${title.slice(0, 50)}..." (published ${ageDesc} ago exceeds 12h window)`);
                  continue;
                }
              }
            }

            allItems.push({ guid, title, link, pubDate, rawDesc, sourceName: feed.name });
          }
        } catch (err) {
          console.warn(`[InstitutionalRss] ⚠️ Error parsing ${feed.name}: ${err.message}`);
        }
      }

      // Pause between batches to avoid the next batch competing for same connections
      if (batchStart + BATCH_SIZE < FEEDS.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    return allItems;
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
      provider: 'institutional',
      publisher: raw.sourceName,
      publisherDomain: raw.sourceName.toLowerCase().includes('economic') ? 'economictimes.indiatimes.com' : 'livemint.com',
      title: raw.title,
      url: raw.link,
      canonicalUrl: raw.link,
      description: raw.rawDesc ? cheerio.load(raw.rawDesc).text().trim() : null,
      content: raw.rawDesc ? cheerio.load(raw.rawDesc).text().trim() : raw.title,
      image: null,
      language: 'en',
      country: 'IN',
      publishedAt,
      providerAvailableAt: publishedAt,
      receivedAt: now,
      ingestedAt: now
    };
  }
}
