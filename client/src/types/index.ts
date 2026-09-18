export type EntityName = 'Infosys' | 'TCS' | 'Wipro' | 'Accenture';

export type PlatformType = 'print_epaper' | 'news_web' | 'twitter' | 'instagram' | 'facebook';

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'critical_crisis';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface FiveBulletSummary {
  whatHappened: string;
  whyItMatters: string;
  riskJustification: string;
  competitorImpact: string;
  recommendedAction: string;
}

export interface ArticleMetadata {
  newspaperOrSource: string;
  author: string;
  pageNumber?: string;
  headline: string;
  shortDescription: string;
  fullText?: string;
  url?: string;
  verifiedSource: boolean;
  reachCount?: string;
}

export interface SLATimestamps {
  publishedAt: string;
  ingestedAt: string;
  triagedAt: string;
  dispatchedAt: string;
  ingestDurationMs: number;
  triageDurationMs: number;
  dispatchDurationMs: number;
  totalDurationMs: number;
  slaBreached: boolean;
}

export interface DispatchStatus {
  dashboard: boolean;
  whatsapp: { dispatched: boolean; recipient?: string; timestamp?: string };
  slack: { dispatched: boolean; channel?: string; timestamp?: string };
  email: { dispatched: boolean; recipients?: string[]; timestamp?: string };
  voiceCall: {
    dispatched: boolean;
    targetRole: string;
    phone: string;
    callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'acknowledged' | 'pr_bridged' | 'completed';
    ivrPressed?: '1' | '2';
    timestamp?: string;
  };
}

export interface IntelligenceItem {
  id: string;
  entity: EntityName;
  isClient: boolean;
  platform: PlatformType;
  metadata: ArticleMetadata;
  sentiment: SentimentType;
  sentimentScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  summary: FiveBulletSummary;
  sla: SLATimestamps;
  dispatch: DispatchStatus;
  status: 'active' | 'investigating' | 'acknowledged' | 'resolved';
}

export interface CompetitorParityMetrics {
  entity: EntityName;
  isClient: boolean;
  sentimentAverage: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  criticalCount: number;
  totalVolume: number;
  topVulnerability?: string;
  opportunityNote?: string;
  socialShareOfVoice: {
    twitter: number;
    instagram: number;
    facebook: number;
    print: number;
  };
}

export interface SystemHealthMetrics {
  uptimeSeconds: number;
  inMemoryQueueSize: number;
  processedCount: number;
  averageLatencyMs: number;
  slaComplianceRate: number;
  activeVoiceCalls: number;
  connectedClients: number;
}
