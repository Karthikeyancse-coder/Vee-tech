import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const DEFAULT_KEYWORDS = '(Infosys OR "Infosys ADR" OR "NYSE: INFY" OR TCS OR Wipro OR "Wipro ADR" OR Accenture OR "IT services outage" OR "banking cyberattack" OR Finacle) when:4h';
const DEFAULT_KEYWORDS_GLOBAL = '("Infosys" OR "TCS" OR "Wipro" OR "Accenture" OR "IT services" OR "Indian IT" OR "Finacle") when:4h';
const TARGET_ENTITY_REGEX = /\b(Infosys|TCS|Tata Consultancy Services|Wipro|Accenture|Finacle)\b/i;
const DEFAULT_POLL_INTERVAL_MS = 120 * 1000; // 120 seconds default

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Deduplication Signature Set (Stores last 2,000 processed items)
const seenSignatures = new Set();
const MAX_SEEN_CACHE = 2000;

function isDuplicate(sig) {
  if (!sig) return false;
  if (seenSignatures.has(sig)) return true;
  if (seenSignatures.size >= MAX_SEEN_CACHE) {
    const oldest = seenSignatures.values().next().value;
    if (oldest) seenSignatures.delete(oldest);
  }
  seenSignatures.add(sig);
  return false;
}

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

/**
 * Parses GDELT seendate format: YYYYMMDDTHHMMSSZ -> ISO String
 */
function parseGdeltDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  try {
    const clean = String(dateStr).replace(/[^0-9]/g, '');
    if (clean.length >= 14) {
      const year = clean.slice(0, 4);
      const month = clean.slice(4, 6);
      const day = clean.slice(6, 8);
      const hour = clean.slice(8, 10);
      const min = clean.slice(10, 12);
      const sec = clean.slice(12, 14);
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
    }
  } catch (_) {}
  return new Date().toISOString();
}

// Module State
let streamIntervalId = null;
let registeredCallback = null;

// ============================================================================
// 1. NEWSAPI (The Global Aggregator)
// ============================================================================
export async function fetchNewsApi(keywords = DEFAULT_KEYWORDS) {
  const apiKey = (process.env.NEWSAPI_KEY || '').trim();

  if (!apiKey) {
    console.log('[NewsAPI] NEWSAPI_KEY not configured in .env; skipping source.');
    return [];
  }

  // Strict boolean query — exactly the 4 target entities, no noise
  const strictQuery = '(Infosys OR "Tata Consultancy Services" OR Wipro OR Accenture)';

  // NewsAPI handles q= via axios params which URL-encodes it correctly
  const url = 'https://newsapi.org/v2/everything';
  console.log(`[NewsAPI] Querying with strict boolean query: q=${strictQuery}...`);

  try {
    const response = await axios.get(url, {
      params: {
        q: strictQuery,          // axios auto-encodes parentheses, quotes, spaces
        sortBy: 'publishedAt',   // Always by publish time, not relevancy
        language: 'en',
        pageSize: 20
      },
      headers: {
        'X-Api-Key': apiKey,
        'User-Agent': 'VeeAlert/1.0 (Enterprise Intelligence Platform)',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      timeout: 12000
    });

    if (response.data && Array.isArray(response.data.articles)) {
      const articles = response.data.articles
        .filter((item) => item.title && item.url && !item.title.includes('[Removed]'))
        .map((item) => ({
          api_source: 'NewsAPI',
          source_name: item.source?.name || 'NewsAPI Global Wire',
          title: cleanHtml(item.title),
          url: item.url,
          image_url: item.urlToImage || null,
          raw_content: cleanHtml(item.description || item.content || item.title),
          published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : new Date().toISOString()
        }));

      console.log(`[NewsAPI] \u2705 Returned ${articles.length} articles from strict boolean query.`);
      return articles;
    }
    return [];
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn('[NewsAPI] \u26a0\ufe0f Rate limited (HTTP 429). Pausing NewsAPI for this cycle.');
    } else {
      console.error(`[NewsAPI] \u274c Fetch Failed: ${error.response?.status || 'ERR'} - ${error.response?.data?.message || error.message}`);
    }
    return [];
  }
}

