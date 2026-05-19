'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import FileScanner from '@/components/FileScanner';
import NodeDetail from '@/components/NodeDetail';
import ReportPanel from '@/components/ReportPanel';
import { DependencyGraph, FileNode, UploadedFile } from '@/lib/types';
import { Map as MapIcon, RefreshCw, AlertTriangle, Shield, TrendingUp, Files, ChevronRight, GitBranch } from 'lucide-react';

const LegacyGraph = dynamic(() => import('@/components/LegacyGraph'), { ssr: false });

type Step = 'upload' | 'viewing';

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [leftTab, setLeftTab] = useState<'overview' | 'structure'>('overview');

  async function handleFilesReady(files: UploadedFile[]) {
    setUploadedFiles(files);
    setIsAnalyzing(true);
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (!res.ok) throw new Error('Analysis failed');
      const data: DependencyGraph = await res.json();
      setGraph(data);
      setStep('viewing');
    } catch (err) {
      setError(`解析エラー: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function reset() {
    setStep('upload');
    setGraph(null);
    setUploadedFiles([]);
    setSelectedNode(null);
    setError('');
  }

  return (
    <div className="flex flex-col h-screen grid-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#1e293b] bg-[#0a0a0f]/80 backdrop-blur-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <MapIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200 tracking-wide">LegacyMap</h1>
            <p className="text-xs text-slate-600">レガシーコード可視化・リスク分析</p>
          </div>
        </div>

        {step === 'viewing' && graph && (
          <div className="flex items-center gap-6">
            {/* Stats bar */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <StatChip icon={<Files className="w-3 h-3" />} value={graph.stats.totalFiles} label="ファイル" color="text-slate-400" />
              <StatChip icon={<AlertTriangle className="w-3 h-3" />} value={graph.stats.criticalFiles + graph.stats.riskFiles} label="要対応" color="text-red-400" />
              <StatChip icon={<TrendingUp className="w-3 h-3" />} value={`${graph.stats.avgRiskScore}`} label="平均リスク" color={graph.stats.avgRiskScore > 50 ? 'text-red-400' : graph.stats.avgRiskScore > 25 ? 'text-amber-400' : 'text-slate-400'} />
              <StatChip icon={<Shield className="w-3 h-3" />} value={graph.stats.safeFiles} label="安全" color="text-green-500" />
            </div>

            <button
              onClick={reset}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-[#2d2d3e] hover:border-indigo-500/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              新規解析
            </button>
          </div>
        )}
      </header>

      {step === 'upload' && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <MapIcon className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-200 mb-2">LegacyMap</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                コードをアップロードすると依存関係グラフを生成し、<br />
                <span className="text-slate-400">変更不要 (黒)</span> ／ <span className="text-amber-400">要注意 (橙)</span> ／ <span className="text-red-400">危険 (赤)</span> を色分け表示。<br />
                AIが運用・移行戦略をレポートします。
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}
            <FileScanner onFilesReady={handleFilesReady} isAnalyzing={isAnalyzing} />
          </div>
        </div>
      )}

      {step === 'viewing' && graph && (
        <div className="flex-1 flex min-h-0">
          {/* Left panel */}
          <div className="w-72 flex-shrink-0 border-r border-[#1e293b] bg-[#0d0d14] flex flex-col overflow-hidden">
            {selectedNode ? (
              <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
            ) : (
              <>
                {/* Tab bar */}
                <div className="flex border-b border-[#1e293b] flex-shrink-0">
                  {(['overview', 'structure'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setLeftTab(tab)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        leftTab === tab
                          ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab === 'overview' ? '概要' : '構造'}
                    </button>
                  ))}
                </div>
                {leftTab === 'overview'
                  ? <ProjectOverview graph={graph} onSelectNode={setSelectedNode} />
                  : <StructureView graph={graph} onSelectNode={setSelectedNode} />
                }
              </>
            )}
          </div>

          {/* Main graph + report */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0">
              <LegacyGraph graph={graph} selectedNode={selectedNode} onSelectNode={setSelectedNode} />
            </div>
            <ReportPanel graph={graph} uploadedFiles={uploadedFiles} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function ProjectOverview({ graph, onSelectNode }: { graph: DependencyGraph; onSelectNode: (node: FileNode | null) => void }) {
  // Top risky files
  const topRisk = [...graph.nodes]
    .filter(n => n.riskLevel !== 'safe')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  // Hub files: most dependents (highest blast radius)
  const topHubs = [...graph.nodes]
    .filter(n => n.dependents.length > 0)
    .sort((a, b) => b.dependents.length - a.dependents.length)
    .slice(0, 5);

  // Directory breakdown
  const dirMap = new Map<string, { total: number; risk: number }>();
  for (const n of graph.nodes) {
    const parts = n.path.split('/');
    const dir = parts.length > 1 ? parts[0] : '(root)';
    const prev = dirMap.get(dir) ?? { total: 0, risk: 0 };
    dirMap.set(dir, {
      total: prev.total + 1,
      risk: prev.risk + (n.riskLevel !== 'safe' ? 1 : 0),
    });
  }
  const dirs = [...dirMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);

  const riskBadge = (level: string) => {
    if (level === 'critical') return <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">緊急</span>;
    if (level === 'risk') return <span className="text-[10px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">危険</span>;
    return <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">注意</span>;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {/* Stats grid */}
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">プロジェクト概要</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '総ファイル数', value: graph.stats.totalFiles, color: 'text-slate-300' },
            { label: '総行数', value: graph.stats.totalLines.toLocaleString(), color: 'text-slate-300' },
            { label: '依存エッジ', value: graph.edges.length, color: 'text-slate-300' },
            { label: '平均リスク', value: `${graph.stats.avgRiskScore}点`, color: graph.stats.avgRiskScore > 50 ? 'text-red-400' : graph.stats.avgRiskScore > 25 ? 'text-amber-400' : 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#0f0f1a] rounded-lg p-2.5 border border-[#1e293b]">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk distribution */}
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">リスク分布</p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: '緊急対応', count: graph.stats.criticalFiles, color: 'bg-red-500', textColor: 'text-red-400' },
            { label: '危険',     count: graph.stats.riskFiles,     color: 'bg-orange-500', textColor: 'text-orange-400' },
            { label: '要注意',   count: graph.stats.cautionFiles,  color: 'bg-amber-500',  textColor: 'text-amber-400' },
            { label: '安全',     count: graph.stats.safeFiles,     color: 'bg-slate-600',  textColor: 'text-slate-400' },
          ].map(({ label, count, color, textColor }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                <span className={`text-xs ${textColor}`}>{label}</span>
              </div>
              <span className="text-xs font-mono text-slate-500 w-6 text-right">{count}</span>
              <div className="w-14 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden flex-shrink-0">
                <div className={`h-full rounded-full ${color}`}
                  style={{ width: `${graph.stats.totalFiles > 0 ? (count / graph.stats.totalFiles) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top risky files — clickable */}
      {topRisk.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
            要対応ファイル TOP
          </p>
          <div className="flex flex-col gap-1">
            {topRisk.map(node => (
              <button
                key={node.id}
                onClick={() => onSelectNode(node)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0f0f1a] border border-[#1e293b] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate group-hover:text-slate-100">{node.name}</p>
                  <p className="text-[10px] text-slate-600 truncate">{node.path.split('/').slice(0, -1).join('/')}</p>
                </div>
                {riskBadge(node.riskLevel)}
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 group-hover:text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hub files — high blast radius */}
      {topHubs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <GitBranch className="w-3 h-3 text-slate-500" />
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">ハブファイル（高影響度）</p>
          </div>
          <div className="flex flex-col gap-1">
            {topHubs.map(node => (
              <button
                key={node.id}
                onClick={() => onSelectNode(node)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0f0f1a] border border-[#1e293b] hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate group-hover:text-slate-100">{node.name}</p>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{node.dependents.length}依存</span>
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 group-hover:text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Directory breakdown */}
      {dirs.length > 1 && (
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">ディレクトリ構成</p>
          <div className="flex flex-col gap-1">
            {dirs.map(([dir, { total, risk }]) => (
              <div key={dir} className="flex items-center gap-2 px-2 py-1 rounded bg-[#0f0f1a] border border-[#1e293b]">
                <p className="text-xs text-slate-400 flex-1 truncate font-mono">{dir}/</p>
                <span className="text-[10px] text-slate-600">{total}件</span>
                {risk > 0 && <span className="text-[10px] text-red-400">{risk}要対応</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Languages */}
      {graph.stats.languages.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">検出言語</p>
          <div className="flex flex-wrap gap-1.5">
            {graph.stats.languages.map(lang => (
              <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e2e] text-slate-400 border border-[#2d2d3e]">
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* EOL packages */}
      {graph.stats.eolPackages.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
            EOL検出 ({graph.stats.eolPackages.length}件)
          </p>
          <div className="flex flex-col gap-1">
            {graph.stats.eolPackages.slice(0, 8).map((eol, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-500/5 border border-red-500/15">
                <code className="text-xs text-red-400 font-mono flex-1 truncate">{eol.name}</code>
                <span className={`text-xs px-1 rounded ${eol.risk === 'critical' ? 'text-red-400' : eol.risk === 'high' ? 'text-orange-400' : 'text-amber-400'}`}>
                  {eol.risk === 'critical' ? '緊急' : eol.risk === 'high' ? '高' : '中'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Circular deps */}
      {graph.stats.circularDeps.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
            循環依存 ({graph.stats.circularDeps.length}件)
          </p>
          {graph.stats.circularDeps.slice(0, 3).map((cycle, i) => (
            <div key={i} className="text-xs text-red-400/70 bg-red-500/5 border border-red-500/15 rounded-md p-2 mb-1 font-mono">
              {cycle.map(c => c.split('/').pop()).join(' → ')}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-[#1e293b]">
        <p className="text-xs text-slate-600 leading-relaxed">
          ノードをクリックするとファイル詳細を表示。<br />
          下部の「AI分析」でレポート生成。
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Directory role inference
// ──────────────────────────────────────────────────────
const DIR_ROLES: Record<string, string> = {
  components: 'UIコンポーネント', component: 'UIコンポーネント',
  pages: 'ページ', page: 'ページ', views: 'ページ', screens: 'ページ',
  app: 'アプリルート',
  api: 'APIエンドポイント', routes: 'ルーティング', router: 'ルーティング',
  lib: 'ライブラリ', libs: 'ライブラリ', utils: 'ユーティリティ', util: 'ユーティリティ',
  helpers: 'ヘルパー', common: '共通モジュール', shared: '共通モジュール',
  hooks: 'カスタムHooks', hook: 'カスタムHooks',
  store: '状態管理', stores: '状態管理', redux: '状態管理', context: '状態管理',
  services: 'サービス層', service: 'サービス層', client: 'クライアント',
  models: 'データモデル', model: 'データモデル', types: '型定義', interfaces: '型定義',
  db: 'データベース', database: 'データベース', migrations: 'DBマイグレーション',
  tests: 'テスト', test: 'テスト', __tests__: 'テスト', spec: 'テスト', specs: 'テスト',
  scripts: 'スクリプト', bin: 'CLIツール', cmd: 'CLIツール',
  config: '設定', configs: '設定', settings: '設定',
  assets: '静的アセット', static: '静的アセット', public: '静的アセット',
  styles: 'スタイル', css: 'スタイル', scss: 'スタイル',
  docs: 'ドキュメント', doc: 'ドキュメント',
  // C / DOOM directories
  linuxdoom: 'Linux Doom ソース', doom: 'Doomソース',
  src: 'ソースコード',
};

function inferRole(dir: string): string {
  const lower = dir.toLowerCase().replace(/[-_.]/g, '');
  return DIR_ROLES[lower] || DIR_ROLES[dir.toLowerCase()] || '';
}

// ──────────────────────────────────────────────────────
// StructureView — directory tree with expand/collapse
// ──────────────────────────────────────────────────────
function StructureView({ graph, onSelectNode }: { graph: DependencyGraph; onSelectNode: (n: FileNode | null) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build directory tree (2 levels deep)
  const dirTree = new Map<string, { files: FileNode[]; subdirs: Map<string, FileNode[]> }>();

  for (const n of graph.nodes) {
    const parts = n.path.split('/');
    const topDir = parts.length > 1 ? parts[0] : '(root)';
    const subDir = parts.length > 2 ? parts[1] : '';

    if (!dirTree.has(topDir)) dirTree.set(topDir, { files: [], subdirs: new Map() });
    const entry = dirTree.get(topDir)!;

    if (subDir) {
      if (!entry.subdirs.has(subDir)) entry.subdirs.set(subDir, []);
      entry.subdirs.get(subDir)!.push(n);
    } else {
      entry.files.push(n);
    }
  }

  const sortedDirs = [...dirTree.entries()].sort((a, b) => {
    const aTotal = a[1].files.length + [...a[1].subdirs.values()].reduce((s, f) => s + f.length, 0);
    const bTotal = b[1].files.length + [...b[1].subdirs.values()].reduce((s, f) => s + f.length, 0);
    return bTotal - aTotal;
  });

  const riskDot = (level: string) => {
    const cls = level === 'critical' ? 'bg-red-500' : level === 'risk' ? 'bg-orange-400' : level === 'caution' ? 'bg-amber-400' : 'bg-slate-600';
    return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`} />;
  };

  const toggle = (key: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-0.5">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider px-1 py-2">ディレクトリ構造</p>
      {sortedDirs.map(([dir, { files, subdirs }]) => {
        const allFiles = [...files, ...[...subdirs.values()].flat()];
        const riskCount = allFiles.filter(n => n.riskLevel !== 'safe').length;
        const role = inferRole(dir);
        const isOpen = expanded.has(dir);
        const total = allFiles.length;

        return (
          <div key={dir}>
            {/* Directory row */}
            <button
              onClick={() => toggle(dir)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[#1a1a28] transition-colors text-left group"
            >
              <span className="text-slate-500 w-3 text-center text-xs flex-shrink-0">
                {isOpen ? '▾' : '▸'}
              </span>
              <span className="text-xs font-mono text-slate-300 truncate flex-1">{dir}/</span>
              {role && <span className="text-[10px] text-indigo-400/70 flex-shrink-0 hidden group-hover:block">{role}</span>}
              <span className="text-[10px] text-slate-600 flex-shrink-0">{total}</span>
              {riskCount > 0 && <span className="text-[10px] text-red-400 flex-shrink-0">⚠{riskCount}</span>}
            </button>

            {/* Role label when open */}
            {isOpen && role && (
              <div className="ml-7 mb-1 text-[10px] text-indigo-400/60 px-1">{role}</div>
            )}

            {/* Files & subdirs */}
            {isOpen && (
              <div className="ml-5 flex flex-col gap-0.5 mb-1">
                {/* Direct files */}
                {files.map(n => (
                  <button
                    key={n.id}
                    onClick={() => onSelectNode(n)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1e1e2e] text-left transition-colors"
                  >
                    {riskDot(n.riskLevel)}
                    <span className="text-xs text-slate-400 truncate hover:text-slate-200">{n.name}</span>
                    <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">{n.lines.toLocaleString()}行</span>
                  </button>
                ))}
                {/* Subdirs */}
                {[...subdirs.entries()].map(([sub, subFiles]) => {
                  const subKey = `${dir}/${sub}`;
                  const subOpen = expanded.has(subKey);
                  const subRisk = subFiles.filter(n => n.riskLevel !== 'safe').length;
                  return (
                    <div key={sub}>
                      <button
                        onClick={() => toggle(subKey)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1a1a28] text-left transition-colors w-full"
                      >
                        <span className="text-slate-600 w-2.5 text-[10px]">{subOpen ? '▾' : '▸'}</span>
                        <span className="text-xs font-mono text-slate-500 truncate flex-1">{sub}/</span>
                        <span className="text-[10px] text-slate-600">{subFiles.length}</span>
                        {subRisk > 0 && <span className="text-[10px] text-red-400">⚠{subRisk}</span>}
                      </button>
                      {subOpen && (
                        <div className="ml-4 flex flex-col gap-0.5">
                          {subFiles.map(n => (
                            <button
                              key={n.id}
                              onClick={() => onSelectNode(n)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1e1e2e] text-left transition-colors"
                            >
                              {riskDot(n.riskLevel)}
                              <span className="text-xs text-slate-400 truncate hover:text-slate-200">{n.name}</span>
                              <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">{n.lines.toLocaleString()}行</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
