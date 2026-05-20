'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import FileScanner from '@/components/FileScanner';
import NodeDetail from '@/components/NodeDetail';
import ReportPanel from '@/components/ReportPanel';
import DemoSidebar from '@/components/DemoSidebar';
import ProjectInsightCard from '@/components/ProjectInsightCard';
import { DependencyGraph, FileNode, UploadedFile } from '@/lib/types';
import { detectKnownProject, ProjectInsight, KNOWN_PROJECTS, ARCH_STYLES } from '@/lib/known-projects';
import { DemoProject, DEMOS } from '@/lib/demo-list';
import {
  AlertTriangle, Shield, TrendingUp, Files,
  ChevronRight, GitBranch, RefreshCw, ArrowLeft,
} from 'lucide-react';

const LegacyGraph3D = dynamic(() => import('@/components/LegacyGraph3D'), { ssr: false });

// ── Mode ─────────────────────────────────────────────────────
// 'demo'    : showing a pre-computed demo project
// 'upload'  : user wants to upload their own code
// 'viewing' : showing user's own analyzed code
type AppMode = 'demo' | 'upload' | 'viewing';

export default function Home() {
  const [mode, setMode]           = useState<AppMode>('demo');
  const [graph, setGraph]         = useState<DependencyGraph | null>(null);
  const [demoId, setDemoId]       = useState<string>('1993_DOOM');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedNode, setSelectedNode]   = useState<FileNode | null>(null);
  const [isAnalyzing, setIsAnalyzing]     = useState(false);
  const [error, setError]         = useState('');
  const [insight, setInsight]     = useState<ProjectInsight | null>(null);
  const [leftTab, setLeftTab]     = useState<'overview' | 'structure'>('overview');
  const [showUploadInSidebar, setShowUploadInSidebar] = useState(false);

  // ── Load demo JSON ──────────────────────────────────────────
  const loadDemo = useCallback(async (demo: DemoProject) => {
    setIsDemoLoading(true);
    setSelectedNode(null);
    setInsight(null);
    setDemoId(demo.id);
    try {
      const res = await fetch(`/demos/${demo.id}.json`);
      if (!res.ok) throw new Error(`${demo.id}.json not found (run /api/generate-demos first)`);
      const data: DependencyGraph = await res.json();
      setGraph(data);
      setMode('demo');
      // Use direct ID mapping first — avoids mis-detection (e.g. ChocolateDoom → DOOM)
      const directInsight = demo.knownProjectId
        ? (KNOWN_PROJECTS.find(p => p.id === demo.knownProjectId) ?? null)
        : null;
      setInsight(directInsight ?? detectKnownProject(data.nodes.map(n => n.path)));
    } catch (err) {
      setError(`デモ読み込みエラー: ${err}`);
    } finally {
      setIsDemoLoading(false);
    }
  }, []);

  // Auto-load first demo on mount
  useEffect(() => {
    const first = DEMOS.find(d => d.id === '1993_DOOM') ?? DEMOS[0];
    loadDemo(first);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Analyze uploaded code ───────────────────────────────────
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
      setMode('viewing');
      setSelectedNode(null);
      setInsight(detectKnownProject(data.nodes.map(n => n.path)));
    } catch (err) {
      setError(`解析エラー: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function backToDemo() {
    setMode('demo');
    setShowUploadInSidebar(false);
    setError('');
    // Reload last demo
    const demo = DEMOS.find(d => d.id === demoId) ?? DEMOS[0];
    loadDemo(demo);
  }

  // ── Shared graph area ─────────────────────────────────────
  const graphArea = graph ? (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Stats bar — shown in both demo & viewing modes */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#1e293b] bg-[#0a0a0f]/80 flex-shrink-0 text-xs">
        <div className="flex items-center gap-4">
          <StatChip icon={<Files className="w-3 h-3"/>}        value={graph.stats.totalFiles}                          label="ファイル" color="text-slate-400"/>
          <StatChip icon={<GitBranch className="w-3 h-3"/>}    value={graph.edges.length}                              label="接続"     color="text-indigo-400"/>
          <StatChip icon={<AlertTriangle className="w-3 h-3"/>} value={graph.stats.criticalFiles+graph.stats.riskFiles} label="要対応"   color="text-red-400"/>
          <StatChip icon={<TrendingUp className="w-3 h-3"/>}   value={`${graph.stats.avgRiskScore}`}                   label="平均リスク" color={graph.stats.avgRiskScore>50?'text-red-400':graph.stats.avgRiskScore>25?'text-amber-400':'text-slate-400'}/>
          <StatChip icon={<Shield className="w-3 h-3"/>}       value={graph.stats.safeFiles}                           label="安全"     color="text-green-500"/>
        </div>
        {mode === 'viewing' && (
          <button onClick={backToDemo} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[#2d2d3e] text-slate-400 hover:text-slate-200 hover:border-indigo-500/40 transition-colors">
            <ArrowLeft className="w-3 h-3"/> デモに戻る
          </button>
        )}
      </div>

      {/* Graph + right panel */}
      <div className="flex-1 flex min-h-0">
        {/* Node detail panel (left, in viewing mode only) */}
        {mode === 'viewing' && selectedNode && (
          <div className="w-64 flex-shrink-0 border-r border-[#1e293b] bg-[#0d0d14] flex flex-col overflow-hidden">
            <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
        )}

        {/* 3D graph */}
        <div className="flex-1 min-w-0 relative">
          <LegacyGraph3D graph={graph} selectedNode={selectedNode} onSelectNode={setSelectedNode} />
          {/* Insight card: only show as floating popup in viewing mode */}
          {mode === 'viewing' && insight && (
            <ProjectInsightCard insight={insight} onDismiss={() => setInsight(null)} />
          )}
        </div>

        {/* Overview panel — shown in demo mode on the right side */}
        {mode === 'demo' && (
          <div className="w-64 flex-shrink-0 border-l border-[#1e293b] bg-[#0d0d14] flex flex-col overflow-y-auto">
            <DemoOverview graph={graph} insight={insight} selectedNode={selectedNode} onSelectNode={setSelectedNode} />
          </div>
        )}

        {/* Viewing mode: full-width left panel tabs */}
        {mode === 'viewing' && !selectedNode && (
          <div className="w-64 flex-shrink-0 border-l border-[#1e293b] bg-[#0d0d14] flex flex-col overflow-hidden order-first">
            <div className="flex border-b border-[#1e293b] flex-shrink-0">
              {(['overview','structure'] as const).map(tab => (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    leftTab===tab ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  {tab==='overview'?'概要':'構造'}
                </button>
              ))}
            </div>
            {leftTab==='overview'
              ? <ProjectOverview graph={graph} onSelectNode={setSelectedNode}/>
              : <StructureView graph={graph} onSelectNode={setSelectedNode}/>
            }
          </div>
        )}
      </div>

      {/* Report panel */}
      <ReportPanel graph={graph} uploadedFiles={uploadedFiles} />
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      {isDemoLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin"/>
          <p>デモを読み込み中...</p>
        </div>
      ) : error ? (
        <div className="max-w-sm text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <p className="text-slate-600 text-xs">ヒント: 開発環境で <code className="text-indigo-400">/api/generate-demos</code> にアクセスしてJSONを生成してください</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col h-screen grid-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-4 py-2 border-b border-[#1e293b] bg-[#0a0a0f]/80 backdrop-blur-sm z-20 flex-shrink-0 gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="text-slate-300 font-semibold">LegacyMap</span>
          <span>·</span>
          <span>伝説のコードを3Dで読む</span>
        </div>
        <div className="flex-1"/>
        {mode === 'upload' && (
          <button onClick={() => { setMode('demo'); setShowUploadInSidebar(false); }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[#2d2d3e] text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-3 h-3"/> デモに戻る
          </button>
        )}
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ── LEFT SIDEBAR ─────────────────────────────── */}
        <div className="w-64 flex-shrink-0">
          {mode === 'upload' ? (
            /* Upload mode: show file scanner in sidebar */
            <div className="flex flex-col h-full bg-[#0a0a0f] border-r border-[#1e293b] overflow-hidden">
              {/* Back button */}
              <button
                onClick={() => { setMode('demo'); setError(''); }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-[#0f0f1a] border-b border-[#1e293b] transition-colors text-left w-full flex-shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                ホームに戻る
              </button>
              <div className="px-4 pt-3 pb-3 border-b border-[#1e293b] flex-shrink-0">
                <p className="text-sm font-semibold text-slate-200 mb-0.5">自分のコードを解析</p>
                <p className="text-[11px] text-slate-500">フォルダをドロップするかクリックして選択</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {error && (
                  <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">{error}</div>
                )}
                <FileScanner onFilesReady={handleFilesReady} isAnalyzing={isAnalyzing}/>
              </div>
            </div>
          ) : (
            /* Demo mode: show demo timeline */
            <DemoSidebar
              selectedId={demoId}
              onSelect={loadDemo}
              onUploadClick={() => setMode('upload')}
              isLoading={isDemoLoading}
            />
          )}
        </div>

        {/* ── MAIN AREA ────────────────────────────────── */}
        {mode === 'upload' && !graph ? (
          <div className="flex-1 flex items-center justify-center bg-[#02020a]">
            <div className="text-center text-slate-600">
              <p className="text-4xl mb-3">🗺️</p>
              <p className="text-sm">左のパネルからファイルをアップロードしてください</p>
              <p className="text-xs mt-1">解析後、3Dグラフが表示されます</p>
            </div>
          </div>
        ) : (
          graphArea
        )}
      </div>
    </div>
  );
}

// ── Small stat chip ───────────────────────────────────────────
function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: number|string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={color}>{icon}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

// ── Demo Overview (right panel in demo mode) ──────────────────
function DemoOverview({
  graph,
  insight,
  selectedNode,
  onSelectNode,
}: {
  graph: DependencyGraph;
  insight: ProjectInsight | null;
  selectedNode: FileNode | null;
  onSelectNode: (n: FileNode | null) => void;
}) {
  const [showFunFact, setShowFunFact] = useState(false);
  const topRisk = [...graph.nodes].filter(n => n.riskLevel !== 'safe').sort((a,b)=>b.riskScore-a.riskScore).slice(0,5);
  const topHubs = [...graph.nodes].filter(n=>n.dependents.length>0).sort((a,b)=>b.dependents.length-a.dependents.length).slice(0,4);
  const style = insight ? ARCH_STYLES[insight.archType] : null;

  // ── Node risk detail view ──
  if (selectedNode) {
    const rl = selectedNode.riskLevel;
    const riskColor =
      rl === 'critical' ? { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    label: '緊急' } :
      rl === 'risk'     ? { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: '危険' } :
      rl === 'caution'  ? { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  label: '注意' } :
                          { text: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30',  label: '安全' };
    const severityColor = (s: string) =>
      s === 'critical' ? 'text-red-400 bg-red-500/15 border-red-500/30' :
      s === 'high'     ? 'text-orange-400 bg-orange-500/15 border-orange-500/30' :
      s === 'medium'   ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' :
                         'text-slate-400 bg-slate-500/15 border-slate-500/30';
    const severityLabel = (s: string) =>
      s === 'critical' ? '致命的' : s === 'high' ? '高' : s === 'medium' ? '中' : '低';

    return (
      <div className="p-3 flex flex-col gap-3 text-xs">
        {/* Back button */}
        <button
          onClick={() => onSelectNode(null)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors -ml-0.5"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          プロジェクト概要に戻る
        </button>

        {/* File header */}
        <div className={`rounded-lg p-3 border ${riskColor.bg} ${riskColor.border}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${riskColor.text} ${riskColor.border} bg-black/20`}>
              {riskColor.label}
            </span>
            <span className="text-[10px] text-slate-500">{selectedNode.language}</span>
            <span className="text-[10px] text-slate-600 ml-auto">{selectedNode.lines.toLocaleString()}行</span>
          </div>
          <p className={`text-sm font-bold ${riskColor.text} truncate`}>{selectedNode.name}</p>
          <p className="text-[10px] text-slate-600 truncate mt-0.5">{selectedNode.path}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#0d0d18] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rl === 'critical' ? 'bg-red-500' : rl === 'risk' ? 'bg-orange-500' : rl === 'caution' ? 'bg-amber-500' : 'bg-slate-600'}`}
                style={{ width: `${selectedNode.riskScore}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono ${riskColor.text}`}>{selectedNode.riskScore}点</span>
          </div>
        </div>

        {/* Risk factors */}
        {selectedNode.riskFactors.length > 0 ? (
          <div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
              ⚠ 危険な理由（{selectedNode.riskFactors.length}件）
            </p>
            <div className="flex flex-col gap-1.5">
              {selectedNode.riskFactors.map((rf, i) => (
                <div key={i} className={`rounded-lg p-2.5 border ${severityColor(rf.severity).split(' ').slice(1).join(' ')}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${severityColor(rf.severity)}`}>
                      {severityLabel(rf.severity)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{rf.type}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{rf.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">リスク要因の詳細なし</p>
        )}

        {/* EOL packages */}
        {selectedNode.eolPackages.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">
              💀 EOL依存パッケージ
            </p>
            {selectedNode.eolPackages.map((pkg, i) => (
              <div key={i} className="rounded p-2 bg-red-500/8 border border-red-500/20 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-red-400 font-bold">{pkg.name}</span>
                  <span className="text-[9px] text-red-600 ml-auto">EOL: {pkg.eol}</span>
                </div>
                {pkg.note && <p className="text-[10px] text-slate-500 mt-0.5">{pkg.note}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Deps info */}
        {(selectedNode.deps.length > 0 || selectedNode.dependents.length > 0) && (
          <div className="rounded p-2.5 bg-[#0f0f1a] border border-[#1e293b]">
            <p className="text-[10px] text-slate-500 mb-1.5">依存関係</p>
            <div className="flex gap-3">
              <div>
                <p className="text-[10px] text-slate-600">参照先</p>
                <p className="text-sm font-bold text-indigo-400">{selectedNode.deps.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-600">参照元</p>
                <p className="text-sm font-bold text-indigo-400">{selectedNode.dependents.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3 text-xs">

      {/* ── Project Insight (top section) ── */}
      {insight && style ? (
        <div
          className="rounded-lg p-3 border"
          style={{ background: style.bg, borderColor: style.border }}
        >
          {/* Badge + tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold"
              style={{ color: style.color, borderColor: style.border, background: 'rgba(0,0,0,0.3)' }}
            >
              {style.badge}
            </span>
            {insight.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0d0d18]/60 border border-[#2d2d3e] text-slate-500">
                {tag}
              </span>
            ))}
          </div>

          {/* Headline */}
          <p className="text-xs font-bold leading-snug mb-2" style={{ color: style.color }}>
            「{insight.headline}」
          </p>

          {/* Insight text */}
          <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
            {insight.insight}
          </p>

          {/* Fun fact toggle */}
          <button
            onClick={() => setShowFunFact(v => !v)}
            className="text-[10px] px-2 py-1 rounded border transition-colors w-full text-left"
            style={{ color: style.color, borderColor: style.border, background: 'rgba(0,0,0,0.2)' }}
          >
            💡 {showFunFact ? '▾' : '▸'} FUN FACT
          </button>
          {showFunFact && (
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2 pl-1 border-l-2" style={{ borderColor: style.border }}>
              {insight.funFact}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">プロジェクト概要</p>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          {label:'ファイル', value:graph.stats.totalFiles},
          {label:'行数', value:graph.stats.totalLines.toLocaleString()},
          {label:'接続', value:graph.edges.length},
          {label:'平均リスク', value:`${graph.stats.avgRiskScore}点`},
        ].map(({label,value})=>(
          <div key={label} className="bg-[#0f0f1a] rounded p-2 border border-[#1e293b]">
            <p className="text-[10px] text-slate-600">{label}</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Risk distribution ── */}
      <div>
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">リスク分布</p>
        {[
          {l:'緊急', c:graph.stats.criticalFiles, cls:'bg-red-500 text-red-400'},
          {l:'危険', c:graph.stats.riskFiles,     cls:'bg-orange-500 text-orange-400'},
          {l:'注意', c:graph.stats.cautionFiles,  cls:'bg-amber-500 text-amber-400'},
          {l:'安全', c:graph.stats.safeFiles,     cls:'bg-slate-600 text-slate-500'},
        ].map(({l,c,cls})=>(
          <div key={l} className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.split(' ')[0]}`}/>
            <span className={`flex-1 ${cls.split(' ')[1]}`}>{l}</span>
            <span className="text-slate-600 font-mono w-5 text-right">{c}</span>
            <div className="w-12 h-1 bg-[#1e1e2e] rounded-full overflow-hidden flex-shrink-0">
              <div className={`h-full rounded-full ${cls.split(' ')[0]}`} style={{width:`${graph.stats.totalFiles>0?(c/graph.stats.totalFiles)*100:0}%`}}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Top risky ── */}
      {topRisk.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">要対応 TOP</p>
          {topRisk.map(n => (
            <button key={n.id} onClick={() => onSelectNode(n)}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f0f1a] border border-[#1e293b] hover:border-indigo-500/40 mb-0.5 text-left group">
              <p className="flex-1 text-[11px] text-slate-400 truncate group-hover:text-slate-200">{n.name}</p>
              <span className={`text-[9px] px-1 rounded font-bold ${n.riskLevel==='critical'?'bg-red-500/20 text-red-400':n.riskLevel==='risk'?'bg-orange-500/20 text-orange-400':'bg-amber-500/20 text-amber-400'}`}>
                {n.riskLevel==='critical'?'緊急':n.riskLevel==='risk'?'危険':'注意'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Hub files ── */}
      {topHubs.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">ハブファイル</p>
          {topHubs.map(n => (
            <button key={n.id} onClick={() => onSelectNode(n)}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f0f1a] border border-[#1e293b] hover:border-indigo-500/40 mb-0.5 text-left group">
              <p className="flex-1 text-[11px] text-slate-400 truncate group-hover:text-slate-200">{n.name}</p>
              <span className="text-[10px] text-slate-600">{n.dependents.length}依存</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Languages ── */}
      {graph.stats.languages.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5">検出言語</p>
          <div className="flex flex-wrap gap-1">
            {graph.stats.languages.map(lang => (
              <span key={lang} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e2e] text-slate-500 border border-[#2d2d3e]">{lang}</span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed mt-auto pt-2 border-t border-[#1e293b]">
        ノードをクリックでファイル詳細。<br/>
        下部「AI分析」でGemini APIにより詳細レポートも生成可。
      </p>
    </div>
  );
}

// ── ProjectOverview / StructureView (for viewing mode) ────────
const DIR_ROLES: Record<string, string> = {
  components:'UIコンポーネント', pages:'ページ', app:'アプリルート',
  api:'APIエンドポイント', lib:'ライブラリ', utils:'ユーティリティ',
  hooks:'カスタムHooks', store:'状態管理', services:'サービス層',
  models:'データモデル', types:'型定義', db:'データベース',
  tests:'テスト', config:'設定', src:'ソースコード',
  linuxdoom:'Linux Doom ソース', doom:'Doomソース',
};
function inferRole(dir: string) {
  return DIR_ROLES[dir.toLowerCase().replace(/[-_.]/g,'')] || DIR_ROLES[dir.toLowerCase()] || '';
}

function ProjectOverview({ graph, onSelectNode }: { graph: DependencyGraph; onSelectNode: (n: FileNode|null) => void }) {
  const topRisk = [...graph.nodes].filter(n=>n.riskLevel!=='safe').sort((a,b)=>b.riskScore-a.riskScore).slice(0,8);
  const topHubs = [...graph.nodes].filter(n=>n.dependents.length>0).sort((a,b)=>b.dependents.length-a.dependents.length).slice(0,5);
  const dirMap = new Map<string,{total:number;risk:number}>();
  for(const n of graph.nodes){
    const dir = n.path.split('/').length>1 ? n.path.split('/')[0] : '(root)';
    const p = dirMap.get(dir)??{total:0,risk:0};
    dirMap.set(dir,{total:p.total+1,risk:p.risk+(n.riskLevel!=='safe'?1:0)});
  }
  const dirs = [...dirMap.entries()].sort((a,b)=>b[1].total-a[1].total).slice(0,6);
  const riskBadge = (l:string) => l==='critical'
    ? <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">緊急</span>
    : l==='risk'
    ? <span className="text-[10px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">危険</span>
    : <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">注意</span>;

  return (
    <div className="flex flex-col overflow-y-auto p-3 gap-3 text-xs">
      <div className="grid grid-cols-2 gap-1.5">
        {[{l:'総ファイル数',v:graph.stats.totalFiles},{l:'総行数',v:graph.stats.totalLines.toLocaleString()},{l:'依存エッジ',v:graph.edges.length},{l:'平均リスク',v:`${graph.stats.avgRiskScore}点`}].map(({l,v})=>(
          <div key={l} className="bg-[#0f0f1a] rounded p-2 border border-[#1e293b]">
            <p className="text-[10px] text-slate-600">{l}</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {topRisk.length>0&&(
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">要対応 TOP</p>
          {topRisk.map(n=>(
            <button key={n.id} onClick={()=>onSelectNode(n)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#0f0f1a] border border-[#1e293b] hover:border-indigo-500/40 mb-0.5 text-left group">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 truncate group-hover:text-slate-100">{n.name}</p>
                <p className="text-[10px] text-slate-600 truncate">{n.path.split('/').slice(0,-1).join('/')}</p>
              </div>
              {riskBadge(n.riskLevel)}
              <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0"/>
            </button>
          ))}
        </div>
      )}
      {topHubs.length>0&&(
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">ハブファイル</p>
          {topHubs.map(n=>(
            <button key={n.id} onClick={()=>onSelectNode(n)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#0f0f1a] border border-[#1e293b] hover:border-indigo-500/40 mb-0.5 text-left group">
              <p className="flex-1 text-xs text-slate-300 truncate group-hover:text-slate-100">{n.name}</p>
              <span className="text-[10px] text-slate-500">{n.dependents.length}依存</span>
            </button>
          ))}
        </div>
      )}
      {dirs.length>1&&(
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">ディレクトリ</p>
          {dirs.map(([dir,{total,risk}])=>(
            <div key={dir} className="flex items-center gap-2 px-2 py-1 rounded bg-[#0f0f1a] border border-[#1e293b] mb-0.5">
              <p className="text-xs text-slate-400 flex-1 truncate font-mono">{dir}/</p>
              <span className="text-[10px] text-slate-600">{total}</span>
              {risk>0&&<span className="text-[10px] text-red-400">⚠{risk}</span>}
            </div>
          ))}
        </div>
      )}
      {graph.stats.languages.length>0&&(
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">検出言語</p>
          <div className="flex flex-wrap gap-1">
            {graph.stats.languages.map(l=>(
              <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e1e2e] text-slate-500 border border-[#2d2d3e]">{l}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StructureView({ graph, onSelectNode }: { graph: DependencyGraph; onSelectNode: (n: FileNode|null) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dirTree = new Map<string,{files:FileNode[];subdirs:Map<string,FileNode[]>}>();
  for(const n of graph.nodes){
    const parts = n.path.split('/');
    const top = parts.length>1?parts[0]:'(root)';
    const sub = parts.length>2?parts[1]:'';
    if(!dirTree.has(top)) dirTree.set(top,{files:[],subdirs:new Map()});
    const e = dirTree.get(top)!;
    if(sub){if(!e.subdirs.has(sub))e.subdirs.set(sub,[]);e.subdirs.get(sub)!.push(n);}
    else e.files.push(n);
  }
  const sorted = [...dirTree.entries()].sort((a,b)=>{
    const aT=a[1].files.length+[...a[1].subdirs.values()].reduce((s,f)=>s+f.length,0);
    const bT=b[1].files.length+[...b[1].subdirs.values()].reduce((s,f)=>s+f.length,0);
    return bT-aT;
  });
  const dot=(l:string)=>{
    const c=l==='critical'?'bg-red-500':l==='risk'?'bg-orange-400':l==='caution'?'bg-amber-400':'bg-slate-600';
    return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c}`}/>;
  };
  const toggle=(k:string)=>setExpanded(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n;});
  return(
    <div className="flex flex-col overflow-y-auto p-2 gap-0.5 text-xs">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider px-1 py-2">ディレクトリ構造</p>
      {sorted.map(([dir,{files,subdirs}])=>{
        const all=[...files,...[...subdirs.values()].flat()];
        const risk=all.filter(n=>n.riskLevel!=='safe').length;
        const role=inferRole(dir);
        const open=expanded.has(dir);
        return(
          <div key={dir}>
            <button onClick={()=>toggle(dir)} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#1a1a28] text-left group">
              <span className="text-slate-500 w-3 text-center">{open?'▾':'▸'}</span>
              <span className="text-xs font-mono text-slate-300 truncate flex-1">{dir}/</span>
              {role&&<span className="text-[10px] text-indigo-400/70 hidden group-hover:block">{role}</span>}
              <span className="text-[10px] text-slate-600">{all.length}</span>
              {risk>0&&<span className="text-[10px] text-red-400">⚠{risk}</span>}
            </button>
            {open&&(
              <div className="ml-4 flex flex-col gap-0.5 mb-1">
                {files.map(n=>(
                  <button key={n.id} onClick={()=>onSelectNode(n)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1e1e2e] text-left">
                    {dot(n.riskLevel)}<span className="text-xs text-slate-400 truncate hover:text-slate-200">{n.name}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">{n.lines.toLocaleString()}行</span>
                  </button>
                ))}
                {[...subdirs.entries()].map(([sub,sf])=>{
                  const sk=`${dir}/${sub}`;const so=expanded.has(sk);const sr=sf.filter(n=>n.riskLevel!=='safe').length;
                  return(
                    <div key={sub}>
                      <button onClick={()=>toggle(sk)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1a1a28] text-left w-full">
                        <span className="text-slate-600 w-2.5 text-[10px]">{so?'▾':'▸'}</span>
                        <span className="text-xs font-mono text-slate-500 truncate flex-1">{sub}/</span>
                        <span className="text-[10px] text-slate-600">{sf.length}</span>
                        {sr>0&&<span className="text-[10px] text-red-400">⚠{sr}</span>}
                      </button>
                      {so&&<div className="ml-4 flex flex-col gap-0.5">
                        {sf.map(n=>(
                          <button key={n.id} onClick={()=>onSelectNode(n)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#1e1e2e] text-left">
                            {dot(n.riskLevel)}<span className="text-xs text-slate-400 truncate hover:text-slate-200">{n.name}</span>
                            <span className="text-[10px] text-slate-600 ml-auto">{n.lines.toLocaleString()}行</span>
                          </button>
                        ))}
                      </div>}
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
