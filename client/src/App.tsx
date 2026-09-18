import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { WarRoom } from './components/WarRoom';
import { CompetitorRadar } from './components/CompetitorRadar';
import { SLAEngine } from './components/SLAEngine';
import { OmnichannelModal } from './components/OmnichannelModal';
import { SimulationBar } from './components/SimulationBar';
import { VoiceCallModal } from './components/VoiceCallModal';
import { ArticleDetailModal } from './components/ArticleDetailModal';
import { DeviceSimulator } from './components/DeviceSimulator';
import { useVoiceCall } from './hooks/useVoiceCall';
import { useRealtimeWarRoom, RealtimeArticle } from './hooks/useRealtimeWarRoom';
import { 
  fetchCompetitors, 
  fetchHealth, 
  triggerScenario, 
  ingestCustomPayload, 
  updateVoiceCall 
} from './services/api';
import { IntelligenceItem, CompetitorParityMetrics, SystemHealthMetrics, EntityName } from './types';
import confetti from 'canvas-confetti';

/**
 * Adapter converting RealtimeArticle (from Supabase / Server) to IntelligenceItem
 */
function adaptRealtimeArticle(rt: RealtimeArticle): IntelligenceItem {
  const isClient = rt.entity_mentioned === 'Infosys';
  const bullets = Array.isArray(rt.five_bullet_summary)
    ? rt.five_bullet_summary
    : Object.values(rt.five_bullet_summary);

  const publishedAt = rt.published_at || new Date().toISOString();
  const ingestedAt = rt.ingested_at || new Date().toISOString();
  const triagedAt = rt.triaged_at || new Date().toISOString();

  const totalDurationMs = Math.max(
    14000,
    new Date(triagedAt).getTime() - new Date(ingestedAt).getTime() + 4000
  );

  return {
    id: rt.id,
    entity: (rt.entity_mentioned as EntityName) || 'Infosys',
    isClient,
    platform: rt.source_name.toLowerCase().includes('twitter')
      ? 'twitter'
      : rt.source_name.toLowerCase().includes('instagram')
      ? 'instagram'
      : rt.source_name.toLowerCase().includes('facebook')
      ? 'facebook'
      : 'print_epaper',
    metadata: {
      newspaperOrSource: rt.source_name,
      author: 'Senior Correspondent / Byline',
      pageNumber: rt.source_name.includes('Page') ? rt.source_name.match(/Page \d+/)?.[0] : undefined,
      headline: rt.title,
      shortDescription: rt.raw_content,
      fullText: rt.raw_content,
      url: rt.url,
      verifiedSource: true,
      reachCount: '1.2M Reach'
    },
    sentiment: rt.sentiment.toLowerCase() as any,
    sentimentScore: rt.risk_level === 'Critical' ? -0.92 : rt.risk_level === 'High' ? -0.65 : 0.1,
    riskScore: Number(rt.risk_score),
    riskLevel: rt.risk_level,
    summary: {
      whatHappened: bullets[0] || rt.raw_content,
      whyItMatters: bullets[1] || 'Strategic enterprise risk requiring executive visibility.',
      riskJustification: bullets[2] || `Risk rating: ${rt.risk_score}/10 based on publisher circulation.`,
      competitorImpact: bullets[3] || 'TCS and Accenture assessing account positioning.',
      recommendedAction: bullets[4] || 'Convene immediate crisis response briefing.'
    },
    sla: {
      publishedAt,
      ingestedAt,
      triagedAt,
      dispatchedAt: new Date().toISOString(),
      ingestDurationMs: 14000,
      triageDurationMs: 16000,
      dispatchDurationMs: 4000,
      totalDurationMs,
      slaBreached: totalDurationMs > 120000
    },
    dispatch: {
      dashboard: true,
      whatsapp: { dispatched: rt.risk_level === 'High' || rt.risk_level === 'Critical', recipient: '+91-98840-CRISIS' },
      slack: { dispatched: true, channel: '#crisis-war-room-exec' },
      email: { dispatched: rt.risk_level === 'Critical', recipients: ['cmo@infosys.com'] },
      voiceCall: {
        dispatched: rt.risk_level === 'Critical',
        targetRole: 'Chief Crisis Officer & CMO',
        phone: '+91-98840-83333',
        callStatus: rt.risk_level === 'Critical' ? 'ringing' : 'idle'
      }
    },
    status: rt.status.toLowerCase() as any
  };
}

