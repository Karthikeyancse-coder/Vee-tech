import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendWhatsAppAlert, sendEmailAlert, triggerVoiceCall } from '../services/notifier.js';

dotenv.config();

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
type ArticleRow = {
  id: string;
  source_name: string;
  title: string;
  url: string | null;
  raw_content: string;
  entity_mentioned: string;
  sentiment: string;
  risk_score: number;
  risk_level: RiskLevel;
  five_bullet_summary: string[];
  status: 'ACTIVE' | 'ACKNOWLEDGED';
  published_at: string;
  ingested_at: string;
  triaged_at: string;
};

type TriageResult = {
  entity: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  theme: string;
  risk_score: number;
  risk_level: RiskLevel;
  requires_voice_escalation: boolean;
  five_bullet_summary: string[];
};

const app = express();
const PORT = Number(process.env.PORT || 5000);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase: SupabaseClient | null = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;
const memoryArticles: ArticleRow[] = [];
const memoryAlertLogs: Array<Record<string, unknown>> = [];

app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));
app.use(express.json({ limit: '2mb' }));

function asRiskLevel(value: unknown): RiskLevel {
  return value === 'Critical' || value === 'High' || value === 'Medium' ? value : 'Low';
}

function normalizeTriage(value: unknown, content: string, title: string): TriageResult {
  const candidate = (value && typeof value === 'object' ? value : {}) as Partial<TriageResult>;
  const riskLevel = asRiskLevel(candidate.risk_level);
  const score = Number(candidate.risk_score);
  const bullets = Array.isArray(candidate.five_bullet_summary)
    ? candidate.five_bullet_summary.filter((item): item is string => typeof item === 'string').slice(0, 5)
    : [];
  return {
    entity: typeof candidate.entity === 'string' && candidate.entity.trim() ? candidate.entity.trim() : 'Infosys',
    sentiment: candidate.sentiment === 'Positive' || candidate.sentiment === 'Negative' ? candidate.sentiment : 'Neutral',
    theme: typeof candidate.theme === 'string' ? candidate.theme : 'Market intelligence',
    risk_score: Number.isFinite(score) ? Math.min(10, Math.max(1, score)) : 5,
    risk_level: riskLevel,
    requires_voice_escalation: riskLevel === 'Critical',
    five_bullet_summary: bullets.length === 5 ? bullets : [
      `What happened: ${title || 'A new media event'} was ingested for triage.`,
      'Why it matters: The event may affect enterprise reputation, operations, or client confidence.',
      'Risk score rationale: The score reflects the available evidence and media severity.',
      'Competitor impact: Competitors may use the event to influence shared enterprise accounts.',
      'Recommended action: Validate the facts and convene the appropriate response owners.'
    ].map((fallback, index) => bullets[index] || (index === 0 ? `${fallback} Source content: ${content.slice(0, 180)}` : fallback))
  };
}

export async function triageNewsArticle(rawContent: string, title = '', sourceName = ''): Promise<TriageResult> {
  const prompt = [
    'You are the Vee-Alert AI media triage agent.',
    'Return JSON only. Do not include markdown, explanations, or code fences.',
    'Use exactly this schema: {"entity":"...","sentiment":"Positive|Neutral|Negative","theme":"...","risk_score":9.5,"risk_level":"Low|Medium|High|Critical","requires_voice_escalation":true,"five_bullet_summary":["What happened...","Why it matters...","Risk score rationale...","Competitor impact...","Recommended action..."]}.',
    'requires_voice_escalation must be true only for Critical risk.',
    `Source: ${sourceName || 'Unknown'}`,
    `Title: ${title || 'Breaking media update'}`,
    `Content: ${rawContent}`
  ].join('\n');

  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1, num_predict: 512 }
    }, { timeout: 18000 });
    return normalizeTriage(JSON.parse(String(response.data?.response || '{}')), rawContent, title);
  } catch (error) {
    console.warn(`[Ollama] Triage unavailable; using deterministic local triage: ${error instanceof Error ? error.message : String(error)}`);
    return localTriage(rawContent, title);
  }
}

