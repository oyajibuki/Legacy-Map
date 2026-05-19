'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DependencyGraph, FileNode } from '@/lib/types';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface Props {
  graph: DependencyGraph;
  selectedNode: FileNode | null;
  onSelectNode: (node: FileNode | null) => void;
}

type GraphNode = {
  id: string;
  name: string;
  group: string;       // module group
  riskLevel: string;
  riskScore: number;
  language: string;
  lines: number;
  val: number;
  color: string;       // fill color (risk or module depending on mode)
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
};

type TooltipState = { x: number; y: number; node: GraphNode } | null;
type ColorMode = 'risk' | 'module';

// ── Risk color helpers ─────────────────────────────────────
function riskColor(level: string): string {
  switch (level) {
    case 'critical': return '#dc2626';
    case 'risk':     return '#ef4444';
    case 'caution':  return '#f59e0b';
    default:         return '#1e3a5f';
  }
}
function riskBorderColor(level: string): string {
  if (level === 'critical' || level === 'risk') return '#fca5a5';
  if (level === 'caution') return '#fcd34d';
  return '#334155';
}
function riskGlow(level: string): string {
  if (level === 'critical') return 'rgba(220,38,38,0.8)';
  if (level === 'risk')     return 'rgba(239,68,68,0.6)';
  if (level === 'caution')  return 'rgba(245,158,11,0.5)';
  return 'transparent';
}
function riskLabel(level: string): string {
  if (level === 'critical') return '緊急';
  if (level === 'risk')     return '危険';
  if (level === 'caution')  return '注意';
  return '安全';
}

// ── Module group detection ─────────────────────────────────
const C_PREFIXES: [string, string][] = [
  ['st_', 'ステータスバー'], ['hu_', 'HUD'], ['am_', 'オートマップ'],
  ['wi_', 'スコア画面'], ['r_', 'レンダラー'], ['p_', 'プレイヤー'],
  ['g_', 'ゲームロジック'], ['s_', 'サウンド'], ['w_', 'リソース(WAD)'],
  ['m_', 'メニュー/メモリ'], ['d_', 'メイン'], ['f_', 'フィナーレ'],
  ['i_', 'プラットフォーム'], ['v_', 'ビデオ'],
];

function detectGroup(path: string, ext: string, name: string): string {
  const parts = path.split('/');
  if (parts.length > 1) return parts[0];                        // use top-level dir
  const lower = name.toLowerCase();
  if (['.c', '.h', '.cpp', '.hpp'].includes(ext)) {
    for (const [prefix, label] of C_PREFIXES) {
      if (lower.startsWith(prefix)) return label;
    }
    return 'その他';
  }
  return parts[0] || '(root)';
}

// ── Module color palette ───────────────────────────────────
const MODULE_PALETTE = [
  '#818cf8','#34d399','#f59e0b','#38bdf8','#f472b6','#a78bfa',
  '#4ade80','#fb923c','#22d3ee','#c084fc','#2dd4bf','#f43f5e',
  '#84cc16','#60a5fa','#facc15','#e879f9',
];

