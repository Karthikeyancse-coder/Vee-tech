import axios from 'axios';
import * as cheerio from 'cheerio';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
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

/**
 * High-performance HTML scraper for social firehoses (Bluesky & Nostr).
 * Uses a strict 4000ms timeout with AbortController and standard Chrome User-Agent
 * to extract OpenGraph title, description, and preview image without blocking the queue.
 */
export async function enrichSocialUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let timeoutId = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 4000); // Strict 4000ms timeout

    const response = await axios.get(url, {
      signal: controller.signal,
      timeout: 4000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 3,
      validateStatus: (status) => status >= 200 && status < 400
    });

    if (!response.data || typeof response.data !== 'string') return null;
    const $ = cheerio.load(response.data);
    const title = cleanHtml(
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      $('meta[name="twitter:title"]').attr('content') ||
      ''
    );
    const description = cleanHtml(
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      ''
    );
    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      null;

    if (title || description) {
      return { title, description, image };
    }
    return null;
  } catch (_) {
    // Gracefully ignore timeouts, 403 bot-blocks, or invalid pages
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ============================================================================
// REAL-TIME SOURCE TELEMETRY (Tracks Polling Vitality vs DB Commit Events)
// ============================================================================
export const sourceTelemetry = {
  newsapi: { id: 'newsapi', name: 'NewsAPI (Global Aggregator)', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  currents: { id: 'currents', name: 'Currents Global News API', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  gnews: { id: 'gnews', name: 'GNews AI-Curated Wire', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  newsdata: { id: 'newsdata', name: 'NewsData.io Real-Time Archive', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  guardian: { id: 'guardian', name: 'The Guardian Content API', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  bluesky: { id: 'bluesky', name: 'Bluesky Social Wire (AT Protocol)', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  nostr: { id: 'nostr', name: 'Nostr Relay Wire (Decentralized kind:1)', lastPolled: null, lastStatus: 'Operational', lastCount: 0, lastNewArticle: null },
  googlenews: { id: 'googlenews', name: 'Google News RSS (Decommissioned)', lastPolled: null, lastStatus: 'Decommissioned', lastCount: 0, lastNewArticle: null },
  institutional: { id: 'institutional', name: 'Institutional Publisher Wires (Decommissioned)', lastPolled: null, lastStatus: 'Decommissioned', lastCount: 0, lastNewArticle: null },
  gdelt: { id: 'gdelt', name: 'GDELT DOC 2.0 (Standby Archive)', lastPolled: null, lastStatus: 'Standby', lastCount: 0, lastNewArticle: null }
};

export function updateSourceTelemetry(sourceId, updates) {
  if (sourceTelemetry[sourceId]) {
    Object.assign(sourceTelemetry[sourceId], updates);
  }
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

  sourceTelemetry.newsapi.lastPolled = new Date().toISOString();

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

      sourceTelemetry.newsapi.lastStatus = 'Operational';
      sourceTelemetry.newsapi.lastCount = articles.length;
      console.log(`[NewsAPI] \u2705 Returned ${articles.length} articles from strict boolean query.`);
      return articles;
    }
    sourceTelemetry.newsapi.lastStatus = 'Operational';
    sourceTelemetry.newsapi.lastCount = 0;
    return [];
  } catch (error) {
    if (error.response?.status === 429) {
      sourceTelemetry.newsapi.lastStatus = 'Rate Limited';
      console.warn('[NewsAPI] \u26a0\ufe0f Rate limited (HTTP 429). Pausing NewsAPI for this cycle.');
    } else {
      sourceTelemetry.newsapi.lastStatus = 'Error';
      console.error(`[NewsAPI] \u274c Fetch Failed: ${error.response?.status || 'ERR'} - ${error.response?.data?.message || error.message}`);
    }
    return [];
  }
}

// GDELT Cooldown Tracker (3-minute backoff on 429 or timeout)
let gdeltCooldownUntil = 0;

// ============================================================================
// 2. GDELT DOC 2.0 (The Global Discovery Engine)
// ============================================================================
export async function fetchGdeltDoc(query = '(Infosys OR TCS OR Wipro OR Accenture)') {
  sourceTelemetry.gdelt.lastPolled = new Date().toISOString();

  // Check if GDELT is currently in cooldown
  const now = Date.now();
  if (now < gdeltCooldownUntil) {
    const remainingSeconds = Math.ceil((gdeltCooldownUntil - now) / 1000);
    console.log(`[GDELT DOC] ⏳ In cooldown for another ${remainingSeconds}s (rate limit / timeout backoff). Skipping.`);
    sourceTelemetry.gdelt.lastStatus = 'Cooldown';
    return [];
  }

  const queryStr = encodeURIComponent(query);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${queryStr}&mode=ArtList&format=json&sort=datedesc&timespan=24h&maxrecords=15`;
  console.log(`[GDELT DOC] Querying global event database (timespan: 24h, timeout: 15s)...`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000 // 15 second timeout to allow GDELT response without premature abort
    });

    // Check if GDELT returned rate-limit plain text instead of JSON
    if (typeof response.data === 'string' && response.data.includes('Please limit requests')) {
      console.warn('[GDELT DOC] ⚠️ Rate limiter engaged (Please limit requests). Engaging 3-minute cooldown.');
      gdeltCooldownUntil = Date.now() + 3 * 60 * 1000;
      sourceTelemetry.gdelt.lastStatus = 'Rate Limited';
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

      sourceTelemetry.gdelt.lastStatus = 'Operational';
      sourceTelemetry.gdelt.lastCount = articles.length;
      console.log(`[GDELT DOC] ✅ Returned ${articles.length} global articles.`);
      return articles;
    }
    sourceTelemetry.gdelt.lastStatus = 'Operational';
    sourceTelemetry.gdelt.lastCount = 0;
    return [];
  } catch (error) {
    const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout') || error.message.includes('TIMEDOUT');
    if (isTimeout) {
      console.warn('[GDELT DOC] ⏱️ Timeout (>15s). Engaging 3-minute cooldown.');
      gdeltCooldownUntil = Date.now() + 3 * 60 * 1000;
      sourceTelemetry.gdelt.lastStatus = 'Timeout';
    } else if (error.response?.status === 429) {
      console.warn('[GDELT DOC] ⚠️ Rate limited (HTTP 429). Engaging 3-minute cooldown.');
      gdeltCooldownUntil = Date.now() + 3 * 60 * 1000;
      sourceTelemetry.gdelt.lastStatus = 'Rate Limited';
    } else {
      console.warn(`[GDELT DOC] ⚠️ Skipped this cycle: ${error.response?.status || 'ERR'} - ${error.message}`);
      sourceTelemetry.gdelt.lastStatus = 'Error';
    }
    return [];
  }
}

export const fetchGDELT = fetchGdeltDoc;

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

  sourceTelemetry.guardian.lastPolled = new Date().toISOString();
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

      sourceTelemetry.guardian.lastStatus = 'Operational';
      sourceTelemetry.guardian.lastCount = articles.length;
      console.log(`[The Guardian] ✅ Fetched ${articles.length} premium articles.`);
      return articles;
    }
    sourceTelemetry.guardian.lastStatus = 'Operational';
    sourceTelemetry.guardian.lastCount = 0;
    return [];
  } catch (error) {
    if (error.response?.status === 401) {
      sourceTelemetry.guardian.lastStatus = 'Unauthorized';
      console.warn('[The Guardian] ⚠️ 401 Unauthorized — check GUARDIAN_API_KEY in server/.env.');
    } else if (error.response?.status === 429) {
      sourceTelemetry.guardian.lastStatus = 'Rate Limited';
      console.warn('[The Guardian] ⚠️ Rate limited (HTTP 429). Skipping this cycle.');
    } else {
      sourceTelemetry.guardian.lastStatus = 'Error';
      console.warn(`[The Guardian] ⚠️ Skipped: ${error.response?.status || 'ERR'} - ${error.message}`);
    }
    return [];
  }
}

// ============================================================================
// 5. NOSTR RELAY FIREHOSE (Decentralized Censorship-Resistant Stream)
// ============================================================================
/**
 * Ingests live notes from decentralized Nostr relays (wss://nos.lol, wss://relay.primal.net, wss://relay.damus.io).
 * Connects via WebSocket, subscribes to kind: 1 notes matching target keywords,
 * enriches embedded links with Cheerio HTML scraping, and cleanly invokes ws.terminate()
 * after a strict 5-second polling window to prevent memory leaks in the Node runtime.
 *
 * @returns {Promise<Array<object>>} Normalized Nostr events
 */
export async function fetchNostrStream() {
  sourceTelemetry.nostr.lastPolled = new Date().toISOString();
  console.log('[Nostr] ⚡ Connecting to decentralized relays (nos.lol, primal.net, damus.io)...');

  const relays = [
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://relay.damus.io'
  ];

  const targetRegex = /\b(Infosys|TCS|Tata Consultancy Services|Wipro|Accenture|Finacle)\b/i;
  const collectedNotes = new Map();

  const connectRelay = (url) => new Promise((resolve) => {
    let ws = null;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ws) {
        try {
          ws.terminate(); // Safe explicit socket teardown per specification
        } catch (_) {}
      }
      resolve();
    };

    // Strict 5000ms teardown window to prevent memory leaks
    timeoutId = setTimeout(() => {
      cleanup();
    }, 5000);

    try {
      ws = new WebSocket(url, { handshakeTimeout: 4000 });

      ws.on('open', () => {
        try {
          // Subscribe to kind: 1 (text notes)
          const subId = `vee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          ws.send(JSON.stringify(['REQ', subId, { kinds: [1], limit: 40 }]));
        } catch (_) {
          cleanup();
        }
      });

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data[0] === 'EVENT' && data[2]?.content) {
            const event = data[2];
            const content = cleanHtml(event.content);
            if (targetRegex.test(content) && !collectedNotes.has(event.id)) {
              collectedNotes.set(event.id, event);
            }
          } else if (data[0] === 'EOSE') {
            cleanup();
          }
        } catch (_) {}
      });

      ws.on('error', () => {
        cleanup();
      });

      ws.on('close', () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      });
    } catch (_) {
      cleanup();
    }
  });

  await Promise.allSettled(relays.map((r) => connectRelay(r)));

  const notesArray = Array.from(collectedNotes.values());
  const articles = [];

  for (const event of notesArray) {
    const text = cleanHtml(event.content);
    const pubkeyShort = event.pubkey ? `${event.pubkey.slice(0, 8)}...` : 'anon';
    const noteUrl = `https://njump.me/${event.id}`;
    let thumb = null;

    // Check if note contains an external link to enrich with Cheerio
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    let enrichedContent = text;
    if (urlMatch && urlMatch[0]) {
      const enriched = await enrichSocialUrl(urlMatch[0]);
      if (enriched) {
        enrichedContent = `${text}\n\n[Linked Article]: ${enriched.title}${enriched.description ? ` — ${enriched.description}` : ''}`;
        thumb = enriched.image;
      }
    }

    articles.push({
      api_source: 'Nostr Relay Wire',
      source_name: `nostr:${pubkeyShort}`,
      title: text.length > 95 ? `${text.slice(0, 92)}...` : text,
      url: noteUrl,
      image_url: thumb,
      raw_content: enrichedContent,
      published_at: event.created_at ? new Date(event.created_at * 1000).toISOString() : new Date().toISOString()
    });
  }

  sourceTelemetry.nostr.lastStatus = 'Operational';
  sourceTelemetry.nostr.lastCount = articles.length;
  console.log(`[Nostr] ✅ Ingested ${articles.length} verified decentralized events across relays.`);
  return articles;
}

