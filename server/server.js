import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramAlert, triggerVoiceCall } from './services/notifier.js';
import {
  fetchMultiSourceNews,
  fetchLiveGoogleNews,
  startNewsStream,
  startLiveNewsFeed,
  stopLiveNewsFeed
} from './services/newsFetcher.js';

dotenv.config();

// ============================================================================
// 1. INITIALIZATION & SETUP
// ============================================================================
const app = express();
const PORT = Number(process.env.PORT || 5000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
  : null;

// In-Memory Fallback Caches (Maintains zero-lag operation if external DB is disconnected)
const memoryArticles = [];
const memoryAlertLogs = [];

// ============================================================================
// 2. LOCAL AI TRIAGE ENGINE (Ollama / qwen2.5)
// ============================================================================
/**
 * Triage raw news content using local Ollama model (Qwen 2.5).
 * Strictly enforces JSON output schema and handles timeouts/parsing errors.
 *
 * @param {string} rawContent Raw article or post text
 * @param {string} [title=''] Article headline
 * @param {string} [sourceName=''] Source publisher or handle
 * @returns {Promise<{
 *   entity: string,
 *   sentiment: 'Positive'|'Neutral'|'Negative',
 *   theme: string,
 *   risk_score: number,
 *   risk_level: 'Low'|'Medium'|'High'|'Critical',
 *   requires_voice_escalation: boolean,
 *   five_bullet_summary: string[]
 * }>}
 */
// ============================================================================
// 2. CLIENT-ONLY RISK TAXONOMY & NORMALIZATION CLAMP
// ============================================================================
/**
 * Hardcode a programmatic safeguard following triage:
 * Only primary client "Infosys" can ever receive Critical risk or voice escalation.
 * Competitors (TCS, Wipro, Accenture) are strategic market intelligence and are
 * capped at High (max 7.5), with voice escalation always set to false.
 */
export function normalizeTriage(triage) {
  if (!triage) return triage;

  // Force entity boundary
  const rawEntity = String(triage.entity || 'Infosys').trim();
  const isClient = rawEntity.toLowerCase() === 'infosys';

  if (!isClient) {
    // Hard clamp: Competitors can NEVER be CRITICAL
    if (triage.risk_level === 'Critical') {
      triage.risk_level = 'High'; // Downgrade to High
    }
    if (triage.risk_score > 7.5) {
      triage.risk_score = 7.5; // Cap score to 7.5 max
    }
    // Competitors NEVER wake up leadership with an emergency voice call
    triage.requires_voice_escalation = false;
  } else {
    // For primary client (Infosys): voice escalation ONLY if Critical
    triage.requires_voice_escalation = triage.risk_level === 'Critical';
  }

  return triage;
}

/**
 * Triage raw news content using local Ollama model (Qwen 2.5).
 * Strictly enforces JSON output schema, client-only risk rules, and fallback clamps.
 */
export async function triageArticle(rawContent, title = '', sourceName = '') {
  const prompt = [
    'You are the Vee-Alert crisis intelligence triage agent for enterprise primary client Infosys.',
    'TARGET CLIENT: Infosys.',
    'COMPETITORS: TCS, Wipro, Accenture.',
    '',
    'STRICT CLASSIFICATION RULES:',
    '1. "Critical" (and requires_voice_escalation: true) is EXCLUSIVELY RESERVED for Infosys facing existential threats (e.g., regulatory bans, SEBI/RBI probes, catastrophic security breaches, C-suite legal action).',
    '2. Competitor news (TCS, Wipro, Accenture) must NEVER be classified as "Critical", and requires_voice_escalation must ALWAYS be false. Competitor news is strategic market intelligence (Low, Medium, or at most High 7.5 max).',
    '3. Routine business developments (product launches, custom chip design, automotive semiconductor services, sponsorships, partnerships, Indore/expansion news, hiring, quarterly commentary) are LOW or MEDIUM risk (score 1.0 - 5.0), NOT regulatory crises.',
    '4. Factuality check: Differentiate verified facts from speculation/rumors. Speculative articles must be capped at "Medium" risk.',
    '',
    'Analyze the raw news content below and return ONLY a valid JSON object matching this exact schema:',
    '{',
    '  "entity": "String (e.g., Infosys, TCS, Wipro, Accenture)",',
    '  "sentiment": "String (Positive, Neutral, Negative)",',
    '  "theme": "String (e.g., Regulatory Compliance, Cloud Outage, Competitor Counter-Play, Strategic Innovation)",',
    '  "risk_score": Number between 1.0 and 10.0,',
    '  "risk_level": "String (Low, Medium, High, Critical)",',
    '  "requires_voice_escalation": Boolean,',
    '  "five_bullet_summary": [',
    '    "What happened: concise 1-sentence breakdown",',
    '    "Why it matters: strategic brand/financial/operational impact",',
    '    "Risk score rationale: justification for risk score",',
    '    "Competitor impact: effect on market parity or opportunity for rival vendors",',
    '    "Recommended action: immediate next operational step for crisis leadership"',
    '  ]',
    '}',
    'Do not include any explanation, conversational text, markdown formatting, or code fences. Output valid JSON only.',
    '',
    `Source: ${sourceName || 'Verified News Wire'}`,
    `Headline: ${title || 'Breaking Industry Alert'}`,
    `Content: ${rawContent}`
  ].join('\n');

  try {
    const controller = new AbortController();
    const ollamaTimeout = setTimeout(() => controller.abort(), 12000); // 12-second hard abort

    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
        num_predict: 512
      }
    }, {
      timeout: 14000,
      signal: controller.signal
    });

    clearTimeout(ollamaTimeout);

    const rawResponse = response.data?.response;
    if (rawResponse) {
      const sanitized = String(rawResponse).trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
      const parsed = JSON.parse(sanitized);

      const entity = typeof parsed.entity === 'string' && parsed.entity.trim() ? parsed.entity.trim() : 'Infosys';
      const riskScore = Number(parsed.risk_score);
      const validScore = Number.isFinite(riskScore) ? Math.min(10, Math.max(1, Number(riskScore.toFixed(1)))) : 5.0;
      const validLevel = ['Low', 'Medium', 'High', 'Critical'].includes(parsed.risk_level)
        ? parsed.risk_level
        : (validScore >= 8.5 ? 'Critical' : validScore >= 6.5 ? 'High' : validScore >= 4 ? 'Medium' : 'Low');

      const bullets = Array.isArray(parsed.five_bullet_summary) && parsed.five_bullet_summary.length > 0
        ? parsed.five_bullet_summary.map((b) => String(b).trim()).slice(0, 5)
        : null;

      const rawTriage = {
        entity,
        sentiment: ['Positive', 'Neutral', 'Negative'].includes(parsed.sentiment) ? parsed.sentiment : 'Neutral',
        theme: typeof parsed.theme === 'string' && parsed.theme.trim() ? parsed.theme.trim() : 'Industry Intelligence',
        risk_score: validScore,
        risk_level: validLevel,
        requires_voice_escalation: validLevel === 'Critical',
        five_bullet_summary: bullets && bullets.length === 5 ? bullets : [
          `What happened: ${title || 'A major industry event was reported.'}`,
          'Why it matters: Event potentially alters market perception and client confidence.',
          `Risk score rationale: Assigned ${validScore}/10 based on evidence and client-specific threat level.`,
          'Competitor impact: Affects competitive positioning against TCS, Wipro, and Accenture.',
          'Recommended action: Convene response committee and issue proactive communication.'
        ]
      };

      // Hardcode programmatic normalization clamp
      return normalizeTriage(rawTriage);
    }
  } catch (error) {
    console.warn(`[Ollama Triage] Inference failed or timed out (${error.message}). Falling back to deterministic triage.`);
  }

  // Deterministic Local Fallback Triage
  return deterministicFallbackTriage(rawContent, title);
}

