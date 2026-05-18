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
};

type GraphLink = {
  source: string;
  target: string;
  weight: number;
};

function riskColor(level: string): string {
  switch (level) {
    case 'critical': return '#dc2626';
    case 'risk': return '#ef4444';
    case 'caution': return '#f59e0b';
    default: return '#1e293b';
  }
}

function riskGlow(level: string): string {
  switch (level) {
    case 'critical': return 'rgba(220,38,38,0.7)';
    case 'risk': return 'rgba(239,68,68,0.5)';
    case 'caution': return 'rgba(245,158,11,0.4)';
    default: return 'rgba(99,102,241,0.2)';
  }
}

export default function LegacyGraph({ graph, selectedNode, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const graphData = {
    nodes: graph.nodes.map((n): GraphNode => ({
      id: n.id,
      name: n.name,
      riskLevel: n.riskLevel,
      riskScore: n.riskScore,
      language: n.language,
      lines: n.lines,
      val: Math.max(1, Math.min(8, n.lines / 100)),
      color: riskColor(n.riskLevel),
    })),
    links: graph.edges.map((e): GraphLink => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    })),
  };

  const nodeCanvasObject = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode & { x: number; y: number };
    const label = n.name;
    const fontSize = Math.max(8, 12 / globalScale);
    const radius = Math.max(3, n.val * 2.5);
    const isSelected = selectedNode?.id === n.id;

    // Glow effect for risky nodes
    if (n.riskLevel !== 'safe') {
      ctx.shadowColor = riskGlow(n.riskLevel);
      ctx.shadowBlur = isSelected ? 20 : n.riskLevel === 'critical' ? 12 : 6;
    }

    // Draw circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius + (isSelected ? 3 : 0), 0, 2 * Math.PI);
    ctx.fillStyle = n.color;
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#6366f1' : n.riskLevel === 'safe' ? '#334155' : n.color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    if (globalScale >= 0.8) {
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = n.riskLevel === 'safe' ? '#64748b' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(label, n.x, n.y + radius + fontSize + 2);
    }
  }, [selectedNode]);

  const linkCanvasObject = useCallback((link: object, ctx: CanvasRenderingContext2D) => {
    const l = link as GraphLink & { source: { x: number; y: number; riskLevel: string }; target: { x: number; y: number; riskLevel: string } };
    if (!l.source?.x || !l.target?.x) return;

    const isHighRisk = l.source.riskLevel !== 'safe' || l.target.riskLevel !== 'safe';
    ctx.beginPath();
    ctx.moveTo(l.source.x, l.source.y);
    ctx.lineTo(l.target.x, l.target.y);
    ctx.strokeStyle = isHighRisk ? 'rgba(239,68,68,0.3)' : 'rgba(100,116,139,0.2)';
    ctx.lineWidth = Math.min(5, Math.max(0.5, l.weight));
    ctx.stroke();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0a0a0f]">
      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-[#111118]/90 border border-[#1e293b] rounded-lg p-3 text-xs">
        <p className="text-slate-500 font-medium mb-1">リスクレベル</p>
        {[
          { level: 'safe', label: 'そのまま使用可', color: '#334155' },
          { level: 'caution', label: '要注意', color: '#f59e0b' },
          { level: 'risk', label: '危険', color: '#ef4444' },
          { level: 'critical', label: '緊急対応', color: '#dc2626' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-current" style={{ backgroundColor: color, color }} />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
        <div className="border-t border-[#1e293b] mt-1 pt-1">
          <p className="text-slate-500">線の太さ = 依存度</p>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        {[
          { count: graph.stats.criticalFiles, label: '緊急', color: 'text-red-500 border-red-500/30 bg-red-500/10' },
          { count: graph.stats.riskFiles, label: '危険', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
          { count: graph.stats.cautionFiles, label: '注意', color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
          { count: graph.stats.safeFiles, label: '安全', color: 'text-slate-400 border-slate-400/20 bg-slate-400/5' },
        ].map(({ count, label, color }) => count > 0 && (
          <div key={label} className={`px-2.5 py-1 rounded-md border text-xs font-medium ${color}`}>
            {count} {label}
          </div>
        ))}
      </div>

      <ForceGraph2D
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={(node) => {
          const n = node as GraphNode;
          const fileNode = graph.nodes.find(fn => fn.id === n.id) || null;
          onSelectNode(selectedNode?.id === n.id ? null : fileNode);
        }}
        onBackgroundClick={() => onSelectNode(null)}
        backgroundColor="#0a0a0f"
        cooldownTicks={100}
        nodeRelSize={1}
      />
    </div>
  );
}