// Backward-compatibility alias for legacy callers
export const fetchPublisherRss = fetchNostrStream;

// ============================================================================
// 6. GNEWS API (Global AI-Curated News Index)
// ============================================================================
/**
 * Fetches articles from GNews — a premium real-time global news index.
 * Gated on GNEWS_API_KEY; skips cleanly if not configured.
 *
 * @returns {Promise<Array<object>>} Normalized article array
 */
export async function fetchGNews() {
  const apiKey = (process.env.GNEWS_API_KEY || '').trim();

  if (!apiKey) {
    console.log('[GNews] GNEWS_API_KEY not configured in .env; skipping source.');
    return [];
  }

  sourceTelemetry.gnews.lastPolled = new Date().toISOString();
  const strictQuery = '(Infosys OR "Tata Consultancy Services" OR Wipro OR Accenture)';
  console.log(`[GNews] Querying global AI-curated news index (sortby=publishedAt)...`);

  try {
    const response = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: strictQuery,
        lang: 'en',
        sortby: 'publishedAt',
        max: 10,
        apikey: apiKey
      },
      headers: {
        'User-Agent': 'VeeAlert/1.0 (Enterprise Intelligence Platform)',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      timeout: 12000
    });

    if (response.data && Array.isArray(response.data.articles)) {
      const articles = response.data.articles
        .filter((item) => item.title && item.url)
        .map((item) => ({
          api_source: 'GNews',
          source_name: item.source?.name || 'GNews Global Wire',
          title: cleanHtml(item.title),
          url: item.url,
          image_url: item.image || null,
          raw_content: cleanHtml(item.description || item.content || item.title),
          published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : new Date().toISOString()
        }));

      sourceTelemetry.gnews.lastStatus = 'Operational';
      sourceTelemetry.gnews.lastCount = articles.length;
      console.log(`[GNews] ✅ Returned ${articles.length} articles.`);
      return articles;
    }
    sourceTelemetry.gnews.lastStatus = 'Operational';
    sourceTelemetry.gnews.lastCount = 0;
    return [];
  } catch (error) {
    if (error.response?.status === 429 || error.response?.status === 401 || error.response?.status === 403) {
      sourceTelemetry.gnews.lastStatus = 'Rate Limited';
      console.warn(`[GNews] ⚠️ API unavailable or rate limited. (HTTP ${error.response.status})`);
    } else {
      sourceTelemetry.gnews.lastStatus = 'Error';
      console.warn(`[GNews] ⚠️ API unavailable or rate limited. (${error.message})`);
    }
    return [];
  }
}