/**
 * High-accuracy deterministic heuristic triage for zero-downtime offline fallback.
 * Strictly adheres to client-only Critical rules and caps competitors at High (7.0 max).
 */
function deterministicFallbackTriage(content, title) {
  const text = `${title} ${content}`.toLowerCase();
  
  let entity = 'Infosys';
  if (text.includes('tcs') || text.includes('tata consultancy')) entity = 'TCS';
  else if (text.includes('wipro')) entity = 'Wipro';
  else if (text.includes('accenture')) entity = 'Accenture';
  else if (text.includes('infosys')) entity = 'Infosys';

  const isClient = entity === 'Infosys';

  // Routine announcements: product launches, semiconductor/chips, expansions, quarterly commentary
  const isRoutine = /chip design|semiconductor|product launch|partnership|sponsorship|expansion|indore|hiring|patent|facility|centre|results|quarterly|automotive/.test(text);

  // Severe crises
  const hasExistentialCrisis = /rbi|regulator|sebi|audit notice|fraud|subpoena|probe|penalty|sec probe|enforcement action/.test(text);
  const hasOperationalDisruption = /outage|blackout|lawsuit|downgrade|contract loss|ransomware|security breach/.test(text);

  let riskLevel = 'Low';
  let riskScore = 2.5;

  if (isClient) {
    if (hasExistentialCrisis) {
      riskLevel = 'Critical';
      riskScore = 9.5;
    } else if (hasOperationalDisruption) {
      riskLevel = 'High';
      riskScore = 7.5;
    } else if (isRoutine) {
      riskLevel = 'Low';
      riskScore = 2.5;
    } else {
      riskLevel = 'Medium';
      riskScore = 4.8;
    }
  } else {
    // Competitors: NEVER Critical. High is capped at 7.0 for sales counter-play
    if (hasExistentialCrisis || hasOperationalDisruption) {
      riskLevel = 'High';
      riskScore = 7.0;
    } else if (isRoutine) {
      riskLevel = 'Low';
      riskScore = 2.4;
    } else {
      riskLevel = 'Medium';
      riskScore = 4.5;
    }
  }

  const sentiment = (isClient && (riskLevel === 'Critical' || riskLevel === 'High'))
    ? 'Negative'
    : (!isClient && riskLevel === 'High')
    ? 'Positive'
    : 'Neutral';

  return normalizeTriage({
    entity,
    sentiment,
    theme: hasExistentialCrisis
      ? 'Regulatory & Compliance'
      : hasOperationalDisruption
      ? 'Operational Disruption'
      : isRoutine
      ? 'Strategic Product Innovation'
      : 'Enterprise Intelligence',
    risk_score: riskScore,
    risk_level: riskLevel,
    requires_voice_escalation: isClient && riskLevel === 'Critical',
    five_bullet_summary: [
      `What happened: A verified media update was reported concerning ${entity}.`,
      `Why it matters: ${isClient ? `Directly impacts Infosys's operational reputation and stakeholder perception.` : `Competitor market update offering strategic intelligence for Infosys.`}`,
      `Risk score rationale: Rated ${riskScore}/10 based on ${isClient ? (hasExistentialCrisis ? 'regulatory audit scrutiny directly targeting Infosys' : 'client operational impact') : 'competitor market development (non-existential to Infosys)'}.`,
      `Competitor impact: ${isClient ? 'Competitors may seek to exploit this development in competitive cloud deals.' : 'Creates immediate RFP displacement and competitive positioning opportunities for Infosys.'}`,
      `Recommended action: ${isClient ? (riskLevel === 'Critical' ? 'Immediate escalation to executive leadership and crisis response council.' : 'Monitor client sentiment and issue proactive clarification.') : 'Brief enterprise sales teams on competitor movement to capture market share.'}`
    ]
  });
}

