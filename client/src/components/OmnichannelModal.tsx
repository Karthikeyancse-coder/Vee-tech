import React, { useState } from 'react';
import { 
  MessageSquare, 
  Mail, 
  PhoneCall, 
  Send, 
  CheckCheck, 
  Clock, 
  ShieldAlert, 
  Building2,
  Share2
} from 'lucide-react';
import { IntelligenceItem } from '../types';

interface OmnichannelModalProps {
  articles: IntelligenceItem[];
  onOpenVoiceCall: (article: IntelligenceItem) => void;
}

export const OmnichannelModal: React.FC<OmnichannelModalProps> = ({
  articles,
  onOpenVoiceCall
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'slack' | 'email' | 'voice'>('whatsapp');
  const criticalArticle = articles.find(a => a.riskLevel === 'Critical') || articles[0];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Share2 className="w-4 h-4 text-amber-400" />
            <span>Omnichannel Dispatch & Push Alert Hub</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time push delivery across WhatsApp, Slack, Email, and Automated Telephony.
          </p>
        </div>

        {/* Channel Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium">
          <button
            onClick={() => setSelectedChannel('whatsapp')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
              selectedChannel === 'whatsapp' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={() => setSelectedChannel('slack')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
              selectedChannel === 'slack' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Slack</span>
          </button>
          <button
            onClick={() => setSelectedChannel('email')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
              selectedChannel === 'email' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
          <button
            onClick={() => setSelectedChannel('voice')}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition ${
              selectedChannel === 'voice' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Voice Call</span>
          </button>
        </div>
      </div>

      {criticalArticle ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Channel Preview Mockup */}
          <div className="lg:col-span-2">
            {selectedChannel === 'whatsapp' && (
              <div className="p-5 rounded-2xl bg-[#0b141a] border border-[#1f2c34] text-zinc-100 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#1f2c34] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white shadow">
                      VA
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                        Vee-Alert Emergency Dispatch Bot
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </h4>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        Direct Channel • Target: Infosys Crisis Team
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {criticalArticle.dispatch.whatsapp.timestamp || '2:14 AM'}
                  </span>
                </div>

                {/* WhatsApp Message Bubble */}
                <div className="max-w-xl bg-[#005c4b] p-4 rounded-xl rounded-tl-none text-xs space-y-2 shadow-md">
                  <div className="flex items-center justify-between text-[11px] border-b border-emerald-800/60 pb-1.5 text-emerald-200">
                    <span className="font-bold uppercase font-mono">
                      🚨 PRIORITY CRISIS BRIEFING ({criticalArticle.riskLevel.toUpperCase()})
                    </span>
                    <span>Risk: {criticalArticle.riskScore}/10</span>
                  </div>

                  <p className="font-bold text-white text-sm">
                    {criticalArticle.metadata.headline}
                  </p>

                  <p className="text-zinc-200 text-[11px] italic">
                    Source: {criticalArticle.metadata.newspaperOrSource} {criticalArticle.metadata.pageNumber && `(${criticalArticle.metadata.pageNumber})`} • By {criticalArticle.metadata.author}
                  </p>

                  <div className="mt-2 space-y-1 text-zinc-100 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-700/40">
                    <p><strong>1. What:</strong> {criticalArticle.summary.whatHappened}</p>
                    <p><strong>2. Why:</strong> {criticalArticle.summary.whyItMatters}</p>
                    <p><strong>3. Score Justification:</strong> {criticalArticle.summary.riskJustification}</p>
                    <p><strong>4. Competitor Impact:</strong> {criticalArticle.summary.competitorImpact}</p>
                    <p className="text-emerald-200 font-semibold">
                      <strong>5. Action:</strong> {criticalArticle.summary.recommendedAction}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-emerald-200">
                    <span>SLA Delivery: {Math.round(criticalArticle.sla.totalDurationMs / 1000)}s</span>
                    <span className="flex items-center gap-1">
                      Read <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedChannel === 'slack' && (
              <div className="p-5 rounded-2xl bg-[#1a1d21] border border-[#2b2d31] text-zinc-100 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                    <span className="font-bold text-white">#crisis-war-room-exec</span>
                    <span>|</span>
                    <span>Infosys Emergency Incident Response</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">APP • 2:14 AM</span>
                </div>

                {/* Slack Bot Message */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center font-mono font-bold text-white flex-shrink-0">
                    VA
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-white font-semibold">Vee-Alert Stream Bot</strong>
                      <span className="text-[10px] bg-zinc-700 px-1.5 py-0.2 rounded font-mono text-zinc-300">
                        APP
                      </span>
                      <span className="text-zinc-500 text-[11px]">Today at 2:14 AM</span>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#222529] border-l-4 border-red-500 space-y-2">
                      <div className="text-red-400 font-bold uppercase font-mono text-[11px]">
                        Critical Alert Dispatch • {criticalArticle.entity}
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        {criticalArticle.metadata.headline}
                      </h4>
                      <p className="text-zinc-400 text-xs">
                        {criticalArticle.metadata.shortDescription}
                      </p>

                      <div className="mt-2 space-y-1 text-zinc-300 text-xs bg-black/30 p-3 rounded">
                        <p><span className="text-zinc-500 font-mono">1.</span> <strong>What:</strong> {criticalArticle.summary.whatHappened}</p>
                        <p><span className="text-zinc-500 font-mono">2.</span> <strong>Why:</strong> {criticalArticle.summary.whyItMatters}</p>
                        <p><span className="text-zinc-500 font-mono">3.</span> <strong>Impact:</strong> {criticalArticle.summary.competitorImpact}</p>
                        <p className="text-red-300"><span className="text-zinc-500 font-mono">4.</span> <strong>Action:</strong> {criticalArticle.summary.recommendedAction}</p>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-medium text-xs">
                          Acknowledge & Mobilize
                        </button>
                        <button className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs">
                          Bridge Legal Team
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedChannel === 'email' && (
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 shadow-xl space-y-4">
                <div className="space-y-1.5 border-b border-zinc-800 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono w-16">From:</span>
                    <span className="text-zinc-200">alerts@veealert.internal (Vee-Alert Priority Stream)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono w-16">To:</span>
                    <span className="text-zinc-200">cmo@infosys.com, legal-escalations@infosys.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono w-16">Subject:</span>
                    <span className="font-bold text-red-400">
                      [CRITICAL SLA ALERT] {criticalArticle.metadata.headline}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
                  <p>
                    Dear Leadership Team,
                  </p>
                  <p>
                    An automated priority incident has been flagged by the Vee-Alert In-Memory Engine within <strong>34 seconds</strong> of publication.
                  </p>
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                    <h4 className="font-bold text-white text-sm">{criticalArticle.metadata.headline}</h4>
                    <p className="text-zinc-400 text-xs">
                      Publication: {criticalArticle.metadata.newspaperOrSource} {criticalArticle.metadata.pageNumber && `(${criticalArticle.metadata.pageNumber})`} | Author: {criticalArticle.metadata.author}
                    </p>
                    <div className="space-y-1 pt-2">
                      <p><strong>Executive Briefing:</strong></p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>{criticalArticle.summary.whatHappened}</li>
                        <li>{criticalArticle.summary.whyItMatters}</li>
                        <li>{criticalArticle.summary.riskJustification}</li>
                        <li>{criticalArticle.summary.competitorImpact}</li>
                        <li className="text-red-300 font-semibold">{criticalArticle.summary.recommendedAction}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedChannel === 'voice' && (
              <div className="p-5 rounded-2xl bg-zinc-950 border border-red-900/40 text-zinc-100 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-red-500 animate-pulse" />
                    <h3 className="font-bold text-sm text-white">
                      Automated Telephony & Voice Call Escalator (Twilio / Ultravox Engine)
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-red-400 uppercase font-bold">
                    Tier 4 Protocol Active
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-red-950/20 border border-red-800/40 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-zinc-400 font-mono text-[11px] block">TARGET CONTACT:</span>
                      <strong className="text-white text-sm">
                        {criticalArticle.dispatch.voiceCall.targetRole || 'Chief Crisis Officer & CMO'}
                      </strong>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-zinc-400 text-[11px] block">PHONE:</span>
                      <span className="text-zinc-200 font-bold">+91-98840-83333</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-black/40 border border-zinc-800 font-mono text-[11px] text-zinc-300 space-y-1">
                    <p className="text-emerald-400 font-bold">IVR Keypad Routing Logic:</p>
                    <p>• [Key 1]: Acknowledge crisis & suppress escalation failovers</p>
                    <p>• [Key 2]: Instantly patch phone line into Corporate PR & Legal Bridge</p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => onOpenVoiceCall(criticalArticle)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition active:scale-95"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Launch Interactive Voice Call Simulator</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Active Dispatch Stream History */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              Recent Push Dispatches
            </h4>

            <div className="space-y-2.5 text-xs">
              {articles.map(a => (
                <div key={a.id} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-white truncate max-w-[150px]">{a.entity}</span>
                    <span className="text-zinc-500">{Math.round(a.sla.totalDurationMs / 1000)}s SLA</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] truncate">
                    {a.metadata.headline}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                    <span>{a.dispatch.whatsapp.dispatched ? 'WA ✓' : ''}</span>
                    <span>{a.dispatch.slack.dispatched ? 'Slack ✓' : ''}</span>
                    <span>{a.dispatch.email.dispatched ? 'Email ✓' : ''}</span>
                    <span>{a.dispatch.voiceCall.dispatched ? 'Voice ✓' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-zinc-500 font-mono text-xs">
          No active articles dispatched.
        </div>
      )}
    </div>
  );
};