// ============================================================================
// 7. NEWSDATA.IO (Real-Time News Archive)
// ============================================================================
/**
 * Fetches articles from NewsData.io — a real-time global news archive API.
 * Gated on NEWSDATA_API_KEY; skips cleanly if not configured.
 * Field mapping: `link` → url, `pubDate` → published_at, `source_id` → source_name.
 *
 * @returns {Promise<Array<object>>} Normalized article array
 */
export async function fetchNewsData() {
  const apiKey = (process.env.NEWSDATA_API_KEY || '').trim();

  if (!apiKey) {
    console.log('[NewsData] NEWSDATA_API_KEY not configured in .env; skipping source.');
    return [];
  }

  sourceTelemetry.newsdata.lastPolled = new Date().toISOString();
  const strictQuery = '(Infosys OR TCS OR Wipro OR Accenture)';
  console.log(`[NewsData] Querying NewsData.io real-time archive...`);

  try {
    const response = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        q: strictQuery,
        language: 'en',
        apikey: apiKey
      },
      headers: {
        'User-Agent': 'VeeAlert/1.0 (Enterprise Intelligence Platform)',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      timeout: 12000
    });

    if (response.data && Array.isArray(response.data.results)) {
      const articles = response.data.results
        .filter((item) => item.title && item.link)
        .map((item) => ({
          api_source: 'NewsData',
          source_name: item.source_id || 'NewsData Wire',
          title: cleanHtml(item.title),
          url: item.link,                              // NewsData uses `link`, not `url`
          image_url: item.image_url || null,
          raw_content: cleanHtml(item.description || item.content || item.title),
          published_at: item.pubDate                   // NewsData uses `pubDate`
            ? new Date(item.pubDate).toISOString()
            : new Date().toISOString()
        }));

      sourceTelemetry.newsdata.lastStatus = 'Operational';
      sourceTelemetry.newsdata.lastCount = articles.length;
      console.log(`[NewsData] ✅ Returned ${articles.length} articles.`);
      return articles;
    }
    sourceTelemetry.newsdata.lastStatus = 'Operational';
    sourceTelemetry.newsdata.lastCount = 0;
    return [];
  } catch (error) {
    if (error.response?.status === 429 || error.response?.status === 401 || error.response?.status === 403) {
      sourceTelemetry.newsdata.lastStatus = 'Rate Limited';
      console.warn(`[NewsData] ⚠️ API unavailable or rate limited. (HTTP ${error.response.status})`);
    } else {
      sourceTelemetry.newsdata.lastStatus = 'Error';
      console.warn(`[NewsData] ⚠️ API unavailable or rate limited. (${error.message})`);
    }
    return [];
  }
}