function localTriage(content: string, title: string): TriageResult {
  const text = `${title} ${content}`.toLowerCase();
  const entity = text.includes('tcs') ? 'TCS' : text.includes('wipro') ? 'Wipro' : text.includes('accenture') ? 'Accenture' : 'Infosys';
  const critical = /rbi|regulator|audit|fraud|breach|probe/.test(text);
  const high = /outage|blackout|lawsuit|down|compliance/.test(text);
  const riskLevel: RiskLevel = critical && entity === 'Infosys' ? 'Critical' : high || critical ? 'High' : 'Medium';
  const score = riskLevel === 'Critical' ? 9.6 : riskLevel === 'High' ? 7.2 : 4.2;
  return {
    entity,
    sentiment: riskLevel === 'Medium' ? 'Neutral' : 'Negative',
    theme: critical ? 'Regulatory compliance' : high ? 'Operational disruption' : 'Market operations',
    risk_score: score,
    risk_level: riskLevel,
    requires_voice_escalation: riskLevel === 'Critical',
    five_bullet_summary: [
      `What happened: ${title || 'A media event'} was reported concerning ${entity}.`,
      `Why it matters: The event may affect ${entity} client confidence and operating reputation.`,
      `Risk score rationale: ${score}/10 reflects the severity and evidence in the report.`,
      `Competitor impact: Rival providers may use the event in shared account conversations.`,
      `Recommended action: Brief response owners and validate the underlying facts immediately.`
    ]
  };
}

async function insertArticle(article: ArticleRow): Promise<ArticleRow> {
  if (!supabase) {
    memoryArticles.unshift(article);
    return article;
  }
  const { data, error } = await supabase.from('articles').insert(article).select().single();
  if (error) throw error;
  return data as ArticleRow;
}

async function insertAlertLog(articleId: string, channel: 'WhatsApp' | 'Email' | 'Voice', dispatchedAt: string, ingestedAt: string) {
  const dispatchedMs = new Date(dispatchedAt).getTime();
  const slaSeconds = Number(((dispatchedMs - new Date(ingestedAt).getTime()) / 1000).toFixed(2));
  const log = {
    article_id: articleId,
    channel,
    dispatched_at: dispatchedAt,
    sla_seconds: slaSeconds,
    sla_breached: slaSeconds > 120
  };
  if (supabase) {
    const { error } = await supabase.from('alert_logs').insert(log);
    if (error) throw error;
  } else {
    memoryAlertLogs.unshift({ id: `memory-${Date.now()}`, ...log });
  }
  return log;
}

async function processIngest(body: Record<string, unknown>) {
  const sourceName = String(body.source_name || body.newspaperOrSource || 'News Wire');
  const title = String(body.title || body.headline || 'Breaking media update');
  const rawContent = String(body.raw_content || body.fullText || body.shortDescription || '');
  if (!rawContent.trim()) throw new Error('raw_content or shortDescription is required');
  const ingestedAt = new Date();
  const triage = await triageNewsArticle(rawContent, title, sourceName);
  const triagedAt = new Date();
  const article = await insertArticle({
    id: randomUUID(),
    source_name: sourceName,
    title,
    url: body.url ? String(body.url) : null,
    raw_content: rawContent,
    entity_mentioned: triage.entity,
    sentiment: triage.sentiment,
    risk_score: triage.risk_score,
    risk_level: triage.risk_level,
    five_bullet_summary: triage.five_bullet_summary,
    status: 'ACTIVE',
    published_at: body.published_at ? new Date(String(body.published_at)).toISOString() : ingestedAt.toISOString(),
    ingested_at: ingestedAt.toISOString(),
    triaged_at: triagedAt.toISOString()
  });
  const notifications: Array<Record<string, unknown>> = [];
  if (triage.risk_level === 'High' || triage.risk_level === 'Critical') {
    const dispatches = [
      sendWhatsAppAlert(triage.five_bullet_summary, title, triage.risk_score),
      sendEmailAlert(triage.five_bullet_summary, title, triage.risk_score)
    ];
    if (triage.risk_level === 'Critical') {
      dispatches.push(triggerVoiceCall(title, triage.five_bullet_summary));
    }
    const results = await Promise.all(dispatches);
    notifications.push(...results.map((result) => ({ ...result })));
  }
  const dispatchedAt = new Date();
  for (const notification of notifications) {
    if ((notification.channel === 'WhatsApp' || notification.channel === 'Email' || notification.channel === 'Voice') && notification.success) {
      await insertAlertLog(article.id, notification.channel, dispatchedAt.toISOString(), article.ingested_at);
    }
  }
  const slaSeconds = Number(((dispatchedAt.getTime() - ingestedAt.getTime()) / 1000).toFixed(2));
  return {
    success: true,
    article,
    notifications,
    sla: {
      ingested_at: article.ingested_at,
      triaged_at: article.triaged_at,
      dispatched_at: dispatchedAt.toISOString(),
      sla_seconds: slaSeconds,
      sla_breached: slaSeconds > 120,
      sla_target_seconds: 120
    }
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    system: 'Vee-Alert Real-Time Media Intelligence & Crisis War Room',
    target_client: 'Infosys',
    competitors_monitored: ['TCS', 'Wipro', 'Accenture'],
    sla_target: '< 120 seconds',
    ollama: { endpoint: OLLAMA_BASE_URL, model: OLLAMA_MODEL },
    supabase_connected: Boolean(supabase),
    total_articles_cached: memoryArticles.length
  });
});

