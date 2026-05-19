'use client';

import { FileNode } from '@/lib/types';
import { X, FileCode, AlertTriangle, CheckCircle, AlertCircle, XCircle, ChevronRight } from 'lucide-react';

interface Props {
  node: FileNode;
  onClose: () => void;
}

const RISK_LABELS = {
  safe:     { label: 'そのまま使用可', Icon: CheckCircle,  color: 'text-slate-400',  bg: 'bg-slate-400/10 border-slate-400/20' },
  caution:  { label: '要注意',         Icon: AlertCircle,  color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/30' },
  risk:     { label: '危険',           Icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-400/10 border-red-400/30' },
  critical: { label: '緊急対応',       Icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-500/10 border-red-500/30' },
};

const SEV_COLOR: Record<string, string> = {
  low:      'bg-blue-500/20 text-blue-300 border-blue-500/20',
  medium:   'bg-amber-500/20 text-amber-300 border-amber-500/20',
  high:     'bg-red-500/20 text-red-300 border-red-500/20',
  critical: 'bg-red-600/30 text-red-200 border-red-600/40',
};

const SEV_JP: Record<string, string> = {
  low: '低', medium: '中', high: '高', critical: '緊急',
};

// Japanese name + why it's bad + what to do
const RISK_INFO: Record<string, { name: string; why: string; action: string }> = {
  'God File': {
    name: '神ファイル（超巨大）',
    why: '1ファイルに責務が詰め込まれすぎています。変更のたびにバグリスクが高く、テストも困難です。',
    action: '機能ごとに複数ファイルへ分割することを検討。先にテストを書いてから分割すると安全です。',
  },
  'Large File': {
    name: '大ファイル',
    why: 'ファイルが肥大化しています。このまま機能追加を続けると管理困難になります。',
    action: '関連する機能をサブモジュールへ切り出すことを検討してください。',
  },
  'Big File': {
    name: 'ファイルサイズ注意',
    why: '今は許容範囲ですが、成長に注意が必要です。',
    action: '今後の追加機能は別ファイルへ分離することを検討してください。',
  },
  'No Tests': {
    name: 'テストなし',
    why: 'このファイルの動作を保証するテストがありません。変更が既存機能を壊しても気づけません。',
    action: '変更前に最低限のユニットテストまたはスナップショットテストを追加してください。',
  },
  'High Coupling': {
    name: '高結合（依存が多い）',
    why: '多くの外部モジュールに依存しているため、依存先の変更がこのファイルに連鎖的に影響します。',
    action: 'インターフェースを介した依存性の注入（DI）を検討。不要な依存を整理してください。',
  },
  'Moderate Coupling': {
    name: '中程度の結合',
    why: '依存関係がやや多めです。今後の追加に注意してください。',
    action: '新しい依存を追加する前に、既存の依存が本当に必要か確認してください。',
  },
  'EOL Dependency': {
    name: 'サポート終了ライブラリ',
    why: 'セキュリティパッチが提供されなくなったライブラリを使用しています。脆弱性が放置され続けます。',
    action: '代替ライブラリへの移行を計画してください。まずバージョンを固定し影響範囲を把握します。',
  },
  'Circular Dependency': {
    name: '循環依存',
    why: 'A→B→A のような循環参照があります。テスト・変更・ビルドがすべて困難になります。',
    action: '循環を断ち切る共通インターフェースファイル（types.ts等）を作成して抽象化してください。',
  },
  'CoffeeScript': {
    name: 'CoffeeScript（廃止言語）',
    why: 'CoffeeScriptは事実上廃止されており、新しい開発者が理解困難でツールサポートもありません。',
    action: 'TypeScript/JavaScriptへの段階的な移行を強く推奨します。',
  },
  'Legacy Pattern': {
    name: 'レガシーファイル',
    why: '廃止または非推奨のファイル形式・ツールを使用しています。',
    action: '現代的な代替手段への移行を検討してください。',
  },
  'High Blast Radius': {
    name: '高影響ファイル（ハブ）',
    why: '多くのファイルがこのファイルに依存しています。変更するとシステム全体に影響が波及します。',
    action: '変更前に依存ファイルを全て把握し、必ずテストを実行。APIシグネチャを安定させてください。',
  },
};

function getRiskInfo(type: string) {
  return RISK_INFO[type] ?? { name: type, why: '', action: '' };
}

export default function NodeDetail({ node, onClose }: Props) {
  const { label, Icon, color, bg } = RISK_LABELS[node.riskLevel];
  const scorePercent = node.riskScore;
  const scoreColor =
    scorePercent >= 70 ? 'bg-red-500' :
    scorePercent >= 40 ? 'bg-orange-400' :
    scorePercent >= 15 ? 'bg-amber-400' : 'bg-slate-500';

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
        {/* Risk badge + score bar */}
        <div className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg border ${bg}`}>
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-sm font-medium ${color}`}>{label}</span>
            <span className="ml-auto text-xs font-mono font-bold text-slate-400">{node.riskScore}/100</span>
          </div>
          <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreColor}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          {node.riskFactors.length > 0 && (
            <p className="text-xs text-slate-500">
              {node.riskFactors.length}件のリスク要因が検出されました
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '言語', value: node.language },
            { label: '行数', value: node.lines.toLocaleString() },
            { label: '外部依存', value: `${node.imports.length}個` },
            { label: '被依存数', value: `${node.dependents.length}ファイル` },
            { label: 'テスト', value: node.isTest ? 'テストファイル' : node.hasTests ? 'あり ✓' : 'なし ✗' },
            { label: 'EOL依存', value: `${node.eolPackages.length}件` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0f0f1a] rounded-lg p-2.5 border border-[#1e293b]">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm text-slate-300 font-medium mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Blast radius warning */}
        {node.dependents.length >= 5 && (
          <div className="flex items-start gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/25 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300 leading-relaxed">
              <span className="font-semibold">{node.dependents.length}ファイルがこのファイルに依存</span>しています。
              変更すると広範な影響が生じます。変更前に必ず全依存先を確認してください。
            </p>
          </div>
        )}

        {/* Risk factors — with Japanese explanation and action */}
        {node.riskFactors.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">リスク詳細と対処法</p>
            <div className="flex flex-col gap-2">
              {node.riskFactors.map((f, i) => {
                const info = getRiskInfo(f.type);
                return (
                  <div key={i} className="bg-[#0f0f1a] border border-[#1e293b] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SEV_COLOR[f.severity]}`}>
                        {SEV_JP[f.severity]}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">{info.name}</span>
                    </div>
                    {/* Why */}
                    <div className="flex gap-1.5 mb-1.5">
                      <span className="text-[10px] text-slate-600 flex-shrink-0 mt-0.5">⚠</span>
                      <p className="text-xs text-slate-500 leading-relaxed">{info.why || f.description}</p>
                    </div>
                    {/* Action */}
                    {info.action && (
                      <div className="flex gap-1.5 mt-1 pt-1.5 border-t border-[#1e293b]">
                        <ChevronRight className="w-3 h-3 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-300/80 leading-relaxed">{info.action}</p>
                      </div>
                    )}
                  </div>
                );
              })}
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
              このファイルが依存 ({node.deps.length})
            </p>
            <div className="flex flex-col gap-1">
              {node.deps.slice(0, 10).map((dep, i) => (
                <div key={i} className="text-xs text-slate-500 bg-[#0f0f1a] rounded px-2 py-1 truncate font-mono border border-[#1e293b]">
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
