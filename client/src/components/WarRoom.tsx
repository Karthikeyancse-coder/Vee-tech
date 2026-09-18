import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  MessageSquare, 
  Hash, 
  PhoneCall, 
  Phone
} from 'lucide-react';
import { IntelligenceItem } from '../types';

interface WarRoomProps {
  articles: IntelligenceItem[];
  onAcknowledge: (id: string) => void;
  onOpenVoiceCall: (article: IntelligenceItem) => void;
  onSelectArticle: (article: IntelligenceItem) => void;
  onOpenOmnichannel: () => void;
}

export const WarRoom: React.FC<WarRoomProps> = ({
  articles,
  onAcknowledge,
  onOpenVoiceCall,
  onSelectArticle
}) => {
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'INFOSYS_ONLY'>('ALL');

  const filtered = articles.filter(a => {
    if (filter === 'CRITICAL') return a.riskLevel === 'Critical';
    if (filter === 'INFOSYS_ONLY') return a.entity === 'Infosys';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Subtle Filter Sub-Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Crisis War Room Feed
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time event stream triaged in-memory with sub-120 second SLA.
          </p>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'ALL' ? 'bg-slate-800 text-white font-medium shadow-sm' : 'hover:text-slate-200'
            }`}
          >
            All Stream ({articles.length})
          </button>
          <button
            onClick={() => setFilter('CRITICAL')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'CRITICAL' ? 'bg-slate-800 text-rose-400 font-medium shadow-sm' : 'hover:text-slate-200'
            }`}
          >
            Critical Only
          </button>
          <button
            onClick={() => setFilter('INFOSYS_ONLY')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'INFOSYS_ONLY' ? 'bg-slate-800 text-white font-medium shadow-sm' : 'hover:text-slate-200'
            }`}
          >
            Infosys Only
          </button>
        </div>
      </div>

      {/* Articles Cards */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {filtered.map((article, idx) => {
            const isCritical = article.riskLevel === 'Critical';
            const isHigh = article.riskLevel === 'High';
            const durationSec = Math.round(article.sla.totalDurationMs / 1000);

            return (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className={`bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg transition-all ${
                  isCritical
                    ? 'border-l-4 border-l-rose-500'
                    : isHigh
                    ? 'border-l-4 border-l-amber-500'
                    : ''
                }`}
              >
                {/* Top Meta Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Left: Single Badge */}
                  <div>
                    {isCritical ? (
                      <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono">
                        CRITICAL {article.riskScore}/10
                      </span>
                    ) : isHigh ? (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono">
                        HIGH {article.riskScore}/10
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono">
                        {article.riskLevel.toUpperCase()} {article.riskScore}/10
                      </span>
                    )}
                  </div>

                  {/* Center: Plain Text Metadata */}
                  <div className="text-slate-400 text-xs">
                    {article.entity} • {article.metadata.newspaperOrSource}
                    {article.metadata.pageNumber ? ` (${article.metadata.pageNumber})` : ''}
                  </div>

                  {/* Right: SLA Timer */}
                  <div className="text-emerald-400 text-xs font-mono font-medium">
                    {durationSec}s / 120s
                  </div>
                </div>

                {/* Headline */}
                <h3 className="text-lg font-bold text-slate-100 mt-2 mb-3 leading-snug">
                  {article.metadata.headline}
                </h3>

                {/* Executive Briefing Section */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 text-xs space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-bold text-white shrink-0 sm:w-44">
                      What Happened:
                    </span>
                    <span className="text-slate-300 leading-relaxed">
                      {article.summary.whatHappened}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-bold text-white shrink-0 sm:w-44">
                      Why It Matters:
                    </span>
                    <span className="text-slate-300 leading-relaxed">
                      {article.summary.whyItMatters}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-bold text-white shrink-0 sm:w-44">
                      Risk Score Justification:
                    </span>
                    <span className="text-slate-300 leading-relaxed">
                      {article.summary.riskJustification}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="font-bold text-white shrink-0 sm:w-44">
                      Competitor Impact:
                    </span>
                    <span className="text-slate-300 leading-relaxed">
                      {article.summary.competitorImpact}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 pt-1 border-t border-slate-900">
                    <span className="font-bold text-white shrink-0 sm:w-44">
                      Recommended Action:
                    </span>
                    <span className="text-slate-300 leading-relaxed">
                      {article.summary.recommendedAction}
                    </span>
                  </div>
                </div>

                {/* Card Footer Row */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: Dispatched via + subtle monochrome/slate icons */}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-slate-500">Dispatched via</span>
                    <div className="flex items-center gap-2.5 text-slate-400">
                      {article.dispatch.whatsapp.dispatched && (
                        <span title="WhatsApp" className="flex items-center gap-1 hover:text-slate-200">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-[11px]">WhatsApp</span>
                        </span>
                      )}
                      {article.dispatch.slack.dispatched && (
                        <span title="Slack" className="flex items-center gap-1 hover:text-slate-200">
                          <Hash className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Slack</span>
                        </span>
                      )}
                      {article.dispatch.voiceCall.dispatched && (
                        <span title="Phone Call" className="flex items-center gap-1 text-rose-400 hover:text-rose-300">
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Phone</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectArticle(article)}
                      className="text-slate-400 hover:text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                    >
                      Inspect Metadata
                    </button>

                    {isCritical && (
                      <button
                        onClick={() => onOpenVoiceCall(article)}
                        className="bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs px-3 py-1.5 font-medium transition-colors shadow-sm"
                      >
                        Simulate Voice Call
                      </button>
                    )}

                    {article.status !== 'acknowledged' ? (
                      <button
                        onClick={() => onAcknowledge(article.id)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs px-3 py-1.5 font-medium transition-colors"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1 px-2 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800">
            <p className="text-slate-400 text-sm">No articles matching the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
