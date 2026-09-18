import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Volume2, 
  ShieldAlert, 
  Mic, 
  Radio, 
  CheckCircle2, 
  Users, 
  X,
  Sparkles
} from 'lucide-react';
import { IntelligenceItem } from '../types';

interface VoiceCallModalProps {
  article: IntelligenceItem | null;
  callState: 'idle' | 'ringing' | 'connected' | 'speaking' | 'acknowledged' | 'pr_bridged';
  ivrMessage: string;
  audioLevel: number;
  onAnswer: () => void;
  onKeypadPress: (key: string) => void;
  onClose: () => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  article,
  callState,
  ivrMessage,
  audioLevel,
  onAnswer,
  onKeypadPress,
  onClose
}) => {
  if (callState === 'idle' || !article) return null;

  const keypadKeys = [
    { key: '1', label: 'ACKNOWLEDGE' },
    { key: '2', label: 'BRIDGE PR' },
    { key: '3', label: 'REPEAT' },
    { key: '4', label: 'GHI' },
    { key: '5', label: 'JKL' },
    { key: '6', label: 'MNO' },
    { key: '7', label: 'PQRS' },
    { key: '8', label: 'TUV' },
    { key: '9', label: 'WXYZ' },
    { key: '*', label: 'STANDBY' },
    { key: '0', label: '+' },
    { key: '#', label: 'HANGUP' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#140b10] via-[#0d0f17] to-[#080910] border border-red-600/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-24 bg-red-600/10 blur-3xl pointer-events-none" />

        {/* Close / dismiss button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Caller Header */}
        <div className="text-center space-y-1.5 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-700/60 text-red-300 text-xs font-mono font-bold tracking-wider animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>TIER 4 VOICE ESCALATION</span>
          </div>

          <h3 className="text-lg font-bold text-white font-mono mt-1">
            Vee-Alert Emergency Dispatch
          </h3>
          <p className="text-xs text-zinc-400 font-mono">
            Calling: Chief Crisis Officer (Infosys) • +91-98840-83333
          </p>
        </div>

        {/* Call State Badge */}
        <div className="mt-4 p-3 rounded-xl bg-black/50 border border-zinc-800 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-semibold">
            {callState === 'ringing' && (
              <span className="text-amber-400 flex items-center gap-2">
                <Radio className="w-4 h-4 animate-ping" />
                RINGING LEADERSHIP LINE...
              </span>
            )}
            {callState === 'speaking' && (
              <span className="text-red-400 flex items-center gap-2">
                <Volume2 className="w-4 h-4 animate-pulse" />
                AI SYNTHESIZED EMERGENCY BRIEFING ACTIVE
              </span>
            )}
            {callState === 'connected' && (
              <span className="text-emerald-400 flex items-center gap-2">
                <Mic className="w-4 h-4" />
                CALL CONNECTED • AWAITING IVR KEYPAD INPUT
              </span>
            )}
            {callState === 'acknowledged' && (
              <span className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                ALERT ACKNOWLEDGED VIA KEY 1
              </span>
            )}
            {callState === 'pr_bridged' && (
              <span className="text-blue-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                BRIDGING TO GLOBAL PR TEAM VIA KEY 2
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-300 mt-2 font-mono leading-relaxed min-h-[36px]">
            {ivrMessage}
          </p>
        </div>

        {/* Dynamic Audio Waveform Visualizer */}
        {(callState === 'speaking' || callState === 'ringing') && (
          <div className="mt-4 flex items-center justify-center gap-1 h-10 px-4">
            {[...Array(20)].map((_, i) => {
              const height = Math.max(10, Math.sin(i * 0.5 + audioLevel * 10) * 35 + 15);
              return (
                <div
                  key={i}
                  className="w-1 rounded-full bg-red-500 transition-all duration-75"
                  style={{
                    height: `${height}px`,
                    opacity: callState === 'speaking' ? 0.9 : 0.4
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Main Interactive Controls: Ringing vs In-Call Keypad */}
        {callState === 'ringing' ? (
          <div className="mt-6 flex items-center justify-center gap-6">
            <button
              onClick={onClose}
              className="w-16 h-16 rounded-full bg-zinc-800 hover:bg-zinc-700 flex flex-col items-center justify-center text-zinc-300 transition active:scale-95"
            >
              <PhoneOff className="w-6 h-6 text-zinc-400" />
              <span className="text-[10px] font-mono mt-1">Decline</span>
            </button>

            <button
              onClick={onAnswer}
              className="w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 flex flex-col items-center justify-center text-white shadow-lg shadow-emerald-600/40 animate-bounce transition active:scale-95"
            >
              <Phone className="w-8 h-8" />
              <span className="text-[10px] font-mono mt-1 font-bold">Answer</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Interactive DTMF Phone Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {keypadKeys.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onKeypadPress(item.key)}
                  className={`p-2.5 rounded-xl border text-center transition-all active:scale-90 ${
                    item.key === '1'
                      ? 'bg-emerald-950/40 border-emerald-600/50 hover:bg-emerald-900/60 text-emerald-300'
                      : item.key === '2'
                      ? 'bg-blue-950/40 border-blue-600/50 hover:bg-blue-900/60 text-blue-300'
                      : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <span className="text-base font-mono font-bold block">{item.key}</span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 block truncate">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Hangup button */}
            <div className="pt-2 flex justify-center">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold shadow-lg shadow-red-600/30 transition active:scale-95"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call & Return</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