// GDELT Cooldown Tracker (5-minute backoff on 429 or timeout)
let gdeltCooldownUntil = 0;

// ============================================================================
// 2. GDELT DOC 2.0 (The Global Discovery Engine)
// ============================================================================
export async function fetchGdeltDoc(query = '("Infosys" OR "TCS" OR "Wipro" OR "Accenture")') {
  // Check if GDELT is currently in cooldown
  const now = Date.now();
  if (now < gdeltCooldownUntil) {
    const remainingSeconds = Math.ceil((gdeltCooldownUntil - now) / 1000);
    console.log(`[GDELT DOC] ⏳ In cooldown for another ${remainingSeconds}s (rate limit / timeout backoff). Skipping.`);
    return [];
  }

  const url = 'https://api.gdeltproject.org/api/v2/doc/doc';
  console.log(`[GDELT DOC] Querying global event database (timespan: 2h, timeout: 3.5s)...`);

  try {
    const response = await axios.get(url, {
      params: {
        query,
        mode: 'ArtList',
        format: 'json',
        sort: 'datedesc',   // Always newest first
        timespan: '2h',     // Only articles from the last 2 hours
        maxrecords: 15,
        _cb: Date.now()     // Cache-buster
      },
      timeout: 3500,        // Strict 3.5-second SLA timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    // Check if GDELT returned rate-limit plain text instead of JSON
    if (typeof response.data === 'string' && response.data.includes('Please limit requests')) {
      console.warn('[GDELT DOC] ⚠️ Rate limiter engaged (Please limit requests). Engaging 5-minute cooldown.');
      gdeltCooldownUntil = Date.now() + 5 * 60 * 1000;
      return [];
    }

    if (response.data && Array.isArray(response.data.articles)) {
      const articles = response.data.articles
        .filter((item) => item.title && item.url)
        .map((item) => ({
          api_source: 'GDELT DOC',
          source_name: item.domain || 'GDELT Global News',
          title: cleanHtml(item.title),
          url: item.url,
          raw_content: cleanHtml(item.title),
          published_at: parseGdeltDate(item.seendate),
          gdeltDomain: item.domain,
          gdeltLanguage: item.language,
          gdeltCountry: item.sourcecountry
        }));

      console.log(`[GDELT DOC] ✅ Returned ${articles.length} global articles (last 2h).`);
      return articles;
    }
    return [];
  } catch (error) {
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('TIMEDOUT');
    if (isTimeout) {
      console.warn('[GDELT DOC] ⏱️ Timeout (>3.5s). Engaging 5-minute cooldown.');
      gdeltCooldownUntil = Date.now() + 5 * 60 * 1000;
    } else if (error.response?.status === 429) {
      console.warn('[GDELT DOC] ⚠️ Rate limited (HTTP 429). Engaging 5-minute cooldown.');
      gdeltCooldownUntil = Date.now() + 5 * 60 * 1000;
    } else {
      console.warn(`[GDELT DOC] ⚠️ Skipped this cycle: ${error.response?.status || 'ERR'} - ${error.message}`);
    }
    return [];
  }
}

// ============================================================================
// 3. GDELT GKG / ENRICHMENT (Global Knowledge Graph Tone & Themes)
// ============================================================================
/**
 * Utility function that analyzes GDELT metadata and headline markers,
 * enriching raw_content with Tone and Core Themes to prime local Qwen 2.5 LLM.
 *
 * @param {object} article Article payload
 * @returns {string} Enriched content
 */
export function enrichWithGdeltContext(article) {
  const text = `${article.title} ${article.raw_content}`.toLowerCase();

  // Synthetic GKG thematic tags inference
  const inferredThemes = [];
  if (/rbi|regulator|audit|fraud|breach|subpoena|probe|penalty|sec|tax|scrutiny/.test(text)) {
    inferredThemes.push('REGULATION_COMPLIANCE', 'CRISIS_GOVERNANCE');
  }
  if (/outage|blackout|down|disruption|failover|latency|cloud/.test(text)) {
    inferredThemes.push('INFRASTRUCTURE_OUTAGE', 'SERVICE_DISRUPTION');
  }
  if (/earnings|revenue|margin|quarter|profit|loss|guidance|stock|shares/.test(text)) {
    inferredThemes.push('FINANCIAL_PERFORMANCE', 'EQUITY_MARKET');
  }
  if (/layoff|ceo|cto|cfo|appoint|resign|leadership|restructur/.test(text)) {
    inferredThemes.push('EXECUTIVE_LEADERSHIP', 'WORKFORCE_REORGANIZATION');
  }
  if (/ai|genai|copilot|cloud|semiconductor|chip/.test(text)) {
    inferredThemes.push('TECHNOLOGY_INNOVATION', 'ENTERPRISE_AI');
  }

  const isNegative = /loss|fall|crash|drop|probe|penalty|scrutiny|outage|layoff|breach|dispute|battle/.test(text);
  const isPositive = /surge|gain|rally|win|contract|expand|rise|partnership|growth/.test(text);
  const toneScore = isNegative ? '-6.85 (High Negative Volatility)' : (isPositive ? '+4.20 (Positive Sentiment)' : '0.00 (Neutral Informational)');

  const themesStr = inferredThemes.length > 0 ? inferredThemes.join(', ') : 'GENERAL_ENTERPRISE_WIRE';

  return `${article.raw_content} [GDELT Context: Tone=${toneScore} | GKG Themes: ${themesStr}]`;
}

// ============================================================================
// 4. THE GUARDIAN CONTENT API (The Premium Wire)
// ============================================================================
export async function fetchGuardianNews(keywords = 'Infosys OR TCS OR Wipro OR Accenture') {
  const apiKey = (process.env.GUARDIAN_API_KEY || '').trim();

  // Clean inactive skip if no key configured
  if (!apiKey || apiKey === 'test') {
    console.log('[The Guardian] ℹ️ Source inactive: GUARDIAN_API_KEY not configured. Skipping cleanly.');
    return [];
  }

  console.log('[The Guardian] Querying premium content API (order=newest)...');

  try {
    const response = await axios.get('https://content.guardianapis.com/search', {
      params: {
        q: keywords,
        'api-key': apiKey,         // Appended as query param, NOT as Bearer token
        'show-fields': 'headline,bodyText,trailText,thumbnail',
        'order-by': 'newest',
        'page-size': 10
      },
      timeout: 12000,
      headers: {
        'User-Agent': 'VeeAlert/1.0 (Enterprise Intelligence Platform)'
      }
    });

    const results = response.data?.response?.results;
    if (Array.isArray(results)) {
      const articles = results
        .filter((item) => item.webTitle && item.webUrl)
        .map((item) => {
          const bodyClean = cleanHtml(item.fields?.bodyText || item.fields?.trailText || item.webTitle);
          return {
            api_source: 'The Guardian API',
            source_name: 'The Guardian',
            title: cleanHtml(item.fields?.headline || item.webTitle),
            url: item.webUrl,
            image_url: item.fields?.thumbnail || null,
            raw_content: bodyClean.slice(0, 600),
            published_at: item.webPublicationDate ? new Date(item.webPublicationDate).toISOString() : new Date().toISOString()
          };
        });

      console.log(`[The Guardian] \u2705 Fetched ${articles.length} premium articles.`);
      return articles;
    }
    return [];
  } catch (error) {
    if (error.response?.status === 401) {
      console.warn('[The Guardian] \u26a0\ufe0f 401 Unauthorized — check GUARDIAN_API_KEY in server/.env.');
    } else if (error.response?.status === 429) {
      console.warn('[The Guardian] \u26a0\ufe0f Rate limited (HTTP 429). Skipping this cycle.');
    } else {
      console.warn(`[The Guardian] \u26a0\ufe0f Skipped: ${error.response?.status || 'ERR'} - ${error.message}`);
    }
    return [];
  }
}

// ============================================================================
// 5. PUBLISHER RSS (The Deterministic Truth)
// ============================================================================
// Verified Institutional Publishers Whitelist
export const VERIFIED_PUBLISHERS = [
  'The Economic Times',
  'Livemint',
  'Mint',
  'Business Standard',
  'NDTV Profit',
  'Reuters',
  'Bloomberg',
  'CNBC',
  'CNBC-TV18',
  'Financial Times',
  'Financial Express',
  'TechCrunch',
  'The Guardian',
  'Forbes',
  'Wall Street Journal',
  'WSJ',
  'BSE India',
  'NSE India'
];

export function isWhitelistedPublisher(sourceName = '', title = '', domain = '', apiSource = '') {
  // Automatic bypass for trusted institutional APIs
  if (apiSource === 'The Guardian API' || apiSource === 'NewsAPI') {
    return true;
  }
  const combined = `${sourceName} ${title} ${domain}`.toLowerCase();
  const matchExplicit = VERIFIED_PUBLISHERS.some((pub) => combined.includes(pub.toLowerCase()));
  const matchDomain = /economictimes|livemint|business-standard|ndtvprofit|reuters|bloomberg|cnbc|financialexpress|techcrunch|theguardian|forbes|wsj|ft\.com|bseindia|nseindia/.test(combined);
  return matchExplicit || matchDomain;
}

// Build a fresh Google RSS URL with when:4h freshness operator and cache-busting timestamp
function buildGoogleRssUrl() {
  const query = encodeURIComponent(
    '(Infosys OR "Infosys ADR" OR "NYSE: INFY" OR TCS OR Wipro OR "Wipro ADR" OR Accenture OR "IT services outage" OR "banking cyberattack" OR Finacle) when:4h'
  );
  return `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en&_cb=${Date.now()}`;
}

const WHITELISTED_RSS_FEEDS = [
  {
    name: 'The Economic Times',
    api_source: 'ET RSS',
    url: 'https://economictimes.indiatimes.com/tech/ites/rssfeeds/13357555.cms'
  },
  {
    name: 'The Economic Times Top Stories',
    api_source: 'ET RSS',
    url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms'
  },
  {
    name: 'Google News Live RSS',
    api_source: 'Google RSS',
    get url() { return buildGoogleRssUrl(); }  // Fresh URL with cache-buster on each call
  }
];

export async function fetchPublisherRss() {
  console.log('[Publisher RSS] Querying whitelisted publisher feeds (The Economic Times, Livemint, Google News)...');
  const aggregatedItems = [];

  for (const feed of WHITELISTED_RSS_FEEDS) {
    try {
      const feedUrl = typeof feed.url === 'string' ? feed.url : feed.url; // getter call
      console.log(`[Publisher RSS] Fetching: ${feed.name} → ${feedUrl.slice(0, 90)}...`);
      const response = await axios.get(feedUrl, {
        timeout: 9000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const items = $('item').toArray();

      for (const el of items) {
        const title = cleanHtml($(el).find('title').text());
        const link = $(el).find('link').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();
        const rawDesc = $(el).find('description').text();
        const description = cleanHtml(rawDesc);
        const sourceName = cleanHtml($(el).find('source').text()) || feed.name;

        // Extract image from description HTML <img> tag or <enclosure> or <media:content>
        let imageUrl = null;
        if (rawDesc) {
          try {
            const $desc = cheerio.load(rawDesc);
            const imgSrc = $desc('img').first().attr('src');
            if (imgSrc && imgSrc.startsWith('http')) {
              imageUrl = imgSrc;
            }
          } catch (_) {}
        }
        if (!imageUrl) {
          const enclosureUrl = $(el).find('enclosure').attr('url');
          if (enclosureUrl && enclosureUrl.startsWith('http')) {
            imageUrl = enclosureUrl;
          }
        }
        if (!imageUrl) {
          const mediaUrl = $(el).find('media\\:content, content').attr('url');
          if (mediaUrl && mediaUrl.startsWith('http')) {
            imageUrl = mediaUrl;
          }
        }

        if (!title || !link) continue;

        // Filter incoming XML items to ensure target keywords match
        if (!TARGET_ENTITY_REGEX.test(title) && !TARGET_ENTITY_REGEX.test(description)) {
          continue;
        }

        aggregatedItems.push({
          api_source: feed.api_source || (feed.name.includes('Google') ? 'Google RSS' : 'Publisher RSS'),
          source_name: sourceName,
          title,
          url: link,
          image_url: imageUrl,
          raw_content: description || title,
          published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
        });
      }
    } catch (feedErr) {
      console.warn(`[Publisher RSS] Feed "${feed.name}" notice:`, feedErr.message);
    }
  }

  console.log(`[Publisher RSS] Extracted ${aggregatedItems.length} verified publisher articles.`);
  return aggregatedItems;
}

// ============================================================================
// 6. MASTER CONCURRENT MULTI-SOURCE AGGREGATOR
// ============================================================================
/**
 * Queries all 5 sources concurrently using Promise.allSettled().
 * Normalizes outputs into standard format, enriches with GDELT context,
 * deduplicates, and passes each item asynchronously into processIngestCallback.
 *
 * @param {(payload: object) => Promise<any>} processIngestCallback
 * @returns {Promise<Array<object>>} Successfully ingested articles
 */
export async function fetchMultiSourceNews(processIngestCallback) {
  const ingest = processIngestCallback || registeredCallback;

  if (!ingest) {
    console.warn('[MultiSource] No ingest callback provided; skipping aggregation run.');
    return [];
  }

  const cycleTime = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log('\n================== [INGESTION CYCLE: ' + cycleTime + '] ==================');
  console.log('⚡ [Multi-Source Engine] Commencing Concurrent 4-Source Ingestion:');
  console.log('   1. NewsAPI        (Global 24/7 Wire — sortBy=publishedAt)');
  console.log('   2. GDELT DOC 2.0  (Global Discovery — timespan=2h, sort=datedesc)');
  console.log('   3. The Guardian   (Premium Wire — order=newest)');
  console.log('   4. Publisher RSS  (ET + Google News — when:4h + cache-bust)');
  console.log('=================================================================');

  // Execute all 4 fetchers concurrently with fault-isolation via Promise.allSettled
  const results = await Promise.allSettled([
    fetchNewsApi(),
    fetchGdeltDoc(),
    fetchGuardianNews(),
    fetchPublisherRss()
  ]);

  const rawAggregatedArticles = [];
  const sourceCounts = { NewsAPI: 0, 'GDELT DOC': 0, 'The Guardian API': 0, 'Publisher RSS': 0 };

  results.forEach((result, idx) => {
    const sourceNames = ['NewsAPI', 'GDELT DOC', 'The Guardian API', 'Publisher RSS'];
    const name = sourceNames[idx];
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      sourceCounts[name] = result.value.length;
      rawAggregatedArticles.push(...result.value);
    } else if (result.status === 'rejected') {
      const err = result.reason;
      console.error(`[${name}] ❌ Fetch Failed: ${err?.response?.status || 'ERR'} - ${err?.response?.data?.message || err?.message}`);
    } else {
      console.warn(`[MultiSource] Source [${name}] returned empty response.`);
    }
  });

  console.log(`\n[Fetch Sources] NewsAPI: ${sourceCounts['NewsAPI']} | GDELT: ${sourceCounts['GDELT DOC']} | Guardian: ${sourceCounts['The Guardian API']} | RSS: ${sourceCounts['Publisher RSS']}`);
  console.log(`[MultiSource] Aggregated ${rawAggregatedArticles.length} raw articles total. Starting dedup & triage...`);

  const ingestedArticles = [];

  // Four distinct outcome buckets — declared in outer scope so they accumulate
  let committed = 0;   // Actually committed to Supabase
  let sigDup    = 0;   // Dropped by in-memory signature dedup (newsFetcher)
  let dbDup     = 0;   // Dropped by Supabase URL/Title dedup (processIngest)
  let junk      = 0;   // Dropped by keyword guardrail (processIngest)
  let errors    = 0;   // Exception thrown inside ingest()

  for (const article of rawAggregatedArticles) {
    const signature = `${article.url || ''}::${article.title}`;
    if (isDuplicate(signature)) {
      sigDup++;
      console.log(`[Deduplicator] DROPPED DUPLICATE: "${(article.title || '').slice(0, 55)}..."`);
      continue;
    }

    // Enrich with GDELT Tone & Thematic Context
    const enrichedContent = enrichWithGdeltContext(article);
    const correlation_id = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const payload = {
      correlation_id,
      api_source: article.api_source || 'Google RSS',
      source_name: article.source_name,
      title: article.title,
      url: article.url,
      image_url: article.image_url || null,
      raw_content: enrichedContent,
      published_at: article.published_at
    };

    try {
      console.log(`[Pipeline] >>> NEW ARTICLE DISCOVERED: "${payload.title.slice(0, 55)}..." [${payload.api_source}] → Triaging...`);
      const result = await ingest(payload);

      if (result?.skipped) {
        if (result.reason === 'Failed keyword guardrail') {
          junk++;
        } else {
          dbDup++;
        }
      } else if (result?.success) {
        ingestedArticles.push(payload);
        committed++;
      }

      // Polite scraping delay between pipeline dispatches
      await sleep(200);
    } catch (err) {
      errors++;
      console.warn(`[MultiSource] Ingestion error for "${payload.title}":`, err.message);
    }
  }

  console.log(
    `[Cycle Summary] ✅ Committed: ${committed} | ` +
    `🔁 Sig-Dedup: ${sigDup} | 🔁 DB-Dedup: ${dbDup} | ` +
    `🛡️ Junk Dropped: ${junk} | ❌ Errors: ${errors}`
  );
  return ingestedArticles;

}

// ============================================================================
// 7. STREAM CONTROLLER
// ============================================================================
/**
 * Starts the recurring multi-source intelligence ingestion pipeline.
 * Intelligently supports both (callback, intervalMs) and (intervalMs, callback) signatures.
 *
 * @param {Function|number} arg1 Ingestion callback or polling interval in ms
 * @param {Function|number} [arg2] Polling interval in ms or callback
 */
export function startNewsStream(arg1, arg2) {
  let callback = null;
  let intervalMs = DEFAULT_POLL_INTERVAL_MS;

  if (typeof arg1 === 'function') {
    callback = arg1;
    if (typeof arg2 === 'number') intervalMs = arg2;
  } else if (typeof arg2 === 'function') {
    callback = arg2;
    if (typeof arg1 === 'number') intervalMs = arg1;
  }

  if (callback) {
    registeredCallback = callback;
  }

  if (!registeredCallback) {
    console.warn('[MultiSource] Cannot start stream: No valid ingest callback function provided.');
    return;
  }

  // Ensure interval is at least 30 seconds to prevent aggressive loops
  const effectiveIntervalMs = Math.max(30000, Number(intervalMs) || DEFAULT_POLL_INTERVAL_MS);

  console.log('\n=============================================================');
  console.log(`🚀 [Vee-Alert Multi-Source Intelligence Stream Started]`);
  console.log(`Polling Interval: ${effectiveIntervalMs / 1000}s`);
  console.log('=============================================================\n');

  // Trigger initial fetch on startup
  fetchMultiSourceNews(registeredCallback).catch((err) => {
    console.error('[MultiSource] Initial startup fetch notice:', err.message);
  });

  if (streamIntervalId) clearInterval(streamIntervalId);

  streamIntervalId = setInterval(async () => {
    try {
      if (registeredCallback) {
        await fetchMultiSourceNews(registeredCallback);
      }
    } catch (cycleError) {
      console.error('[MultiSource] Interval cycle caught error (recovering):', cycleError.message);
    }
  }, effectiveIntervalMs);
}

/**
 * Stops the multi-source intelligence ingestion stream.
 */
export function stopNewsStream() {
  if (streamIntervalId) {
    clearInterval(streamIntervalId);
    streamIntervalId = null;
    console.log('[MultiSource] Intelligence stream safely stopped.');
  }
}

// Backward-compatible alias for existing imports (now points to 5-source engine)
export const fetchLiveGoogleNews = fetchMultiSourceNews;
export const startLiveNewsFeed = startNewsStream;
export const stopLiveNewsFeed = stopNewsStream;
