import { Response } from 'express';
import { 
  IntelligenceItem, 
  CompetitorParityMetrics, 
  SystemHealthMetrics, 
  EntityName 
} from './types.js';
import { INITIAL_INTELLIGENCE_ITEMS } from './mockData.js';

export class DispatchEngine {
  private static articles: IntelligenceItem[] = [...INITIAL_INTELLIGENCE_ITEMS];
  private static sseClients: Response[] = [];
  private static startTime = Date.now();

  public static addSSEClient(res: Response) {
    this.sseClients.push(res);
    // Send initial snapshot
    this.sendEventToClient(res, 'init', {
      articles: this.articles,
      competitors: this.getCompetitorMetrics(),
      health: this.getHealthMetrics()
    });
  }

  public static removeSSEClient(res: Response) {
    this.sseClients = this.sseClients.filter(c => c !== res);
  }

  public static broadcast(eventType: string, data: unknown) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    this.sseClients.forEach(client => {
      try {
        client.write(payload);
      } catch (err) {
        // Client might have disconnected
      }
    });
  }

  private static sendEventToClient(res: Response, eventType: string, data: unknown) {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  public static getArticles(filterEntity?: string, filterPlatform?: string): IntelligenceItem[] {
    let list = this.articles;
    if (filterEntity && filterEntity !== 'ALL') {
      list = list.filter(a => a.entity.toLowerCase() === filterEntity.toLowerCase());
    }
    if (filterPlatform && filterPlatform !== 'ALL') {
      list = list.filter(a => a.platform.toLowerCase() === filterPlatform.toLowerCase());
    }
    return list;
  }

  public static addArticle(article: IntelligenceItem) {
    this.articles.unshift(article);
    this.broadcast('new_article', {
      article,
      competitors: this.getCompetitorMetrics(),
      health: this.getHealthMetrics()
    });
  }

  public static updateVoiceCallStatus(
    articleId: string, 
    status: 'ringing' | 'connected' | 'acknowledged' | 'pr_bridged' | 'completed',
    ivrPressed?: '1' | '2'
  ): IntelligenceItem | null {
    const item = this.articles.find(a => a.id === articleId);
    if (!item) return null;

    item.dispatch.voiceCall.callStatus = status;
    if (ivrPressed) {
      item.dispatch.voiceCall.ivrPressed = ivrPressed;
    }
    if (status === 'acknowledged') {
      item.status = 'acknowledged';
    } else if (status === 'pr_bridged') {
      item.status = 'investigating';
    }

    this.broadcast('call_updated', {
      articleId,
      voiceCall: item.dispatch.voiceCall,
      status: item.status
    });

    return item;
  }

  public static acknowledgeAlert(articleId: string): IntelligenceItem | null {
    const item = this.articles.find(a => a.id === articleId);
    if (!item) return null;
    item.status = 'acknowledged';
    this.broadcast('article_acknowledged', { articleId, status: item.status });
    return item;
  }

  public static getCompetitorMetrics(): Record<EntityName, CompetitorParityMetrics> {
    const entities: EntityName[] = ['Infosys', 'TCS', 'Wipro', 'Accenture'];
    const result = {} as Record<EntityName, CompetitorParityMetrics>;

    entities.forEach(entity => {
      const entityArticles = this.articles.filter(a => a.entity === entity);
      const totalVolume = entityArticles.length || 1;
      const positiveCount = entityArticles.filter(a => a.sentiment === 'positive').length;
      const neutralCount = entityArticles.filter(a => a.sentiment === 'neutral').length;
      const negativeCount = entityArticles.filter(a => a.sentiment === 'negative').length;
      const criticalCount = entityArticles.filter(a => a.sentiment === 'critical_crisis').length;

      // Net Sentiment score (-100 to +100)
      const sentimentAverage = Math.round(
        (entityArticles.reduce((acc, a) => acc + a.sentimentScore, 0) / totalVolume) * 100
      );

      // Social share breakdown
      const twitterCount = entityArticles.filter(a => a.platform === 'twitter').length;
      const igCount = entityArticles.filter(a => a.platform === 'instagram').length;
      const fbCount = entityArticles.filter(a => a.platform === 'facebook').length;
      const printCount = entityArticles.filter(a => a.platform === 'print_epaper').length;

      let topVulnerability = 'None detected. Regular brand baseline.';
      let opportunityNote = 'Maintain market posture.';

      if (entity === 'TCS') {
        topVulnerability = 'European banking cloud infrastructure outage causing SLA penalties.';
        opportunityNote = 'Deploy Infosys Cobalt cloud resilience collateral to contested Nordic accounts.';
      } else if (entity === 'Wipro') {
        topVulnerability = 'Advisory margin compression and consulting management shakeup.';
        opportunityNote = 'Target midwest US enterprise accounts with consulting stability narrative.';
      } else if (entity === 'Accenture') {
        topVulnerability = 'High-cost premium positioning vulnerable in cost-optimization cycles.';
        opportunityNote = 'Counter GenAI marketing with Infosys Topaz ROI efficiency benchmarks.';
      } else if (entity === 'Infosys') {
        topVulnerability = 'Front-page ePaper compliance audit notice requires immediate leadership response.';
        opportunityNote = 'Proactive regulatory transparency can turn scrutiny into gold-standard compliance advantage.';
      }

      result[entity] = {
        entity,
        isClient: entity === 'Infosys',
        sentimentAverage,
        positiveCount,
        neutralCount,
        negativeCount,
        criticalCount,
        totalVolume,
        topVulnerability,
        opportunityNote,
        socialShareOfVoice: {
          twitter: Math.round((twitterCount / totalVolume) * 100) || 35,
          instagram: Math.round((igCount / totalVolume) * 100) || 20,
          facebook: Math.round((fbCount / totalVolume) * 100) || 25,
          print: Math.round((printCount / totalVolume) * 100) || 20
        }
      };
    });

    return result;
  }

  public static getHealthMetrics(): SystemHealthMetrics {
    const totalProcessed = this.articles.length;
    const totalDuration = this.articles.reduce((acc, a) => acc + a.sla.totalDurationMs, 0);
    const avgLatency = totalProcessed > 0 ? Math.round(totalDuration / totalProcessed) : 34000;
    const breached = this.articles.filter(a => a.sla.slaBreached).length;
    const complianceRate = totalProcessed > 0 ? Math.round(((totalProcessed - breached) / totalProcessed) * 1000) / 10 : 100;

    const activeCalls = this.articles.filter(
      a => a.dispatch.voiceCall.dispatched && ['calling', 'ringing', 'connected'].includes(a.dispatch.voiceCall.callStatus)
    ).length;

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      inMemoryQueueSize: 0, // In-memory streaming holds zero residual latency
      processedCount: totalProcessed,
      averageLatencyMs: avgLatency,
      slaComplianceRate: complianceRate,
      activeVoiceCalls: activeCalls,
      connectedClients: this.sseClients.length
    };
  }
}
