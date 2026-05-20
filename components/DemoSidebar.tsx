'use client';

import { useState } from 'react';
import { Upload, ChevronRight } from 'lucide-react';
import {
  DEMOS, CATEGORIES, CATEGORY_ICONS,
  getDemosByCategory, DemoCategory, DemoProject,
} from '@/lib/demo-list';
import { ARCH_STYLES } from '@/lib/known-projects';

interface Props {
  selectedId: string | null;
  onSelect: (demo: DemoProject) => void;
  onUploadClick: () => void;
  isLoading: boolean;
}

export default function DemoSidebar({ selectedId, onSelect, onUploadClick, isLoading }: Props) {
  const [category, setCategory] = useState<DemoCategory>('すべて');
  const filtered = getDemosByCategory(category);
  const selected = DEMOS.find(d => d.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] border-r border-[#1e293b] overflow-hidden">

      {/* ── App title + tagline ───────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1e293b] flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[10px]">🗺️</div>
          <span className="text-sm font-bold text-slate-200">LegacyMap</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          30年分の伝説コードを3Dで可視化。<br/>
          依存関係・リスク・設計の美醜がひと目でわかる。
        </p>
      </div>

      {/* ── Category filter ───────────────────────────── */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">カテゴリ</p>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                category === cat
                  ? 'bg-indigo-600 border-indigo-500 text-white font-medium'
                  : 'bg-[#0d0d18] border-[#2d2d3e] text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {CATEGORY_ICONS[cat]} {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Timeline list ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">
          タイムライン（{filtered.length}件）
        </p>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-[#1e293b]" />

          {filtered.map((demo) => {
            const style = ARCH_STYLES[demo.archType];
            const isSelected = demo.id === selectedId;
            return (
              <button
                key={demo.id}
                onClick={() => onSelect(demo)}
                disabled={isLoading}
                className={`w-full flex items-start gap-3 py-2 px-1 rounded-lg text-left transition-all mb-0.5 group relative
                  ${isSelected
                    ? 'bg-[#13131f] border border-[#2d2d3e]'
                    : 'hover:bg-[#0f0f1a] border border-transparent'
                  }`}
              >
                {/* Year dot */}
                <div className="flex-shrink-0 flex flex-col items-center mt-1 z-10">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-current scale-110' : 'border-[#2d2d3e] group-hover:border-current'
                    }`}
                    style={{ borderColor: isSelected ? style.color : undefined, backgroundColor: isSelected ? style.bg : undefined }}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-mono text-slate-600">{demo.year}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold"
                      style={{ color: style.color, borderColor: style.border, background: style.bg }}
                    >
                      {style.badge}
                    </span>
                  </div>
                  <p className={`text-xs font-semibold truncate transition-colors ${
                    isSelected ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    {demo.name}
                  </p>
                  <p className="text-[10px] text-slate-600 truncate">{demo.lang} · {demo.creator.split('（')[0].split('/')[0].trim()}</p>
                </div>

                {isSelected && isLoading && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" style={{ borderColor: style.color }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected demo description ─────────────────── */}
      {selected && (
        <div
          className="flex-shrink-0 mx-3 mb-2 rounded-lg p-3 border text-xs"
          style={{
            background: ARCH_STYLES[selected.archType].bg,
            borderColor: ARCH_STYLES[selected.archType].border,
          }}
        >
          <p className="font-semibold text-slate-200 mb-1 leading-snug">
            「{selected.tagline}」
          </p>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            {selected.description}
          </p>
        </div>
      )}

      {/* ── Upload own code ───────────────────────────── */}
      <div className="flex-shrink-0 px-3 pb-4 border-t border-[#1e293b] pt-3">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-indigo-500/40 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 transition-colors text-xs font-medium"
        >
          <Upload className="w-3.5 h-3.5" />
          自分のコードを解析する
        </button>
        <p className="text-[10px] text-slate-600 text-center mt-1.5">
          Gemini APIキーでAI分析も可能
        </p>
      </div>
    </div>
  );
}
