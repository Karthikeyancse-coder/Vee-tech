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
  newspaperOrSource: string; // e.g. "The Economic Times", "Mint", "Twitter/X", "Instagram", "Facebook"
  author: string;            // e.g. "Surabhi Agarwal", "@FinTechInsider", "Staff Reporter"
  pageNumber?: string;       // e.g. "Page 1 (Front Page Lead)", "Page 4 - Banking & Finance"
  headline: string;
  shortDescription: string;
  fullText?: string;
  url?: string;
  verifiedSource: boolean;
  reachCount?: string;       // e.g. "1.4M readers", "340K impressions"
}

export interface SLATimestamps {
  publishedAt: string;       // ISO string
  ingestedAt: string;        // ISO string (< 30s)
  triagedAt: string;         // ISO string (< 20s AI inference)
  dispatchedAt: string;      // ISO string (< 10s multi-channel push)
  ingestDurationMs: number;
  triageDurationMs: number;
  dispatchDurationMs: number;
  totalDurationMs: number;
  slaBreached: boolean;      // True if total > 120,000 ms
}

export interface DispatchStatus {
  dashboard: boolean;
  whatsapp: { dispatched: boolean; recipient?: string; timestamp?: string };
  slack: { dispatched: boolean; channel?: string; timestamp?: string };
  email: { dispatched: boolean; recipients?: string[]; timestamp?: string };
  voiceCall: {
    dispatched: boolean;
    targetRole: string;       // e.g. "Chief Marketing Officer / Crisis Director"
    phone: string;
    callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'acknowledged' | 'pr_bridged' | 'completed';
    ivrPressed?: '1' | '2';
    timestamp?: string;
  };
}

export interface IntelligenceItem {
  id: string;
  entity: EntityName;
  isClient: boolean;         // true for Infosys, false for competitors
  platform: PlatformType;
  metadata: ArticleMetadata;
  sentiment: SentimentType;
  sentimentScore: number;    // -1.0 to 1.0
  riskScore: number;         // 1.0 to 10.0
  riskLevel: RiskLevel;
  summary: FiveBulletSummary;
  sla: SLATimestamps;
  dispatch: DispatchStatus;
  status: 'active' | 'investigating' | 'acknowledged' | 'resolved';
}

export interface CompetitorParityMetrics {
  entity: EntityName;
  isClient: boolean;
  sentimentAverage: number;  // -100 to 100
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
  slaComplianceRate: number; // e.g. 99.4%
  activeVoiceCalls: number;
  connectedClients: number;
}