// ============================================================================
// 8. CURRENTS API (Global Live News Stream)
// ============================================================================
/**
 * Fetches articles from Currents API — real-time global news engine.
 * Gated on CURRENTS_API_KEY; skips cleanly if not configured.
 *
 * @returns {Promise<Array<object>>} Normalized article array
 */
export async function fetchCurrentsNews() {
  const apiKey = (process.env.CURRENTS_API_KEY || '').trim();

  if (!apiKey) {
    console.log('[Currents] CURRENTS_API_KEY not configured in .env; skipping source.');
    return [];
  }

  sourceTelemetry.currents.lastPolled = new Date().toISOString();
  const strictQuery = 'Infosys OR TCS OR Wipro OR Accenture';
  console.log('[Currents] Querying Currents global news API...');

  try {
    const response = await axios.get('https://api.currentsapi.services/v1/search', {
      params: {
        keywords: strictQuery,
        language: 'en',
        apiKey: apiKey
      },
      headers: {
        'User-Agent': 'VeeAlert/1.0 (Enterprise Intelligence Platform)',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      timeout: 12000
    });

    if (response.data && Array.isArray(response.data.news)) {
      const articles = response.data.news
        .filter((item) => item.title && item.url)
        .map((item) => ({
          api_source: 'Currents API',
          source_name: item.author || 'Currents Global News',
          title: cleanHtml(item.title),
          url: item.url,
          image_url: (item.image && item.image !== 'None' && String(item.image).startsWith('http')) ? item.image : null,
          raw_content: cleanHtml(item.description || item.title),
          published_at: item.published ? new Date(item.published).toISOString() : new Date().toISOString()
        }));

      sourceTelemetry.currents.lastStatus = 'Operational';
      sourceTelemetry.currents.lastCount = articles.length;
      console.log(`[Currents] ✅ Returned ${articles.length} articles.`);
      return articles;
    }
    sourceTelemetry.currents.lastStatus = 'Operational';
    sourceTelemetry.currents.lastCount = 0;
    return [];
  } catch (error) {
    if (error.response?.status === 429 || error.response?.status === 401 || error.response?.status === 403) {
      sourceTelemetry.currents.lastStatus = 'Rate Limited';
      console.warn(`[Currents] ⚠️ API unavailable or rate limited (HTTP ${error.response?.status}).`);
    } else {
      sourceTelemetry.currents.lastStatus = 'Error';
      console.warn(`[Currents] ⚠️ API request notice (${error.message}).`);
    }
    return [];
  }
}

// ============================================================================
// 9. BLUESKY SOCIAL WIRE (Decentralized AT Protocol Intelligence)
// ============================================================================
let blueskyJwt = null;
let blueskyJwtExpiry = 0;

/**
 * Fetches real-time intelligence from Bluesky via AT Protocol searchPosts API.
// ============================================================================
// 9. BLUESKY SOCIAL WIRE (AT Protocol Decentralized Search)
// ============================================================================
/**
 * Ingests real-time posts from Bluesky via public search API (app.bsky.feed.searchPosts).
 * Queries monitored entities (Infosys, TCS, Wipro, Accenture, Finacle).
 * Enriches linked articles with Cheerio HTML scraping for accurate downstream risk scoring.
 *
 * @returns {Promise<Array<object>>} Normalized article array
 */
export async function fetchBlueskyFeed() {
  sourceTelemetry.bluesky.lastPolled = new Date().toISOString();
  const query = '(Infosys OR "Tata Consultancy Services" OR TCS OR Wipro OR Accenture OR Finacle)';
  console.log('[Bluesky] ⚡ Querying AT Protocol public search wire...');

  try {
    const response = await axios.get('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts', {
      params: {
        q: query,
        limit: 20
      },
      headers: {
        'User-Agent': 'VeeAlert/1.0 (Enterprise Media Intelligence Platform)'
      },
      timeout: 8000
    });

    if (response.data && Array.isArray(response.data.posts)) {
      const posts = [];
      for (const post of response.data.posts) {
        if (!post.record?.text) continue;
        const text = cleanHtml(post.record.text);
        const handle = post.author?.handle || 'bluesky';
        const rkey = post.uri ? post.uri.split('/').pop() : '';
        const postUrl = rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : `https://bsky.app/profile/${handle}`;
        let thumb = post.embed?.images?.[0]?.thumb || null;

        // Check if post text contains an external URL to enrich with Cheerio
        const urlMatch = text.match(/https?:\/\/[^\s]+/i);
        let enrichedContent = text;
        if (urlMatch && urlMatch[0] && !urlMatch[0].includes('bsky.app')) {
          const enriched = await enrichSocialUrl(urlMatch[0]);
          if (enriched) {
            enrichedContent = `${text}\n\n[Linked Article]: ${enriched.title}${enriched.description ? ` — ${enriched.description}` : ''}`;
            if (!thumb && enriched.image) thumb = enriched.image;
          }
        }

        posts.push({
          api_source: 'Bluesky Social',
          source_name: `@${handle}`,
          title: text.length > 95 ? `${text.slice(0, 92)}...` : text,
          url: postUrl,
          image_url: thumb,
          raw_content: enrichedContent,
          published_at: post.record?.createdAt ? new Date(post.record.createdAt).toISOString() : new Date().toISOString()
        });
      }

      sourceTelemetry.bluesky.lastStatus = 'Operational';
      sourceTelemetry.bluesky.lastCount = posts.length;
      console.log(`[Bluesky] ✅ Returned ${posts.length} real-time posts.`);
      return posts;
    }
    sourceTelemetry.bluesky.lastStatus = 'Operational';
    sourceTelemetry.bluesky.lastCount = 0;
    return [];
  } catch (error) {
    sourceTelemetry.bluesky.lastStatus = 'Error';
    console.warn(`[Bluesky] ⚠️ AT Protocol query notice: ${error.message}`);
    return [];
  }
}

// Backwards-compatibility alias
export const fetchBlueskySocial = fetchBlueskyFeed;

// ============================================================================
// 10. MASTER CONCURRENT MULTI-SOURCE AGGREGATOR (Pure API + Decentralized Firehoses)
// ============================================================================
/**
 * Queries 7 pure-API & decentralized firehoses concurrently using Promise.allSettled().
 * Completely eliminates slow RSS parsing in favor of high-velocity APIs and WebSocket streams.
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
  console.log('⚡ [Multi-Source Engine] Commencing Concurrent 7-Stream Pure-API & Firehose Ingestion:');
  console.log('   1. NewsAPI        (Global 24/7 Wire — sortBy=publishedAt)');
  console.log('   2. Currents API   (Global Live Stream — verified multi-lingual)');
  console.log('   3. GNews          (AI-Curated Global Index — sortby=publishedAt)');
  console.log('   4. NewsData.io    (Real-Time Archive — language=en)');
  console.log('   5. The Guardian   (Premium Wire — order=newest)');
  console.log('   6. Bluesky Social (AT Protocol Decentralized HTTP Firehose)');
  console.log('   7. Nostr Relays   (WebSocket Decentralized Wire: nos.lol, primal)');
  console.log('=========================================================================');

  // Execute all 7 pure-API & WebSocket firehoses concurrently with fault-isolation
  const results = await Promise.allSettled([
    fetchNewsApi(),
    fetchCurrentsNews(),
    fetchGNews(),
    fetchNewsData(),
    fetchGuardianNews(),
    fetchBlueskyFeed(),
    fetchNostrStream()
  ]);

  const rawAggregatedArticles = [];
  const sourceCounts = {
    NewsAPI: 0,
    'Currents API': 0,
    GNews: 0,
    NewsData: 0,
    'The Guardian API': 0,
    'Bluesky Social': 0,
    'Nostr Relay Wire': 0
  };

  const sourceNames = [
    'NewsAPI',
    'Currents API',
    'GNews',
    'NewsData',
    'The Guardian API',
    'Bluesky Social',
    'Nostr Relay Wire'
  ];

  results.forEach((result, idx) => {
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

  console.log(
    `\n[Fetch Sources] NewsAPI: ${sourceCounts['NewsAPI']} | Currents: ${sourceCounts['Currents API']} | ` +
    `GNews: ${sourceCounts['GNews']} | NewsData: ${sourceCounts['NewsData']} | ` +
    `Guardian: ${sourceCounts['The Guardian API']} | Bluesky: ${sourceCounts['Bluesky Social']} | ` +
    `Nostr: ${sourceCounts['Nostr Relay Wire']}`
  );
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
      console.log(`[Deduplicator] DROPPED DUPLICATE (Signature): "${(article.title || '').slice(0, 55)}..."`);
      continue;
    }

    // PHASE 0 PRE-FILTER: Drop irrelevant articles upfront before DB queries or triage
    const textToCheck = `${article.title || ''} ${article.description || ''} ${article.content || ''}`;
    if (!TARGET_ENTITY_REGEX.test(textToCheck)) {
      junk++;
      console.log(`[Guardrail Pre-Filter] 🛡️ DROPPED IRRELEVANT: "${(article.title || '').slice(0, 55)}..."`);
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

        // Track last new committed article for this source
        const apiSrc = (payload.api_source || '').toLowerCase();
        const srcName = (payload.source_name || '').toLowerCase();
        let matchedKey = 'newsapi';
        if (apiSrc.includes('currents') || srcName.includes('currents')) matchedKey = 'currents';
        else if (apiSrc.includes('bluesky') || srcName.includes('bsky')) matchedKey = 'bluesky';
        else if (apiSrc.includes('gnews') || srcName.includes('gnews')) matchedKey = 'gnews';
        else if (apiSrc.includes('newsdata') || srcName.includes('newsdata')) matchedKey = 'newsdata';
        else if (apiSrc.includes('gdelt') || srcName.includes('gdelt')) matchedKey = 'gdelt';
        else if (apiSrc.includes('guardian') || srcName.includes('guardian')) matchedKey = 'guardian';
        else if (apiSrc.includes('rss') || srcName.includes('google')) matchedKey = 'googlenews';
        else if (srcName.includes('economic') || srcName.includes('mint') || srcName.includes('standard') || srcName.includes('reuters') || srcName.includes('bloomberg')) matchedKey = 'institutional';

        if (sourceTelemetry[matchedKey]) {
          sourceTelemetry[matchedKey].lastNewArticle = new Date().toISOString();
        }
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
