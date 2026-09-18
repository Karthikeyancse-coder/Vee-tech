import React, { useState } from 'react';
import { 
  Radio, 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert, 
  Target, 
  Building2, 
  BarChart3, 
  Twitter, 
  Instagram, 
  Facebook, 
  Newspaper,
  ArrowRight
} from 'lucide-react';
import { CompetitorParityMetrics, IntelligenceItem, EntityName } from '../types';

interface CompetitorRadarProps {
  competitors: Record<EntityName, CompetitorParityMetrics> | null;
  articles: IntelligenceItem[];
  onSelectArticle: (article: IntelligenceItem) => void;
}

export const CompetitorRadar: React.FC<CompetitorRadarProps> = ({
  competitors,
  articles,
  onSelectArticle
}) => {
  const [selectedEntity, setSelectedEntity] = useState<EntityName>('TCS');

  if (!competitors) {
    return (
      <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl">
        <p className="text-zinc-400 text-sm font-mono">Loading real-time competitor telemetry...</p>
      </div>
    );
  }

  const entities: EntityName[] = ['Infosys', 'TCS', 'Wipro', 'Accenture'];
  const activeCompetitor = competitors[selectedEntity];
  const infosysMetrics = competitors['Infosys'];

  // Articles for the selected competitor
  const entityArticles = articles.filter(a => a.entity === selectedEntity);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-zinc-900 to-zinc-900/80 border border-blue-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Radio className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Competitor Sentiment Radar & Vulnerability Intercept
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time tracking of Infosys vs. TCS, Wipro, and Accenture across print media and social channels.
          </p>
        </div>

        {/* Competitor Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
          {entities.map(e => (
            <button
              key={e}
              onClick={() => setSelectedEntity(e)}
              className={`px-3 py-1 rounded font-medium transition-all ${
                selectedEntity === e
                  ? e === 'Infosys'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {e} {e === 'Infosys' && '★'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid: 4-Way Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {entities.map(name => {
          const comp = competitors[name];
          if (!comp) return null;
          const isSelected = selectedEntity === name;
          const isNegative = comp.sentimentAverage < 0;

          return (
            <div
              key={name}
              onClick={() => setSelectedEntity(name)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#111624] border-blue-500 shadow-lg ring-1 ring-blue-500/30'
                  : 'bg-[#0a0d14] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${comp.isClient ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <span className="font-bold text-sm text-white">{name}</span>
                </div>
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                  comp.isClient ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {comp.isClient ? 'Client' : 'Rival'}
                </span>
              </div>

              {/* Sentiment Score */}
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xs text-zinc-400 font-mono">Net Sentiment:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-base">
                  {isNegative ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className={isNegative ? 'text-red-400' : 'text-emerald-400'}>
                    {comp.sentimentAverage > 0 ? `+${comp.sentimentAverage}` : comp.sentimentAverage}
                  </span>
                </div>
              </div>

              {/* Sentiment Bar */}
              <div className="mt-2 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full" 
                  style={{ width: `${(comp.positiveCount / comp.totalVolume) * 100}%` }} 
                />
                <div 
                  className="bg-zinc-500 h-full" 
                  style={{ width: `${(comp.neutralCount / comp.totalVolume) * 100}%` }} 
                />
                <div 
                  className="bg-red-500 h-full" 
                  style={{ width: `${((comp.negativeCount + comp.criticalCount) / comp.totalVolume) * 100}%` }} 
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>Volume: {comp.totalVolume} items</span>
                <span>Crit: {comp.criticalCount}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deep Dive Section for Selected Competitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Strategic Intercept Brief & Heatmap */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tactical Action Card */}
          <div className="p-5 rounded-xl bg-gradient-to-b from-[#0c121e] to-[#080b12] border border-blue-900/50 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-amber-400">
                  Strategic Opportunity & Vulnerability Brief
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Target: <strong className="text-white">{selectedEntity}</strong>
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/40">
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-red-400 block mb-1">
                  Detected Vulnerability:
                </span>
                <p className="text-zinc-200">
                  {activeCompetitor.topVulnerability}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
                <span className="font-mono text-[11px] uppercase tracking-wider font-bold text-emerald-400 block mb-1">
                  Infosys Recommended Counter-Play:
                </span>
                <p className="text-zinc-200">
                  {activeCompetitor.opportunityNote}
                </p>
              </div>
            </div>
          </div>

          {/* Filtered Articles for this Competitor */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
                Live Intelligence Stream for {selectedEntity} ({entityArticles.length})
              </h4>
            </div>

            <div className="space-y-2">
              {entityArticles.map(article => (
                <div
                  key={article.id}
                  onClick={() => onSelectArticle(article)}
                  className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer transition flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-400 font-medium">
                        {article.metadata.newspaperOrSource}
                      </span>
                      {article.metadata.pageNumber && (
                        <span className="text-amber-400 font-mono text-[11px]">
                          {article.metadata.pageNumber}
                        </span>
                      )}
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-500 font-mono text-[11px]">
                        By {article.metadata.author}
                      </span>
                    </div>
                    <h5 className="text-sm font-semibold text-white group-hover:text-blue-300 transition">
                      {article.metadata.headline}
                    </h5>
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {article.metadata.shortDescription}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      article.riskLevel === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                      article.riskLevel === 'High' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      Risk: {article.riskScore}/10
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      SLA: {Math.round(article.sla.totalDurationMs / 1000)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Multi-Channel Share of Voice */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Media Platform Distribution</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Twitter className="w-3.5 h-3.5 text-sky-400" />
                    <span>Twitter / X</span>
                  </span>
                  <span className="font-mono text-zinc-400">
                    {activeCompetitor.socialShareOfVoice.twitter}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="bg-sky-500 h-full rounded-full" 
                    style={{ width: `${activeCompetitor.socialShareOfVoice.twitter}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                    <span>Instagram</span>
                  </span>
                  <span className="font-mono text-zinc-400">
                    {activeCompetitor.socialShareOfVoice.instagram}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="bg-pink-500 h-full rounded-full" 
                    style={{ width: `${activeCompetitor.socialShareOfVoice.instagram}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Facebook className="w-3.5 h-3.5 text-blue-400" />
                    <span>Facebook</span>
                  </span>
                  <span className="font-mono text-zinc-400">
                    {activeCompetitor.socialShareOfVoice.facebook}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full" 
                    style={{ width: `${activeCompetitor.socialShareOfVoice.facebook}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print & ePapers</span>
                  </span>
                  <span className="font-mono text-zinc-400">
                    {activeCompetitor.socialShareOfVoice.print}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full" 
                    style={{ width: `${activeCompetitor.socialShareOfVoice.print}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Comparison Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 font-bold block">
              Market Position Summary
            </span>
            <p className="text-zinc-300 leading-relaxed">
              Infosys currently holds a net positive resilience score. Real-time media feeds show competitor vulnerability clusters centered around cloud SLA disputes and advisory restructuring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
