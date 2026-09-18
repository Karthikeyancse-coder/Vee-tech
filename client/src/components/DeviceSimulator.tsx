import React from 'react';
import { Smartphone, Battery, Wifi, Signal, Laptop } from 'lucide-react';

interface DeviceSimulatorProps {
  children: React.ReactNode;
  viewportMode: 'desktop' | 'mobile-preview';
  onExitMobile: () => void;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({
  children,
  viewportMode,
  onExitMobile
}) => {
  if (viewportMode === 'desktop') {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="min-h-[85vh] py-6 flex flex-col items-center justify-center bg-[#050608] px-4">
      {/* Device Viewport Header Controls */}
      <div className="mb-4 flex items-center justify-between w-full max-w-sm px-2 text-xs">
        <div className="flex items-center gap-2 text-zinc-400 font-mono">
          <Smartphone className="w-4 h-4 text-red-400" />
          <span>Executive iPhone 16 Pro Viewport</span>
        </div>
        <button
          onClick={onExitMobile}
          className="flex items-center gap-1 text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-900 border border-zinc-800 transition"
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>Exit to Laptop Mode</span>
        </button>
      </div>

      {/* Simulated Smartphone Frame */}
      <div className="w-full max-w-[400px] h-[820px] bg-black rounded-[48px] p-3 shadow-2xl ring-1 ring-zinc-700/60 border-4 border-zinc-800 relative flex flex-col overflow-hidden">
        {/* Dynamic Island / Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-zinc-950 rounded-full z-30 flex items-center justify-end px-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0a121e] ring-1 ring-blue-900/50" />
        </div>

        {/* Status Bar */}
        <div className="w-full h-8 px-6 flex items-center justify-between text-[11px] font-mono font-semibold text-zinc-300 z-20 select-none">
          <span>02:14</span>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Scrollable Mobile App Screen */}
        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3 z-10 custom-mobile-scroll">
          {children}
        </div>

        {/* Home Indicator Bar */}
        <div className="w-full h-4 flex items-center justify-center pt-1">
          <div className="w-32 h-1 bg-zinc-600 rounded-full" />
        </div>
      </div>
    </div>
  );
};
