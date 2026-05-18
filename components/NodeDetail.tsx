'use client';

import { FileNode } from '@/lib/types';
import { X, FileCode, AlertTriangle, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface Props {
  node: FileNode;
  onClose: () => void;
}

const RISK_LABELS = {
  safe: { label: 'そのまま使用可', Icon: CheckCircle, color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20' },
  caution: { label: '要注意', Icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' },
  risk: { label: '危険', Icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30' },
  critical: { label: '緊急対応', Icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30 animate-pulse-glow' },
};

const SEV_COLOR: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  high: 'bg-red-500/20 text-red-300 border-red-500/20',
  critical: 'bg-red-600/30 text-red-200 border-red-600/40',
};

const SEV_JP: Record<string, string> = {
  low: '低', medium: '中', high: '高', critical: '緊急',
};

export default function NodeDetail({ node, onClose }: Props) {
  const { label, Icon, color, bg } = RISK_LABELS[node.riskLevel];

  return (
    <div className="flex flex-col h-full animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-[#1e293b]">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileCode className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{node.name}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{node.path}</p>
          </div>
        </div>
        <button onClick={onClose} className="flex-shrink-0 p-1 hover:bg-[#1e293b] rounded-md transition-colors ml-2">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Risk badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
          <span className={`text-sm font-medium ${color}`}>{label}</span>
          <span className="ml-auto text-xs font-mono font-bold text-slate-400">{node.riskScore}/100</span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '言語', value: node.language },
            { label: '行数', value: node.lines.toLocaleString() },
            { label: '外部依存', value: `${node.imports.length}` },
            { label: '依存元', value: `${node.dependents.length}` },
            { label: 'テスト', value: node.isTest ? 'テストファイル' : node.hasTests ? 'あり ✓' : 'なし ✗' },
            { label: 'EOL依存', value: `${node.eolPackages.length}件` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0f0f1a] rounded-lg p-2.5 border border-[#1e293b]">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm text-slate-300 font-medium mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Risk factors */}
        {node.riskFactors.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">リスク要因</p>
            <div className="flex flex-col gap-2">
              {node.riskFactors.map((f, i) => (
                <div key={i} className="bg-[#0f0f1a] border border-[#1e293b] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SEV_COLOR[f.severity]}`}>
                      {SEV_JP[f.severity]}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">{f.type}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EOL packages */}
        {node.eolPackages.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">EOL / 非推奨パッケージ</p>
            <div className="flex flex-col gap-1.5">
              {node.eolPackages.map((eol, i) => (
                <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-red-400 font-mono">{eol.name}</code>
                    <span className="text-xs text-slate-500 ml-auto">EOL: {eol.eol}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{eol.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {node.deps.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
              ファイル依存 ({node.deps.length})
            </p>
            <div className="flex flex-col gap-1">
              {node.deps.slice(0, 10).map((dep, i) => (
                <div key={i} className="text-xs text-slate-500 bg-[#0f0f1a] rounded px-2 py-1 truncate font-mono">
                  {dep.split('/').pop()}
                </div>
              ))}
              {node.deps.length > 10 && (
                <p className="text-xs text-slate-600 pl-1">...他 {node.deps.length - 10} ファイル</p>
              )}
            </div>
          </div>
        )}

        {/* Safe message */}
        {node.riskLevel === 'safe' && node.riskFactors.length === 0 && (
          <div className="bg-slate-500/5 border border-slate-500/20 rounded-lg p-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              ✅ このファイルはリスク要因が検出されませんでした。変更なしで継続使用できます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