// ============================================================================
// 3. DATABASE REPOSITORIES
// ============================================================================
async function insertArticleRecord(articlePayload) {
  if (!supabase) {
    memoryArticles.unshift(articlePayload);
    return { ...articlePayload, _dbSuccess: false };
  }
  const { data, error } = await supabase.from('articles').insert(articlePayload).select().single();
  if (error) {
    console.error('[Supabase] ❌ Insert Error:', error.message);
    memoryArticles.unshift(articlePayload);
    return { ...articlePayload, _dbSuccess: false };
  }
  console.log(`[Supabase] ✅ COMMITTED TO DB: ID ${data.id} (Source: ${data.api_source}) at ${new Date().toLocaleTimeString()}`);
  return { ...data, _dbSuccess: true };
}

async function insertAlertLogRecord(logPayload) {
  if (!supabase) {
    memoryAlertLogs.unshift({ id: randomUUID(), ...logPayload });
    return logPayload;
  }
  const { data, error } = await supabase.from('alert_logs').insert(logPayload).select().single();
  if (error) {
    console.error('[Supabase Error: Insert Alert Log]', error.message);
    memoryAlertLogs.unshift({ id: randomUUID(), ...logPayload });
    return logPayload;
  }
  return data;
}

// ============================================================================
// 4. CENTRAL INGESTION PIPELINE (processIngest) WITH DEDUPLICATION
// ============================================================================
/**
 * Processes incoming raw news event through deduplication, AI triage, DB insertion,
 * alert dispatching, and mathematical SLA audit logging.
 *
 * @param {object} payload { source_name, url, raw_content, published_at, title }
 * @returns {Promise<object>} Ingestion result with SLA telemetry
 */
