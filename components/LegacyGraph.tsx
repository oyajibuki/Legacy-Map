'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  riskLevel: string;
  riskScore: number;
  language: string;
  lines: number;
  val: number;
  color: string;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
};

type TooltipState = { x: number; y: number; node: GraphNode } | null;

function riskColor(level: string): string {
  switch (level) {
    case 'critical': return '#dc2626';
    case 'risk':     return '#ef4444';
    case 'caution':  return '#f59e0b';
    default:         return '#1e3a5f';
  }
}

function riskBorderColor(level: string): string {
  switch (level) {
    case 'critical': return '#fca5a5';
    case 'risk':     return '#fca5a5';
    case 'caution':  return '#fcd34d';
    default:         return '#334155';
  }
}

function riskGlow(level: string): string {
  switch (level) {
    case 'critical': return 'rgba(220,38,38,0.8)';
    case 'risk':     return 'rgba(239,68,68,0.6)';
    case 'caution':  return 'rgba(245,158,11,0.5)';
    default:         return 'transparent';
  }
}

function riskLabel(level: string): string {
  switch (level) {
    case 'critical': return '緊急';
    case 'risk':     return '危険';
    case 'caution':  return '注意';
    default:         return '安全';
  }
}

export default function LegacyGraph({ graph, selectedNode, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<TooltipState>(null);

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

  const graphData = {
    nodes: graph.nodes.map((n): GraphNode => ({
      id: n.id,
      name: n.name,
      riskLevel: n.riskLevel,
      riskScore: n.riskScore,
      language: n.language,
      lines: n.lines,
      val: Math.max(2, Math.min(12, n.lines / 80)),
      color: riskColor(n.riskLevel),
    })),
    links: graph.edges.map((e): GraphLink => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    })),
  };

  // Node drawing
  const nodeCanvasObject = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode;
    if (n.x === undefined || n.y === undefined) return;

    const radius = Math.max(4, n.val * 2.8);
    const isSelected = selectedNode?.id === n.id;

    // Outer glow for risky nodes
    if (n.riskLevel !== 'safe') {
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
    ctx.fillStyle = n.color;
    ctx.fill();

    // Border
    ctx.strokeStyle = riskBorderColor(n.riskLevel);
    ctx.lineWidth = isSelected ? 2 / globalScale : 1 / globalScale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Risk badge for critical/risk nodes
    if ((n.riskLevel === 'critical' || n.riskLevel === 'risk') && globalScale >= 0.5) {
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

    // Label
    const showLabel = globalScale >= 0.6;
    if (showLabel) {
      const fontSize = Math.max(9, Math.min(13, 11 / globalScale));
      ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      // Label background
      const labelY = n.y + radius + fontSize + 2;
      const tw = ctx.measureText(n.name).width;
      ctx.fillStyle = 'rgba(10,10,15,0.7)';
      ctx.fillRect(n.x - tw / 2 - 2, labelY - fontSize, tw + 4, fontSize + 2);
      ctx.fillStyle = n.riskLevel === 'safe' ? '#94a3b8' : '#f1f5f9';
      ctx.fillText(n.name, n.x, labelY);
    }
  }, [selectedNode]);

  // Click area — must be larger than visual node
  const nodePointerAreaPaint = useCallback((node: object, color: string, ctx: CanvasRenderingContext2D) => {
    const n = node as GraphNode;
    if (n.x === undefined || n.y === undefined) return;
    const radius = Math.max(4, n.val * 2.8) + 6; // 6px extra for easier clicking
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // Link drawing
  const linkCanvasObject = useCallback((link: object, ctx: CanvasRenderingContext2D) => {
    const l = link as GraphLink & {
      source: GraphNode;
      target: GraphNode;
    };
    if (!l.source?.x || !l.target?.x) return;

    const srcRisk = l.source.riskLevel;
    const tgtRisk = l.target.riskLevel;
    const isCritical = srcRisk === 'critical' || tgtRisk === 'critical';
    const isRisk = srcRisk === 'risk' || tgtRisk === 'risk';

    const color = isCritical ? 'rgba(220,38,38,0.4)' : isRisk ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.18)';

    ctx.beginPath();
    ctx.moveTo(l.source.x, l.source.y);
    ctx.lineTo(l.target.x, l.target.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.min(4, Math.max(0.5, l.weight * 0.8));
    ctx.stroke();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0a0a0f] overflow-hidden">

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="bg-[#111118]/95 border border-[#2d2d3e] rounded-lg px-3 py-2 shadow-xl text-xs max-w-[200px]">
            <p className="font-semibold text-slate-200 truncate">{tooltip.node.name}</p>
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

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-[#111118]/90 border border-[#1e293b] rounded-lg p-3 text-xs">
        <p className="text-slate-500 font-medium mb-2">リスクレベル</p>
        {[
          { level: 'safe',     label: 'そのまま使用可', color: '#1e3a5f', border: '#334155' },
          { level: 'caution',  label: '要注意',         color: '#f59e0b', border: '#fcd34d' },
          { level: 'risk',     label: '危険',           color: '#ef4444', border: '#fca5a5' },
          { level: 'critical', label: '緊急対応',       color: '#dc2626', border: '#fca5a5' },
        ].map(({ label, color, border }) => (
          <div key={label} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color, border: `1.5px solid ${border}` }} />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
        <div className="border-t border-[#1e293b] mt-2 pt-2">
          <p className="text-slate-500">— 線の太さ = 依存度</p>
          <p className="text-slate-500">⬤ サイズ = ファイル行数</p>
        </div>
      </div>

      {/* Stats chips */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
        {[
          { count: graph.stats.criticalFiles, label: '緊急', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
          { count: graph.stats.riskFiles,     label: '危険', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
          { count: graph.stats.cautionFiles,  label: '注意', cls: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
          { count: graph.stats.safeFiles,     label: '安全', cls: 'text-slate-400 border-slate-400/20 bg-slate-400/5' },
        ].filter(x => x.count > 0).map(({ count, label, cls }) => (
          <div key={label} className={`px-2.5 py-1 rounded-md border text-xs font-medium ${cls}`}>
            {count} {label}
          </div>
        ))}
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
            // tooltip position is set via mouse event; use node position as fallback
            setTooltip({ x: (n.x ?? 0), y: (n.y ?? 0), node: n });
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
