'use client';

import { useEffect, useState } from 'react';
import { ProjectInsight, ARCH_STYLES } from '@/lib/known-projects';
import { X, Lightbulb, Zap } from 'lucide-react';

interface Props {
  insight: ProjectInsight;
  onDismiss: () => void;
}

export default function ProjectInsightCard({ insight, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [showFunFact, setShowFunFact] = useState(false);
  const style = ARCH_STYLES[insight.archType];

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div
      className="absolute top-4 left-1/2 z-30 w-[480px] max-w-[90vw]"
      style={{
        transform: `translateX(-50%) translateY(${visible ? '0' : '-18px'})`,
        opacity: visible ? 1 : 0,
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <div
        className="rounded-2xl px-5 py-4 shadow-2xl backdrop-blur-md border relative overflow-hidden"
        style={{ background: style.bg, borderColor: style.border }}
      >
        {/* Glow line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${style.color}, transparent)` }}
        />

        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                style={{ color: style.color, borderColor: style.border, background: style.bg }}
              >
                {style.badge}
              </span>
              <span className="text-[11px] text-slate-500">{insight.year} · {insight.lang}</span>
              {insight.tags.map(t => (
                <span key={t} className="text-[10px] text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">
                  {t}
                </span>
              ))}
            </div>

            {/* Title */}
            <h2 className="text-base font-bold leading-tight" style={{ color: style.color }}>
              {insight.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{insight.creator}</p>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Headline */}
        <p className="text-sm font-semibold text-slate-200 mb-2 leading-snug">
          「{insight.headline}」
        </p>

        {/* Insight */}
        <p className="text-xs text-slate-400 leading-relaxed mb-3">
          {insight.insight}
        </p>

        {/* Fun fact toggle */}
        <button
          onClick={() => setShowFunFact(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors w-full text-left"
          style={{ color: showFunFact ? style.color : '#64748b' }}
        >
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{showFunFact ? 'FUN FACT' : 'FUN FACT を見る'}</span>
        </button>

        {showFunFact && (
          <div
            className="mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed border"
            style={{ background: style.bg, borderColor: style.border, color: style.color }}
          >
            <div className="flex gap-2">
              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{insight.funFact}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