export async function processIngest(payload) {
  const ingested_at = Date.now();
  const ingestedIso = new Date(ingested_at).toISOString();

  const {
    api_source = 'Google News RSS',
    source_name = 'Verified News Wire',
    url = null,
    image_url = null,
    raw_content,
    published_at,
    title = ''
  } = payload || {};

  if (!raw_content || !String(raw_content).trim()) {
    throw new Error('raw_content is required for AI triage and ingestion');
  }

  const effectiveTitle = String(title || (String(raw_content).slice(0, 70).trim() + '...')).trim();
  const normalizedUrl = url ? String(url).trim() : null;

  // ============================================================================
  // STEP 2: DEDUPLICATION CHECK
  // Check if an article with the exact same URL OR Title already exists
  // ============================================================================
  if (supabase) {
    try {
      if (normalizedUrl) {
        const { data: byUrl } = await supabase
          .from('articles')
          .select('id')
          .eq('url', normalizedUrl)
          .limit(1);

        if (byUrl && byUrl.length > 0) {
          console.log(`[Deduplicator] DROPPED DUPLICATE (URL match): "${effectiveTitle.slice(0, 55)}..."`);
          return { success: true, skipped: true, reason: 'Duplicate article detected' };
        }
      }

      if (effectiveTitle) {
        const { data: byTitle } = await supabase
          .from('articles')
          .select('id')
          .eq('title', effectiveTitle)
          .limit(1);

        if (byTitle && byTitle.length > 0) {
          console.log(`[Deduplicator] DROPPED DUPLICATE (Title match): "${effectiveTitle.slice(0, 55)}..."`);
          return { success: true, skipped: true, reason: 'Duplicate article detected' };
        }
      }
    } catch (checkErr) {
      console.warn('[Deduplicator] Check error (continuing):', checkErr.message);
    }
  } else {
    // In-memory deduplication check
    const existing = memoryArticles.find(
      (a) => (normalizedUrl && a.url === normalizedUrl) || (effectiveTitle && a.title === effectiveTitle)
    );
    if (existing) {
      console.log(`[Deduplicator] DROPPED DUPLICATE (memory): "${effectiveTitle.slice(0, 55)}..."`);
      return { success: true, skipped: true, reason: 'Duplicate article detected' };
    }
  }

  // ============================================================================
  // PHASE 1 GUARDRAIL: Strict entity keyword filter
  // Drops any article that does NOT mention our 4 target entities.
  // This prevents Billie Eilish, Lakers merch, and other off-topic noise
  // from reaching Ollama GPU inference or polluting the Supabase database.
  // ============================================================================
  const TARGET_ENTITY_GUARDRAIL = /\b(Infosys|TCS|Tata Consultancy Services|Wipro|Accenture)\b/i;
  const articleText = `${effectiveTitle} ${raw_content}`;
  if (!TARGET_ENTITY_GUARDRAIL.test(articleText)) {
    console.warn(`[Guardrail] DROPPED IRRELEVANT (no target keywords): "${effectiveTitle.slice(0, 55)}..."`);
    return { success: true, skipped: true, reason: 'Failed keyword guardrail' };
  }

  console.log(`[Pipeline] >>> NEW ARTICLE DISCOVERED: "${effectiveTitle.slice(0, 55)}..." [${api_source}] → Sending to AI Triage...`);

  // TRIAGE: Await local AI triage and apply programmatic normalization clamp
  const rawTriage = await triageArticle(raw_content, effectiveTitle, source_name);
  const triage = normalizeTriage(rawTriage);


  // TRIAGE TIMING: Capture triaged_at
  const triaged_at = Date.now();
  const triagedIso = new Date(triaged_at).toISOString();

  const articleId = randomUUID();
  const articlePayload = {
    id: articleId,
    api_source: String(api_source || 'Google News RSS'),
    source_name: String(source_name),
    title: effectiveTitle,
    url: normalizedUrl,
    image_url: image_url ? String(image_url).trim() : null,
    raw_content: String(raw_content),
    entity_mentioned: triage.entity,
    sentiment: triage.sentiment,
    risk_score: triage.risk_score,
    risk_level: triage.risk_level,
    five_bullet_summary: triage.five_bullet_summary,
    status: 'ACTIVE',
    published_at: published_at ? new Date(published_at).toISOString() : ingestedIso,
    ingested_at: ingestedIso,
    triaged_at: triagedIso
  };

  // PARALLEL FORK A: Insert into Supabase articles table
  const dbForkPromise = insertArticleRecord(articlePayload);

  // PARALLEL FORK B: Evaluate and dispatch alerts
  const alertDispatches = [];
  if (triage.risk_level === 'High') {
    alertDispatches.push(sendTelegramAlert(triage.five_bullet_summary, triage.risk_level, effectiveTitle));
  } else if (triage.risk_level === 'Critical') {
    alertDispatches.push(sendTelegramAlert(triage.five_bullet_summary, triage.risk_level, effectiveTitle));
    alertDispatches.push(triggerVoiceCall(triage.five_bullet_summary, effectiveTitle));
  }

  // Execute Fork A (article insert) first — alert dispatches can run in parallel
  const [insertedArticle] = await Promise.all([
    dbForkPromise,
    Promise.all(alertDispatches)
  ]);

  // DISPATCH TIMING: Capture dispatched_at
  const dispatched_at = Date.now();
  const dispatchedIso = new Date(dispatched_at).toISOString();

  // Fire-and-forget update to log the dispatch time on the article
  if (insertedArticle && insertedArticle._dbSuccess === true && supabase) {
    supabase
      .from('articles')
      .update({ dispatched_at: dispatchedIso })
      .eq('id', insertedArticle.id)
      .then(({ error }) => {
        if (error) console.warn('[Supabase] dispatched_at update notice:', error.message);
      });
  }
  if (insertedArticle) {
    insertedArticle.dispatched_at = dispatchedIso;
  }

  // SLA LOGGING: Only insert into alert_logs if article was committed to Supabase
  // (if _dbSuccess is false, the articleId doesn't exist in DB and the FK would crash)
  const sla_seconds = Number(((dispatched_at - ingested_at) / 1000).toFixed(2));
  const sla_breached = sla_seconds > 120;
  const latency_ms = dispatched_at - ingested_at;

  if (insertedArticle._dbSuccess === true) {
    const alertChannel = triage.risk_level === 'Critical' ? 'Voice' : (triage.risk_level === 'High' ? 'Telegram' : 'Email');
    await insertAlertLogRecord({
      article_id: insertedArticle.id,
      channel: alertChannel,
      dispatched_at: dispatchedIso,
      sla_seconds: sla_seconds,
      sla_breached: sla_breached
    });
  } else {
    console.warn(`[Alert Log] Skipped alert_logs insert — article did not commit to Supabase (in-memory fallback).`);
  }

  return {
    success: true,
    article: insertedArticle,
    triage,
    latency_ms,
    sla: {
      ingested_at: ingestedIso,
      triaged_at: triagedIso,
      dispatched_at: dispatchedIso,
      sla_seconds,
      sla_breached,
      sla_target_seconds: 120
    }
  };
}

