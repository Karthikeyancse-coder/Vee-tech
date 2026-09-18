import { IntelligenceItem, CompetitorParityMetrics, SystemHealthMetrics, EntityName } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export async function fetchArticles(entity?: string, platform?: string): Promise<IntelligenceItem[]> {
  try {
    const params = new URLSearchParams();
    if (entity && entity !== 'ALL') params.append('entity', entity);
    if (platform && platform !== 'ALL') params.append('platform', platform);
    
    const res = await fetch(`${BASE_URL}/api/articles?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch articles');
    const data = await res.json();
    return data.articles;
  } catch (err) {
    console.warn('API connection failed, falling back to local store', err);
    return [];
  }
}

export async function fetchCompetitors(): Promise<Record<EntityName, CompetitorParityMetrics> | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/competitors`);
    if (!res.ok) throw new Error('Failed to fetch competitors');
    const data = await res.json();
    return data.competitors;
  } catch (err) {
    return null;
  }
}

export async function fetchHealth(): Promise<SystemHealthMetrics | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error('Failed to fetch health');
    const data = await res.json();
    return data.telemetry;
  } catch (err) {
    return null;
  }
}

export async function triggerScenario(scenarioKey: string): Promise<IntelligenceItem | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/simulate/${scenarioKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    return data.article;
  } catch (err) {
    console.error('Trigger scenario error:', err);
    return null;
  }
}

export async function ingestCustomPayload(payload: {
  newspaperOrSource: string;
  author: string;
  pageNumber?: string;
  headline: string;
  shortDescription: string;
  entity?: EntityName;
  platform?: string;
}): Promise<IntelligenceItem | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.article;
  } catch (err) {
    console.error('Ingest error:', err);
    return null;
  }
}

export async function updateVoiceCall(articleId: string, status: string, key?: '1' | '2') {
  try {
    const res = await fetch(`${BASE_URL}/api/call/${articleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, key })
    });
    return await res.json();
  } catch (err) {
    console.error('Update voice call error:', err);
    return null;
  }
}

export async function acknowledgeAlert(articleId: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/articles/${articleId}/acknowledge`, {
      method: 'PATCH'
    });
    return await res.json();
  } catch (err) {
    console.error('Acknowledge error:', err);
    return null;
  }
}

export function subscribeToLiveStream(
  onInit: (data: { articles: IntelligenceItem[]; competitors: Record<EntityName, CompetitorParityMetrics>; health: SystemHealthMetrics }) => void,
  onNewArticle: (data: { article: IntelligenceItem; competitors: Record<EntityName, CompetitorParityMetrics>; health: SystemHealthMetrics }) => void,
  onCallUpdated: (data: { articleId: string; voiceCall: any; status: string }) => void,
  onAcknowledged: (data: { articleId: string; status: string }) => void
) {
  const eventSource = new EventSource(`${BASE_URL}/api/stream`);

  eventSource.addEventListener('init', (e) => {
    try {
      const data = JSON.parse(e.data);
      onInit(data);
    } catch (err) {
      console.error('Error parsing init event', err);
    }
  });

  eventSource.addEventListener('new_article', (e) => {
    try {
      const data = JSON.parse(e.data);
      onNewArticle(data);
    } catch (err) {
      console.error('Error parsing new_article event', err);
    }
  });

  eventSource.addEventListener('call_updated', (e) => {
    try {
      const data = JSON.parse(e.data);
      onCallUpdated(data);
    } catch (err) {
      console.error('Error parsing call_updated event', err);
    }
  });

  eventSource.addEventListener('article_acknowledged', (e) => {
    try {
      const data = JSON.parse(e.data);
      onAcknowledged(data);
    } catch (err) {
      console.error('Error parsing article_acknowledged event', err);
    }
  });

  return () => {
    eventSource.close();
  };
}
