import React from 'react';
import { Laptop, Smartphone } from 'lucide-react';

interface HeaderProps {
  activeTab: 'war-room' | 'competitor-radar' | 'sla-engine' | 'omnichannel';
  setActiveTab: (tab: 'war-room' | 'competitor-radar' | 'sla-engine' | 'omnichannel') => void;
  viewportMode: 'desktop' | 'mobile-preview';
  setViewportMode: (mode: 'desktop' | 'mobile-preview') => void;
  criticalCount: number;
  avgLatency: number;
  slaCompliance: number;
  onOpenQuickTrigger: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  viewportMode,
  setViewportMode,
  onOpenQuickTrigger
}) => {
  return (
    <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Logo with subtle red dot badge */}
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-base font-extrabold tracking-wider text-white">
            VEE-ALERT
          </span>
          <span className="w-2 h-2 rounded-full bg-rose-500" />
        </div>

        {/* Center: Tab switcher styled as subtle pill buttons */}
        <nav className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('war-room')}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'war-room'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            Crisis War Room
          </button>

          <button
            onClick={() => setActiveTab('competitor-radar')}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'competitor-radar'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            Competitor Radar
          </button>

          <button
            onClick={() => setActiveTab('sla-engine')}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'sla-engine'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            SLA Proof
          </button>

          <button
            onClick={() => setActiveTab('omnichannel')}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              activeTab === 'omnichannel'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            Omnichannel Hub
          </button>
        </nav>

        {/* Right: Viewport mode + Primary 'Simulate Crisis' Button */}
        <div className="flex items-center gap-3">
          {/* Subtle Viewport Switcher for Laptop vs Mobile */}
          <div className="hidden sm:flex items-center p-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
            <button
              onClick={() => setViewportMode('desktop')}
              title="Desktop View"
              className={`p-1.5 rounded ${
                viewportMode === 'desktop' ? 'bg-slate-800 text-white' : 'hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewportMode('mobile-preview')}
              title="Mobile View"
              className={`p-1.5 rounded ${
                viewportMode === 'mobile-preview' ? 'bg-slate-800 text-white' : 'hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={onOpenQuickTrigger}
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm active:scale-95"
          >
            Simulate Crisis
          </button>
        </div>
      </div>
    </header>
  );
};
