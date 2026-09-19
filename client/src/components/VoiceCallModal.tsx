import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, ShieldAlert, Check } from 'lucide-react';
import { Article } from '../hooks/useWarRoom';

interface VoiceCallModalProps {
  article: Article | null;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  article,
  onClose,
  onAcknowledge
}) => {
  const [callStatus, setCallStatus] = useState<'dialing' | 'ringing' | 'connected' | 'ended'>('dialing');
  const [dtmfPressed, setDtmfPressed] = useState<'1' | '2' | null>(null);

  useEffect(() => {
    if (!article) return;

    const timer1 = setTimeout(() => setCallStatus('ringing'), 1000);
    const timer2 = setTimeout(() => {
      setCallStatus('connected');
      // Synthetic Browser Speech Synthesis for immersive demo
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const brief = article.five_bullet_summary?.slice(0, 2).join('. ') || article.title;
        const utterance = new SpeechSynthesisUtterance(
          `Vee-Alert Tier-4 Emergency Escalation. Subject: ${article.title}. ${brief}. Press 1 to acknowledge, or press 2 to bridge to Corporate Legal.`
        );
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [article]);

  if (!article) return null;

  const handleKeypadPress = (digit: '1' | '2') => {
    setDtmfPressed(digit);
    if (digit === '1') {
      onAcknowledge(article.id);
    }
  };

  const handleEndCall = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setCallStatus('ended');
    setTimeout(onClose, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-xl relative">
        
        {/* Header with Urgency Signal */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mb-1 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-sans tracking-tight">
            Automated Tier-4 Crisis Escalation
          </h3>
          <p className="text-xs text-slate-500 font-mono">
            Target: Chief Risk Officer (+1 555-019-2834)
          </p>
        </div>

        {/* Telephony Status & Waveform */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                callStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : callStatus === 'ringing'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-rose-500 animate-pulse'
              }`}
            />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-700 font-semibold">
              {callStatus === 'dialing' && 'Establishing Carrier Bridge...'}
              {callStatus === 'ringing' && 'Dual-Tone Ringing at Handset...'}
              {callStatus === 'connected' && 'Call Connected • Polly Voice Active'}
              {callStatus === 'ended' && 'Call Terminated'}
            </span>
          </div>

          {/* Animated Sound Waveform Bars */}
          {callStatus === 'connected' && (
            <div className="flex items-center justify-center gap-1.5 h-8">
              {[40, 75, 90, 50, 85, 95, 60, 80, 45, 70, 90, 60].map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-rose-600 rounded-full animate-bounce"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${i * 0.08}s`,
                    animationDuration: '0.9s'
                  }}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-slate-600 line-clamp-2 px-2 italic font-medium">
            &quot;{article.title}&quot;
          </p>
        </div>

        {/* Interactive DTMF Dialer Keypad */}
        <div className="space-y-3">
          <div className="text-center text-xs font-mono text-slate-500 font-semibold">
            Interactive IVR Touch-Tone Response:
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleKeypadPress('1')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                dtmfPressed === '1'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between font-mono font-bold text-sm">
                <span>[Press 1]</span>
                {dtmfPressed === '1' && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-xs text-slate-500 mt-1">Acknowledge Alert &amp; Log</p>
            </button>

            <button
              onClick={() => handleKeypadPress('2')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                dtmfPressed === '2'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between font-mono font-bold text-sm">
                <span>[Press 2]</span>
                <Phone className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Bridge to Legal Line</p>
            </button>
          </div>
        </div>

        {/* End Call Button */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleEndCall}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Emergency Call</span>
          </button>
        </div>

      </div>
    </div>
  );
};