// ── Main component ─────────────────────────────────────────
export default function LegacyGraph({ graph, selectedNode, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('risk');

  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Assign deterministic colors to each module group
  const moduleColors = useMemo(() => {
    const groups = [...new Set(graph.nodes.map(n => detectGroup(n.path, n.extension, n.name)))].sort();
    const m = new Map<string, string>();
    groups.forEach((g, i) => m.set(g, MODULE_PALETTE[i % MODULE_PALETTE.length]));
    return m;
  }, [graph]);

  // Memoized graph data — only rebuilds when `graph` changes, NOT on node selection or colorMode
  const graphData = useMemo(() => ({
    nodes: graph.nodes.map((n): GraphNode => {
      const group = detectGroup(n.path, n.extension, n.name);
      return {
        id: n.id,
        name: n.name,
        group,
        riskLevel: n.riskLevel,
        riskScore: n.riskScore,
        language: n.language,
        lines: n.lines,
        val: Math.max(2, Math.min(12, n.lines / 80)),
        color: riskColor(n.riskLevel), // base; overridden in draw callback
      };
    }),
    links: graph.edges.map((e): GraphLink => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    })),
  }), [graph]);

  // ── Node canvas rendering ───────────────────────────────
  const nodeCanvasObject = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode;
    if (n.x === undefined || n.y === undefined) return;

    const radius = Math.max(4, n.val * 2.8);
    const isSelected = selectedNode?.id === n.id;
    const fillColor = colorMode === 'module'
      ? (moduleColors.get(n.group) ?? '#6366f1')
      : riskColor(n.riskLevel);

    // Glow
    if (colorMode === 'risk' && n.riskLevel !== 'safe') {
      ctx.shadowColor = riskGlow(n.riskLevel);
      ctx.shadowBlur = isSelected ? 24 : n.riskLevel === 'critical' ? 16 : 8;
    } else if (isSelected) {
      ctx.shadowColor = 'rgba(99,102,241,0.8)';
      ctx.shadowBlur = 20;
    }

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Fill
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Border — in module mode use a thin dark border; in risk mode use risk color
    if (colorMode === 'module') {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = (isSelected ? 2 : 0.5) / globalScale;
    } else {
      ctx.strokeStyle = riskBorderColor(n.riskLevel);
      ctx.lineWidth = (isSelected ? 2 : 1) / globalScale;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Risk badge (!) in risk mode
    if (colorMode === 'risk' && (n.riskLevel === 'critical' || n.riskLevel === 'risk') && globalScale >= 0.5) {
      const badgeR = radius * 0.45;
      ctx.beginPath();
      ctx.arc(n.x + radius * 0.7, n.y - radius * 0.7, badgeR, 0, 2 * Math.PI);
      ctx.fillStyle = n.riskLevel === 'critical' ? '#dc2626' : '#f59e0b';
      ctx.fill();
      ctx.font = `bold ${badgeR * 1.4}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', n.x + radius * 0.7, n.y - radius * 0.7);
      ctx.textBaseline = 'alphabetic';
    }

    // Risk indicator ring in module mode
    if (colorMode === 'module' && n.riskLevel !== 'safe') {
      const ringColor = n.riskLevel === 'critical' ? '#dc2626' : n.riskLevel === 'risk' ? '#f97316' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 2.5 / globalScale, 0, 2 * Math.PI);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Label
    if (globalScale >= 0.6) {
      const fontSize = Math.max(9, Math.min(13, 11 / globalScale));
      ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      const labelY = n.y + radius + fontSize + 2;
      const tw = ctx.measureText(n.name).width;
      ctx.fillStyle = 'rgba(10,10,15,0.7)';
      ctx.fillRect(n.x - tw / 2 - 2, labelY - fontSize, tw + 4, fontSize + 2);
      ctx.fillStyle = n.riskLevel === 'safe' || colorMode === 'module' ? '#94a3b8' : '#f1f5f9';
      ctx.fillText(n.name, n.x, labelY);
    }
  }, [selectedNode, colorMode, moduleColors]);

  // Click area (larger than visual)
  const nodePointerAreaPaint = useCallback((node: object, color: string, ctx: CanvasRenderingContext2D) => {
    const n = node as GraphNode;
    if (n.x === undefined || n.y === undefined) return;
    const radius = Math.max(4, n.val * 2.8) + 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // Link rendering
  const linkCanvasObject = useCallback((link: object, ctx: CanvasRenderingContext2D) => {
    const l = link as GraphLink & { source: GraphNode; target: GraphNode };
    if (!l.source?.x || !l.target?.x) return;

    let color: string;
    if (colorMode === 'module') {
      // Same group = visible, cross-group = faint
      const sameGroup = l.source.group === l.target.group;
      color = sameGroup ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.08)';
    } else {
      const isCritical = l.source.riskLevel === 'critical' || l.target.riskLevel === 'critical';
      const isRisk = l.source.riskLevel === 'risk' || l.target.riskLevel === 'risk';
      color = isCritical ? 'rgba(220,38,38,0.4)' : isRisk ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.18)';
    }

    ctx.beginPath();
    ctx.moveTo(l.source.x, l.source.y);
    ctx.lineTo(l.target.x, l.target.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.min(4, Math.max(0.5, l.weight * 0.8));
    ctx.stroke();
  }, [colorMode]);

  // ── Build legend items ──────────────────────────────────
  const legendItems = colorMode === 'risk'
    ? [
        { color: '#1e3a5f', border: '#334155', label: 'そのまま使用可' },
        { color: '#f59e0b', border: '#fcd34d', label: '要注意' },
        { color: '#ef4444', border: '#fca5a5', label: '危険' },
        { color: '#dc2626', border: '#fca5a5', label: '緊急対応' },
      ]
    : [...moduleColors.entries()].map(([group, color]) => ({ color, border: 'transparent', label: group }));

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0a0a0f] overflow-hidden">

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute z-20 pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div className="bg-[#111118]/95 border border-[#2d2d3e] rounded-lg px-3 py-2 shadow-xl text-xs max-w-[220px]">
            <p className="font-semibold text-slate-200 truncate">{tooltip.node.name}</p>
            {colorMode === 'module' && (
              <p className="text-indigo-400 text-[10px] mt-0.5">{tooltip.node.group}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold
                ${tooltip.node.riskLevel === 'critical' ? 'bg-red-500/30 text-red-300' :
                  tooltip.node.riskLevel === 'risk' ? 'bg-orange-500/30 text-orange-300' :
                  tooltip.node.riskLevel === 'caution' ? 'bg-amber-500/30 text-amber-300' :
                  'bg-slate-500/20 text-slate-400'}`}>
                {riskLabel(tooltip.node.riskLevel)}
              </span>
              <span className="text-slate-500">{tooltip.node.riskScore}点</span>
            </div>
            <p className="text-slate-500 mt-0.5">{tooltip.node.language} · {tooltip.node.lines.toLocaleString()}行</p>
            <p className="text-slate-600 mt-0.5 text-[10px]">クリックで詳細を表示</p>
          </div>
        </div>
      )}

      {/* Color mode toggle */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <div className="flex rounded-lg overflow-hidden border border-[#1e293b] text-xs">
          <button
            onClick={() => setColorMode('risk')}
            className={`px-2.5 py-1.5 transition-colors ${colorMode === 'risk'
              ? 'bg-indigo-600 text-white font-medium'
              : 'bg-[#111118] text-slate-400 hover:text-slate-200'}`}
          >
            リスク色
          </button>
          <button
            onClick={() => setColorMode('module')}
            className={`px-2.5 py-1.5 transition-colors border-l border-[#1e293b] ${colorMode === 'module'
              ? 'bg-indigo-600 text-white font-medium'
              : 'bg-[#111118] text-slate-400 hover:text-slate-200'}`}
          >
            モジュール色
          </button>
        </div>

        {/* Risk count chips (risk mode only) */}
        {colorMode === 'risk' && (
          <div className="flex flex-wrap gap-1">
            {[
              { count: graph.stats.criticalFiles, label: '緊急', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
              { count: graph.stats.riskFiles,     label: '危険', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
              { count: graph.stats.cautionFiles,  label: '注意', cls: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
              { count: graph.stats.safeFiles,     label: '安全', cls: 'text-slate-400 border-slate-400/20 bg-slate-400/5' },
            ].filter(x => x.count > 0).map(({ count, label, cls }) => (
              <div key={label} className={`px-2 py-0.5 rounded border text-[11px] font-medium ${cls}`}>
                {count} {label}
              </div>
            ))}
          </div>
        )}

        {/* Module mode note */}
        {colorMode === 'module' && (
          <p className="text-[10px] text-slate-600 px-1">
            ⚠ リスクは外枠の色で表示
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-[#111118]/90 border border-[#1e293b] rounded-lg p-3 text-xs max-h-[70vh] overflow-y-auto">
        <p className="text-slate-500 font-medium mb-2">
          {colorMode === 'risk' ? 'リスクレベル' : 'モジュール'}
        </p>
        {legendItems.map(({ label, color, border }) => (
          <div key={label} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color, border: border !== 'transparent' ? `1.5px solid ${border}` : 'none', outline: border === 'transparent' ? '1px solid rgba(255,255,255,0.15)' : 'none' }} />
            <span className="text-slate-400 truncate max-w-[120px]">{label}</span>
          </div>
        ))}
        {colorMode === 'risk' && (
          <div className="border-t border-[#1e293b] mt-2 pt-2">
            <p className="text-slate-500">— 線の太さ = 依存度</p>
            <p className="text-slate-500">⬤ サイズ = 行数</p>
          </div>
        )}
        {colorMode === 'module' && (
          <div className="border-t border-[#1e293b] mt-2 pt-2">
            <p className="text-slate-500">外枠 = リスクレベル</p>
            <p className="text-slate-500 mt-0.5">🟠 要注意  🔴 危険/緊急</p>
          </div>
        )}
      </div>

      {/* Click hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-slate-600 bg-[#0a0a0f]/80 px-3 py-1 rounded-full border border-[#1e293b]">
        ノードをクリックで詳細 · スクロールでズーム · ドラッグで移動
      </div>

      <ForceGraph2D
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={(node) => {
          const n = node as GraphNode;
          const fileNode = graph.nodes.find(fn => fn.id === n.id) ?? null;
          onSelectNode(selectedNode?.id === n.id ? null : fileNode);
          setTooltip(null);
        }}
        onNodeHover={(node) => {
          if (node) {
            const n = node as GraphNode;
            setTooltip({ x: n.x ?? 0, y: n.y ?? 0, node: n });
          } else {
            setTooltip(null);
          }
        }}
        onBackgroundClick={() => { onSelectNode(null); setTooltip(null); }}
        backgroundColor="#0a0a0f"
        cooldownTicks={120}
        nodeRelSize={1}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