// POST /api/ingest - Main Ingest Endpoint
app.post('/api/ingest', async (req, res) => {
  try {
    const result = await processIngest(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Ingest Route Error]', error);
    return res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// 5. ADDITIONAL PRODUCTION API ENDPOINTS
// ============================================================================

// GET /api/health - Diagnostic telemetry
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'online',
    system: 'Vee-Alert Real-Time Media Intelligence & Crisis War Room',
    target_client: 'Infosys',
    competitors_monitored: ['TCS', 'Wipro', 'Accenture'],
    sla_target: '< 120 seconds',
    ollama: {
      endpoint: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL
    },
    supabase_connected: Boolean(supabase),
    total_articles_cached: memoryArticles.length
  });
});

// GET /api/articles - Fetch active crisis feeds
app.get('/api/articles', async (_req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('ingested_at', { ascending: false });

      if (error) throw error;
      return res.json({ articles: data || [] });
    }
    return res.json({ articles: memoryArticles });
  } catch (error) {
    return res.json({ articles: memoryArticles });
  }
});

// PATCH /api/articles/:id/acknowledge
app.patch('/api/articles/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('articles')
        .update({ status: 'ACKNOWLEDGED' })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return res.json({ success: true, article: data });
      }
    }
    const memItem = memoryArticles.find((item) => item.id === id);
    if (memItem) memItem.status = 'ACKNOWLEDGED';
    return res.json({ success: true, article: memItem || { id, status: 'ACKNOWLEDGED' } });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to acknowledge article' });
  }
});