export function App() {
  const [competitors, setCompetitors] = useState<Record<EntityName, CompetitorParityMetrics> | null>(null);
  const [health, setHealth] = useState<SystemHealthMetrics | null>(null);

  const [activeTab, setActiveTab] = useState<'war-room' | 'competitor-radar' | 'sla-engine' | 'omnichannel'>('war-room');
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile-preview'>('desktop');

  // Modals & Inspectors
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [selectedArticleForDetail, setSelectedArticleForDetail] = useState<IntelligenceItem | null>(null);

  // Interactive Voice Call Hook
  const {
    activeCallArticle,
    callState,
    ivrMessage,
    audioLevel,
    triggerVoiceCall,
    answerCall,
    handleKeypadPress,
    closeCall
  } = useVoiceCall();

  // Supabase Realtime & Express War Room Hook
  const {
    articles: realtimeArticles,
    simulateCrisis: runSimulateCrisis,
    acknowledgeArticle: runAcknowledgeArticle,
    testVoiceCall
  } = useRealtimeWarRoom(useCallback((newCritical: RealtimeArticle) => {
    // Automatically launch voice call for critical incoming items
    const adapted = adaptRealtimeArticle(newCritical);
    triggerVoiceCall(adapted);
  }, [triggerVoiceCall]));

  // Map realtime articles to IntelligenceItem
  const articles: IntelligenceItem[] = realtimeArticles.map(adaptRealtimeArticle);

  // Load competitor and telemetry health data
  useEffect(() => {
    fetchCompetitors().then(data => {
      if (data) setCompetitors(data);
    });
    fetchHealth().then(data => {
      if (data) setHealth(data);
    });
  }, [realtimeArticles]);

  // Acknowledge handler (triggers PATCH /api/articles/:id/acknowledge)
  const handleAcknowledge = async (id: string) => {
    await runAcknowledgeArticle(id);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 }
    });
  };

  // Direct "Simulate Crisis" button handler from Header
  const handleHeaderSimulateCrisis = async () => {
    try {
      const result = await runSimulateCrisis();
      if (result?.article?.risk_level === 'Critical') {
        const adapted = adaptRealtimeArticle(result.article);
        triggerVoiceCall(adapted);
      }
    } catch (e) {
      console.error('Simulate crisis trigger error:', e);
      setIsSimModalOpen(true);
    }
  };

  const handleVoiceCall = async (article: IntelligenceItem) => {
    await testVoiceCall(article.metadata.headline, [
      article.summary.whatHappened,
      article.summary.whyItMatters,
      article.summary.riskJustification,
      article.summary.competitorImpact,
      article.summary.recommendedAction
    ]);
    triggerVoiceCall(article);
  };

  // Scenario presets handler from modal
  const handleTriggerPreset = async (scenarioKey: string) => {
    const newArticle = await triggerScenario(scenarioKey);
    if (newArticle && newArticle.riskLevel === 'Critical') {
      triggerVoiceCall(newArticle);
    }
  };

  // Custom ingest handler
  const handleCustomIngest = async (payload: any) => {
    const newArticle = await ingestCustomPayload(payload);
    if (newArticle && newArticle.riskLevel === 'Critical') {
      triggerVoiceCall(newArticle);
    }
  };

  const criticalCount = articles.filter(a => a.riskLevel === 'Critical' && a.status === 'active').length;
  const avgLatency = health?.averageLatencyMs || 32500;
  const slaCompliance = health?.slaComplianceRate || 100.0;

  return (
    <div className="min-h-screen bg-[#060709] text-zinc-100 flex flex-col selection:bg-rose-500/20 selection:text-rose-200">
      {/* Enterprise Header with Single 'Simulate Crisis' Primary Action */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewportMode={viewportMode}
        setViewportMode={setViewportMode}
        criticalCount={criticalCount}
        avgLatency={avgLatency}
        slaCompliance={slaCompliance}
        onOpenQuickTrigger={handleHeaderSimulateCrisis}
      />

      {/* Main Content: Adaptive Desktop / Mobile Device Viewport */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6">
        <DeviceSimulator
          viewportMode={viewportMode}
          onExitMobile={() => setViewportMode('desktop')}
        >
          {activeTab === 'war-room' && (
            <WarRoom
              articles={articles}
              onAcknowledge={handleAcknowledge}
              onOpenVoiceCall={handleVoiceCall}
              onSelectArticle={(article) => setSelectedArticleForDetail(article)}
              onOpenOmnichannel={() => setActiveTab('omnichannel')}
            />
          )}

          {activeTab === 'competitor-radar' && (
            <CompetitorRadar
              competitors={competitors}
              articles={articles}
              onSelectArticle={(article) => setSelectedArticleForDetail(article)}
            />
          )}

          {activeTab === 'sla-engine' && (
            <SLAEngine
              articles={articles}
              health={health}
            />
          )}

          {activeTab === 'omnichannel' && (
            <OmnichannelModal
              articles={articles}
              onOpenVoiceCall={handleVoiceCall}
            />
          )}
        </DeviceSimulator>
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-3 text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Vee-Alert Production Engine (Port 5000) • Supabase Realtime Active</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Target: Infosys</span>
          <span>•</span>
          <span>Competitors: TCS, Wipro, Accenture</span>
          <span>•</span>
          <span>SLA: &lt; 120s</span>
        </div>
      </footer>

      {/* Crisis Preset & Custom Ingest Console */}
      <SimulationBar
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        onTriggerPreset={handleTriggerPreset}
        onCustomIngest={handleCustomIngest}
      />

      {/* Interactive Voice Call Modal Overlay */}
      <VoiceCallModal
        article={activeCallArticle}
        callState={callState}
        ivrMessage={ivrMessage}
        audioLevel={audioLevel}
        onAnswer={answerCall}
        onKeypadPress={(key) => {
          handleKeypadPress(key);
          if (activeCallArticle) {
            updateVoiceCall(
              activeCallArticle.id, 
              key === '1' ? 'acknowledged' : 'pr_bridged', 
              key as any
            );
          }
        }}
        onClose={closeCall}
      />

      {/* Article Metadata Inspector */}
      <ArticleDetailModal
        article={selectedArticleForDetail}
        onClose={() => setSelectedArticleForDetail(null)}
        onOpenVoiceCall={handleVoiceCall}
      />
    </div>
  );
}

export default App;
