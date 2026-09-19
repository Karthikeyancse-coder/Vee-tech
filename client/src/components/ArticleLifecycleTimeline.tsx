import React from 'react';
import { formatUtcTimestamp, formatDurationCompact } from '../utils/detectionLatency';

interface ArticleTimelineProps {
  publishedAt?: string | null;
  detectedAt?: string | null;
  triagedAt?: string | null;
  dispatchedAt?: string | null;
}

interface TimelineStage {
  label: string;
  timestamp: string;
  formattedDate: string;
  timeGapLabel?: string;
  dotColor: string;
}

export const ArticleLifecycleTimeline: React.FC<ArticleTimelineProps> = ({
  publishedAt,
  detectedAt,
  triagedAt,
  dispatchedAt
}) => {
  const stages: TimelineStage[] = [];

  // Stage 1: Published
  if (publishedAt && !isNaN(new Date(publishedAt).getTime())) {
    const pubDate = new Date(publishedAt);
    stages.push({
      label: 'Published by Wire / Origin',
      timestamp: publishedAt,
      formattedDate: formatUtcTimestamp(pubDate),
      dotColor: 'bg-slate-400'
    });
  }

  // Stage 2: Detected by VEE-ALERT
  if (detectedAt && !isNaN(new Date(detectedAt).getTime())) {
    const detDate = new Date(detectedAt);
    let gapLabel: string | undefined;

    if (publishedAt && !isNaN(new Date(publishedAt).getTime())) {
      const diffSec = Math.round((detDate.getTime() - new Date(publishedAt).getTime()) / 1000);
      if (diffSec >= 0) {
        gapLabel = `Detection latency: ${formatDurationCompact(diffSec)}`;
      } else {
        gapLabel = `Clock skew (${Math.abs(diffSec)}s)`;
      }
    }

    stages.push({
      label: 'Detected by VEE-ALERT',
      timestamp: detectedAt,
      formattedDate: formatUtcTimestamp(detDate),
      timeGapLabel: gapLabel,
      dotColor: 'bg-emerald-500'
    });
  }

  // Stage 3: Triaged by AI (ONLY IF REAL TIMESTAMP EXISTS)
  if (triagedAt && !isNaN(new Date(triagedAt).getTime())) {
    const triageDate = new Date(triagedAt);
    let gapLabel: string | undefined;

    if (detectedAt && !isNaN(new Date(detectedAt).getTime())) {
      const diffSec = Math.round((triageDate.getTime() - new Date(detectedAt).getTime()) / 1000);
      if (diffSec >= 0) {
        gapLabel = `AI Triage: ${formatDurationCompact(diffSec)}`;
      }
    }

    stages.push({
      label: 'Triaged by Local Ollama (qwen2.5)',
      timestamp: triagedAt,
      formattedDate: formatUtcTimestamp(triageDate),
      timeGapLabel: gapLabel,
      dotColor: 'bg-blue-500'
    });
  }

  // Stage 4: Dispatched / Available in Intelligence Feed (ONLY IF REAL TIMESTAMP EXISTS)
  if (dispatchedAt && !isNaN(new Date(dispatchedAt).getTime())) {
    const dispDate = new Date(dispatchedAt);
    let gapLabel: string | undefined;

    const prevTimestamp = triagedAt || detectedAt;
    if (prevTimestamp && !isNaN(new Date(prevTimestamp).getTime())) {
      const diffSec = Math.round((dispDate.getTime() - new Date(prevTimestamp).getTime()) / 1000);
      if (diffSec >= 0) {
        gapLabel = `Dispatch: ${formatDurationCompact(diffSec)}`;
      }
    }

    stages.push({
      label: 'Available in Intelligence Feed',
      timestamp: dispatchedAt,
      formattedDate: formatUtcTimestamp(dispDate),
      timeGapLabel: gapLabel,
      dotColor: 'bg-rose-500'
    });
  }

  if (stages.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80">
      <div className="flex items-center justify-between pb-2">
        <h5 className="font-mono font-bold uppercase tracking-wider text-slate-500 text-[10px]">
          Article Lifecycle Timeline (UTC Audit)
        </h5>
        <span className="text-[9px] font-mono text-slate-400">Pure Immutable Timestamps</span>
      </div>

      <div className="relative pl-4 space-y-4 border-l-2 border-slate-200 ml-2 mt-2">
        {stages.map((stage, idx) => (
          <div key={idx} className="relative group">
            {/* Timeline dot */}
            <span
              className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${stage.dotColor}`}
            />

            {/* Gap badge above stage if not first */}
            {stage.timeGapLabel && (
              <div className="mb-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  ↓ {stage.timeGapLabel}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <span className="text-xs font-semibold text-slate-800">
                {stage.label}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {stage.formattedDate}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