app.get('/api/articles', async (_req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('articles').select('*').eq('status', 'ACTIVE').order('ingested_at', { ascending: false });
      if (error) throw error;
      return res.json({ articles: data || [] });
    }
    return res.json({ articles: memoryArticles });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load articles' });
  }
});

app.post('/api/ingest', async (req, res) => {
  try {
    return res.status(200).json(await processIngest(req.body));
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Ingestion failed' });
  }
});

app.post('/api/simulate-crisis', async (_req, res) => {
  try {
    return res.status(200).json(await processIngest({
      source_name: 'The Economic Times (Page 1 Lead)',
      title: 'RBI Issues Compliance Audit Notice on Infosys Core Banking Platform',
      url: 'https://economictimes.indiatimes.com/tech/ites/rbi-audit-infosys-finacle',
      published_at: new Date(Date.now() - 32000).toISOString(),
      raw_content: 'The Reserve Bank of India issued an urgent compliance audit notice regarding Infosys Finacle deployments, data sovereignty, and high-availability cloud fallback controls.'
    }));
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Simulation failed' });
  }
});

app.patch('/api/articles/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  try {
    if (supabase) {
      const { data, error } = await supabase.from('articles').update({ status: 'ACKNOWLEDGED' }).eq('id', id).select().single();
      if (error) throw error;
      return res.json({ success: true, article: data });
    }
    const article = memoryArticles.find((item) => item.id === id);
    if (!article) return res.status(404).json({ error: 'Article not found' });
    article.status = 'ACKNOWLEDGED';
    return res.json({ success: true, article });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Acknowledgement failed' });
  }
});

app.post('/api/trigger-voice-call', async (req, res) => {
  try {
    const result = await triggerVoiceCall(
      String(req.body.title || 'Emergency Priority Briefing'),
      Array.isArray(req.body.five_bullet_summary) ? req.body.five_bullet_summary : [],
      req.body.phone ? String(req.body.phone) : undefined
    );
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Voice dispatch failed' });
  }
});

app.post('/api/simulate/:scenario', async (req, res) => {
  const scenarios: Record<string, Record<string, string>> = {
    'infosys-rbi-epaper': { source_name: 'The Economic Times', title: 'RBI Initiates Digital Compliance Audit on Infosys Core Banking Deployments', raw_content: 'Banking regulator issues an urgent 48-hour compliance directive affecting Infosys Finacle clients.' },
    'tcs-outage-twitter': { source_name: 'Twitter/X Live Sentiment Stream', title: 'Catastrophic Outage Across TCS European Core Banking Cloud', raw_content: 'Over 40,000 tweets report a payment blackout across Scandinavian retail banks.' },
    'wipro-reorganization-facebook': { source_name: 'Facebook Live Business Journal', title: 'Wipro Announces High-Level Leadership Reshuffle', raw_content: 'Executive restructuring creates short-term transition friction across consulting practices.' },
    'accenture-genai-instagram': { source_name: 'Instagram TechTrends Global', title: 'Accenture Launches Global Enterprise Generative AI Campaign', raw_content: 'Accenture released case studies showing productivity gains in enterprise modernization.' }
  };
  const payload = scenarios[req.params.scenario];
  if (!payload) return res.status(400).json({ error: 'Unknown scenario identifier' });
  try {
    return res.json({ ...(await processIngest(payload)), scenario: req.params.scenario });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Scenario failed' });
  }
});

app.listen(PORT, () => {
  console.log(`[Vee-Alert Backend] Listening on http://localhost:${PORT}`);
  console.log(`[Database] Supabase ${supabase ? 'configured' : 'not configured; using local memory only'}`);
});

export default app;