// POST /api/fetch-live - Manual trigger to immediately scrape & ingest authentic live news across all sources
app.post('/api/fetch-live', async (_req, res) => {
  try {
    console.log('[API] /api/fetch-live triggered: Fetching real-time authentic news (NewsAPI, GDELT, RSS)...');
    const items = await fetchMultiSourceNews(processIngest);
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: items ? items.length : 0,
      message: 'Live news scraped and processed successfully across verified sources',
      count: items ? items.length : 0,
      articles: items || []
    });
  } catch (error) {
    console.error('[API] /api/fetch-live error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Backward compatibility alias for any legacy triggers (points strictly to real live fetch, zero mock data)
app.post('/api/simulate-crisis', async (_req, res) => {
  try {
    console.log('[API] /api/simulate-crisis called: redirecting to live authentic multi-source fetch...');
    const items = await fetchMultiSourceNews(processIngest);
    return res.status(200).json({
      success: true,
      message: 'Live news fetched',
      count: items ? items.length : 0,
      articles: items || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/news/fetch - On-demand trigger for live multi-source aggregation
app.post('/api/news/fetch', async (_req, res) => {
  try {
    const items = await fetchMultiSourceNews(processIngest);
    return res.json({ success: true, count: items ? items.length : 0, articles: items || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 6. SERVER LAUNCH & AUTOMATED BACKGROUND INGESTION ENGINE
// ============================================================================
let isBackgroundFetching = false;

async function startBackgroundIngestion() {
  if (isBackgroundFetching) return;
  isBackgroundFetching = true;
  try {
    console.log('\n[Engine] ⚡ Initiating automated 60-second background fetch...');
    await fetchMultiSourceNews(processIngest);
  } catch (err) {
    console.error('[Engine] Background fetch error:', err.message);
  } finally {
    isBackgroundFetching = false;
  setTimeout(startBackgroundIngestion, 45000); // Poll every 45 seconds
  }
}

app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 [Vee-Alert Backend] Listening on http://localhost:${PORT}`);
  console.log(`🧠 [Local AI Engine] Ollama model: ${OLLAMA_MODEL} at ${OLLAMA_BASE_URL}`);
  console.log(`📦 [Database] Supabase ${supabase ? 'Configured & Connected' : 'Not configured (In-memory fallback)'}`);
  console.log(`⚡ [SLA Target] Sub-120 seconds event-driven stream`);
  console.log(`🛡️ [Deduplicator] URL & Title deduplication active`);
  console.log(`📰 [News Sources] NewsAPI, GDELT DOC, The Guardian, and Verified Wire RSS`);
  console.log(`⏱️ [Automated Ingestion] 60-second non-overlapping recursive engine active`);
  console.log(`=============================================================\n`);

  // Start the automated continuous ingestion engine on server boot
  startBackgroundIngestion();
});

export default app;
