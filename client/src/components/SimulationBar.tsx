import React, { useState } from 'react';
import { 
  Flame, 
  Twitter, 
  Facebook, 
  Instagram, 
  Newspaper, 
  PlusCircle, 
  X, 
  Send,
  Zap
} from 'lucide-react';
import { EntityName, PlatformType } from '../types';

interface SimulationBarProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerPreset: (scenarioKey: string) => Promise<void>;
  onCustomIngest: (payload: any) => Promise<void>;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  isOpen,
  onClose,
  onTriggerPreset,
  onCustomIngest
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Custom ingest form state
  const [newspaperOrSource, setNewspaperOrSource] = useState('Business Standard');
  const [author, setAuthor] = useState('Anirudh Laskar');
  const [pageNumber, setPageNumber] = useState('Page 3 (Banking & Tech)');
  const [headline, setHeadline] = useState('Infosys Wins $450M Nordic Core Banking Cloud Modernization Deal');
  const [shortDescription, setShortDescription] = useState('European banking consortium replaces competitor architecture with Infosys Finacle and Cobalt AI automation platform.');
  const [entity, setEntity] = useState<EntityName>('Infosys');
  const [platform, setPlatform] = useState<PlatformType>('print_epaper');

  if (!isOpen) return null;

  const handlePreset = async (key: string) => {
    setLoading(key);
    try {
      await onTriggerPreset(key);
    } finally {
      setLoading(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('custom');
    try {
      await onCustomIngest({
        newspaperOrSource,
        author,
        pageNumber,
        headline,
        shortDescription,
        entity,
        platform
      });
      setShowCustomModal(false);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0d111a] border border-zinc-800 rounded-2xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Crisis Scenario Injection Console
            </h2>
            <p className="text-xs text-zinc-400">
              Inject real-time breaking events to test sub-120s ingestion, local AI triage, and voice escalation.
            </p>
          </div>
        </div>

        {!showCustomModal ? (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              One-Click Benchmark Scenarios:
            </p>

            {/* Scenario 1: Infosys RBI Audit (Tier 4 Critical) */}
            <button
              onClick={() => handlePreset('infosys-rbi-epaper')}
              disabled={loading !== null}
              className="w-full text-left p-3.5 rounded-xl bg-red-950/30 border border-red-700/50 hover:bg-red-900/40 hover:border-red-500 transition-all flex items-start justify-between group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-600/30 text-red-300 mt-0.5 border border-red-500/40">
                  <Flame className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-200 uppercase font-mono px-1.5 py-0.5 rounded bg-red-500/30">
                      Tier 4 • Critical Voice Call
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">Infosys • Print ePaper</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-100 mt-1">
                    RBI Compliance Audit Notice (The Economic Times, Page 1 Lead)
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Triggers immediate voice escalation phone call to CMO, WhatsApp brief, Slack, and email in &lt; 35s.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                {loading === 'infosys-rbi-epaper' ? 'Injecting...' : 'Inject'}
              </span>
            </button>

            {/* Scenario 2: TCS Cloud Outage (Competitor Vulnerability) */}
            <button
              onClick={() => handlePreset('tcs-outage-twitter')}
              disabled={loading !== null}
              className="w-full text-left p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 hover:bg-blue-900/30 hover:border-blue-500 transition-all flex items-start justify-between group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-300 mt-0.5 border border-blue-500/30">
                  <Twitter className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-300 uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20">
                      Tier 3 • High Alert
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">TCS • Twitter/X Viral Feed</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-100 mt-1">
                    Major Outage on European Banking Cloud (42K Tweets/Hr)
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Updates Competitor Radar heatmap to negative and briefs Infosys sales to target renewal accounts.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                {loading === 'tcs-outage-twitter' ? 'Injecting...' : 'Inject'}
              </span>
            </button>

            {/* Scenario 3: Wipro Reshuffle (Facebook) */}
            <button
              onClick={() => handlePreset('wipro-reorganization-facebook')}
              disabled={loading !== null}
              className="w-full text-left p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all flex items-start justify-between group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-300 mt-0.5 border border-indigo-500/30">
                  <Facebook className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300 uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800">
                      Tier 2 • Medium
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">Wipro • Facebook Post</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200 mt-1">
                    Leadership Reshuffle Across Capco & Digital Transformation
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Logged to Competitor Intelligence with opportunity notes for Infosys Cobalt.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                {loading === 'wipro-reorganization-facebook' ? 'Injecting...' : 'Inject'}
              </span>
            </button>

            {/* Scenario 4: Accenture GenAI blitz (Instagram) */}
            <button
              onClick={() => handlePreset('accenture-genai-instagram')}
              disabled={loading !== null}
              className="w-full text-left p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all flex items-start justify-between group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-pink-600/20 text-pink-300 mt-0.5 border border-pink-500/30">
                  <Instagram className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-300 uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800">
                      Tier 2 • Medium
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">Accenture • Instagram Campaign</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200 mt-1">
                    $3B Global GenAI Modernization Blitz (410K Views)
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Analyzes marketing reach and prompts counter-campaign recommendations for Infosys Topaz.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                {loading === 'accenture-genai-instagram' ? 'Injecting...' : 'Inject'}
              </span>
            </button>

            <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
              <button
                onClick={() => setShowCustomModal(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium p-1 rounded"
              >
                <PlusCircle className="w-4 h-4 text-red-400" />
                <span>Create Custom News/Social Payload (With Newspaper, Author, Page #)</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Custom Payload Form */
          <form onSubmit={handleCustomSubmit} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  Entity
                </label>
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value as EntityName)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                >
                  <option value="Infosys">Infosys (Client Target)</option>
                  <option value="TCS">TCS (Competitor)</option>
                  <option value="Wipro">Wipro (Competitor)</option>
                  <option value="Accenture">Accenture (Competitor)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as PlatformType)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                >
                  <option value="print_epaper">Print ePaper (Newspaper)</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="news_web">Online News Wire</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  Newspaper or Platform Handle
                </label>
                <input
                  type="text"
                  value={newspaperOrSource}
                  onChange={(e) => setNewspaperOrSource(e.target.value)}
                  placeholder="e.g. The Economic Times, Mint, @Reuters"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  Page Number (ePaper)
                </label>
                <input
                  type="text"
                  value={pageNumber}
                  onChange={(e) => setPageNumber(e.target.value)}
                  placeholder="e.g. Page 1 Front Lead"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Author / Journalist / Correspondent
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Special Correspondent / Surabhi Agarwal"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Headline / Title
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Enter breaking title..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                Short Description / Excerpt
              </label>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                rows={2}
                placeholder="Article summary details..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Back to Presets
              </button>
              <button
                type="submit"
                disabled={loading === 'custom'}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading === 'custom' ? 'Triaging...' : 'Ingest & Stream Live'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
