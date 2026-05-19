'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DependencyGraph, FileNode } from '@/lib/types';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface Props {
  graph: DependencyGraph;
  selectedNode: FileNode | null;
  onSelectNode: (node: FileNode | null) => void;
}

// ── Layer definitions (outer → inner) ──────────────────────
type LayerKey = 'ui' | 'api' | 'service' | 'core';

const LAYERS: Record<LayerKey, { radius: number; label: string; color: string; desc: string }> = {
  ui:      { radius: 200, label: 'UI層',        color: '#818cf8', desc: 'フロントエンド・画面' },
  api:     { radius: 135, label: 'API/ルート層', color: '#34d399', desc: 'エンドポイント・ルーティング' },
  service: { radius: 80,  label: 'サービス層',   color: '#f59e0b', desc: 'ビジネスロジック・ライブラリ' },
  core:    { radius: 35,  label: 'コア層',       color: '#f472b6', desc: 'データモデル・システム基盤' },
};

const LAYER_RADII: Record<LayerKey, number> = { ui: 200, api: 135, service: 80, core: 35 };

// Web/generic layer detection
const UI_DIRS      = new Set(['components','component','pages','page','views','view','screens','screen','app','frontend','ui','layouts','layout','templates']);
const API_DIRS     = new Set(['api','routes','route','controllers','controller','handlers','handler','endpoints','endpoint','middleware']);
const SERVICE_DIRS = new Set(['services','service','hooks','hook','utils','util','lib','libs','helpers','helper','common','shared','actions']);
const CORE_DIRS    = new Set(['models','model','db','database','types','type','interfaces','interface','core','store','stores','config','configs']);

// DOOM C prefix layer detection
const C_UI_PREFIXES      = ['hu_','st_','am_','wi_','v_'];
const C_API_PREFIXES     = ['p_','m_','g_','f_'];
const C_SERVICE_PREFIXES = ['r_','s_'];
const C_CORE_PREFIXES    = ['w_','i_','d_'];

function detectLayer(path: string, ext: string, name: string): LayerKey {
  const parts  = path.split('/');
  const topDir = parts[0].toLowerCase();

  if (parts.length > 1) {
    if (UI_DIRS.has(topDir))      return 'ui';
    if (API_DIRS.has(topDir))     return 'api';
    if (SERVICE_DIRS.has(topDir)) return 'service';
    if (CORE_DIRS.has(topDir))    return 'core';
  }

  if (['.c','.h','.cpp','.hpp'].includes(ext.toLowerCase())) {
    const n = name.toLowerCase();
    if (C_UI_PREFIXES.some(p => n.startsWith(p)))      return 'ui';
    if (C_API_PREFIXES.some(p => n.startsWith(p)))     return 'api';
    if (C_SERVICE_PREFIXES.some(p => n.startsWith(p))) return 'service';
    if (C_CORE_PREFIXES.some(p => n.startsWith(p)))    return 'core';
  }

  return 'service';
}

function riskColor(level: string): string {
  if (level === 'critical') return '#dc2626';
  if (level === 'risk')     return '#f97316';
  if (level === 'caution')  return '#f59e0b';
  return '#1e40af';
}
function riskLabel(level: string): string {
  if (level === 'critical') return '緊急';
  if (level === 'risk')     return '危険';
  if (level === 'caution')  return '注意';
  return '安全';
}

// ── Graph node type ─────────────────────────────────────────
type GNode = {
  id: string;
  name: string;
  layer: LayerKey;
  riskLevel: string;
  riskScore: number;
  language: string;
  lines: number;
  val: number;
  degree: number;   // total in+out connections (used for link thickness)
  color: string;
  // D3 position (mutated in place)
  x?: number; y?: number; z?: number;
  fx?: number; fy?: number; fz?: number;
};

type GLink = { source: string | GNode; target: string | GNode; weight: number };

// ── Component ──────────────────────────────────────────────
export default function LegacyGraph3D({ graph, selectedNode, onSelectNode }: Props) {
  const fgRef = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GNode } | null>(null);
  const [showLayers, setShowLayers] = useState(true);
  const [colorMode, setColorMode] = useState<'risk' | 'layer'>('layer');

  // Memoized data — only rebuilds when graph changes
  const graphData = useMemo(() => {
    // Pre-compute degree (total connections per node) for link thickness
    const degreeMap = new Map<string, number>();
    for (const e of graph.edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    }
    return {
      nodes: graph.nodes.map((n): GNode => {
        const layer = detectLayer(n.path, n.extension, n.name);
        return {
          id: n.id,
          name: n.name,
          layer,
          riskLevel: n.riskLevel,
          riskScore: n.riskScore,
          language: n.language,
          lines: n.lines,
          val: Math.max(1, Math.min(8, n.lines / 100)),
          degree: degreeMap.get(n.id) ?? 0,
          color: LAYERS[layer].color,
        };
      }),
      links: graph.edges.map((e): GLink => ({
        source: e.source, target: e.target, weight: e.weight,
      })),
    };
  }, [graph]);

  // Apply radial force after graph initialises → creates the concentric sphere shells
  useEffect(() => {
    if (!fgRef.current) return;
    const timer = setTimeout(() => {
      if (!fgRef.current) return;
      try {
        // Use d3-force-3d's forceRadial to constrain nodes to their layer radius
        const { forceRadial } = require('d3-force-3d');
        fgRef.current.d3Force(
          'radial',
          forceRadial((node: GNode) => LAYER_RADII[node.layer])
            .strength(2.5)
        );
        // Reduce link force to let radial dominate
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce) linkForce.distance(30).strength(0.2);
        // Reduce charge to allow spreading around each shell
        const chargeForce = fgRef.current.d3Force('charge');
        if (chargeForce) chargeForce.strength(-80);
        // Reheat
        fgRef.current.d3ReheatSimulation();
      } catch (e) {
        console.warn('Could not apply radial force:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [graphData]);

  // Node appearance
  const nodeThreeObject = useCallback((node: object) => {
    const n = node as GNode;
    const THREE = require('three');
    const isSelected = selectedNode?.id === n.id;
    const radius = Math.max(2.5, n.val * 2);

    const group = new THREE.Group();

    // Main sphere
    const geo = new THREE.SphereGeometry(radius, 12, 8);
    const fillColor = colorMode === 'layer'
      ? LAYERS[n.layer].color
      : riskColor(n.riskLevel);
    const mat = new THREE.MeshLambertMaterial({
      color: fillColor,
      transparent: true,
      opacity: n.riskLevel === 'safe' ? 0.7 : 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    // Risk indicator — only critical gets the Saturn ring; risk gets a corona glow
    if (n.riskLevel === 'critical') {
      // Saturn-style ring (reserved for most dangerous)
      const ringGeo = new THREE.TorusGeometry(radius * 1.8, radius * 0.12, 6, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 3;
      group.add(ring);
    } else if (n.riskLevel === 'risk') {
      // Corona glow sphere (orange aura, no ring)
      const coronaGeo = new THREE.SphereGeometry(radius * 1.5, 8, 6);
      const coronaMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.18, side: THREE.BackSide });
      group.add(new THREE.Mesh(coronaGeo, coronaMat));
    }

    // Selection ring
    if (isSelected) {
      const selGeo = new THREE.TorusGeometry(radius * 2, radius * 0.15, 8, 32);
      const selMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.9 });
      const sel = new THREE.Mesh(selGeo, selMat);
      group.add(sel);
      // Extra outer glow
      const glowGeo = new THREE.SphereGeometry(radius * 1.6, 12, 8);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.15, side: THREE.BackSide });
      group.add(new THREE.Mesh(glowGeo, glowMat));
    }

    return group;
  }, [selectedNode, colorMode]);

  // Link color — cross-layer = bright, same-layer = subtle
  const linkColor = useCallback((link: object) => {
    const l = link as GLink & { source: GNode; target: GNode };
    const src = typeof l.source === 'object' ? l.source : null;
    const tgt = typeof l.target === 'object' ? l.target : null;
    if (!src || !tgt) return 'rgba(148,163,184,0.4)';
    if (src.layer !== tgt.layer) return 'rgba(200,220,255,0.65)'; // cross-layer: bright blue-white
    return 'rgba(148,163,184,0.35)';                              // same-layer: subtle grey
  }, []);

  // Link width — based on average degree of connected nodes
  // Hub-to-hub connections are thick; leaf-to-leaf are thin
  const linkWidth = useCallback((link: object) => {
    const l = link as GLink & { source: GNode; target: GNode };
    const src = typeof l.source === 'object' ? l.source : null;
    const tgt = typeof l.target === 'object' ? l.target : null;
    if (!src || !tgt) return 2;
    const avgDegree = (src.degree + tgt.degree) / 2;
    // min 1.5, max 8, scales with how connected both endpoints are
    return Math.min(8, Math.max(1.5, avgDegree * 0.7));
  }, []);

  return (
    <div className="w-full h-full relative bg-[#02020a] overflow-hidden">
      {/* Tooltip */}
      {tooltip && (
        <div className="absolute z-20 pointer-events-none" style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}>
          <div className="bg-[#0d0d18]/96 border border-[#2d2d3e] rounded-lg px-3 py-2 shadow-xl text-xs max-w-[220px]">
            <p className="font-semibold text-slate-200 truncate">{tooltip.node.name}</p>
            <p className="text-indigo-400 text-[10px] mt-0.5">
              {LAYERS[tooltip.node.layer].label} — {LAYERS[tooltip.node.layer].desc}
            </p>
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
            <p className="text-slate-600 mt-0.5 text-[10px]">クリックで詳細</p>
          </div>
        </div>
      )}

      {/* Top-left controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {/* Color mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#1e293b] text-xs">
          <button onClick={() => setColorMode('layer')}
            className={`px-2.5 py-1.5 transition-colors ${colorMode === 'layer' ? 'bg-indigo-600 text-white font-medium' : 'bg-[#0d0d18] text-slate-400 hover:text-slate-200'}`}>
            レイヤー色
          </button>
          <button onClick={() => setColorMode('risk')}
            className={`px-2.5 py-1.5 transition-colors border-l border-[#1e293b] ${colorMode === 'risk' ? 'bg-indigo-600 text-white font-medium' : 'bg-[#0d0d18] text-slate-400 hover:text-slate-200'}`}>
            リスク色
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-1">
          {[
            { count: graph.stats.criticalFiles, label: '緊急', cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
            { count: graph.stats.riskFiles,     label: '危険', cls: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
            { count: graph.stats.cautionFiles,  label: '注意', cls: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
          ].filter(x => x.count > 0).map(({ count, label, cls }) => (
            <div key={label} className={`px-2 py-0.5 rounded border text-[11px] font-medium ${cls}`}>
              {count} {label}
            </div>
          ))}
        </div>
      </div>

      {/* Layer legend (right side) */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={() => setShowLayers(v => !v)}
          className="w-full mb-1 text-[10px] text-slate-500 hover:text-slate-300 text-right pr-1"
        >
          {showLayers ? '▸ 非表示' : '▸ レイヤー表示'}
        </button>
        {showLayers && (
          <div className="bg-[#0d0d18]/90 border border-[#1e293b] rounded-lg p-3 text-xs min-w-[170px]">
            <p className="text-slate-500 font-medium mb-2">レイヤー構造</p>
            {(Object.entries(LAYERS) as [LayerKey, typeof LAYERS[LayerKey]][]).map(([key, { color, label, desc }]) => (
              <div key={key} className="flex items-start gap-2 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: color }} />
                <div>
                  <p className="text-slate-300 font-medium leading-none">{label}</p>
                  <p className="text-slate-600 text-[10px] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
            <div className="border-t border-[#1e293b] mt-2 pt-2 space-y-0.5">
              <p className="text-slate-600 text-[10px]">外周 → UI（表面）</p>
              <p className="text-slate-600 text-[10px]">中心 → コア（内核）</p>
              <p className="text-slate-600 text-[10px]">太い線 = 強い依存関係</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-slate-600 bg-[#02020a]/80 px-3 py-1 rounded-full border border-[#1e293b]">
        ドラッグで回転 · スクロールでズーム · クリックで詳細
      </div>

      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel=""
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={2}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(link) => {
          const l = link as GLink & { source: GNode; target: GNode };
          const src = typeof l.source === 'object' ? l.source : null;
          if (!src) return 0;
          return src.riskLevel === 'critical' ? 3 : src.riskLevel === 'risk' ? 1 : 0;
        }}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={(link) => {
          const l = link as GLink & { source: GNode };
          const src = typeof l.source === 'object' ? l.source : null;
          return src?.riskLevel === 'critical' ? '#dc2626' : '#f97316';
        }}
        backgroundColor="#02020a"
        onNodeClick={(node) => {
          const n = node as GNode;
          const fileNode = graph.nodes.find(fn => fn.id === n.id) ?? null;
          onSelectNode(selectedNode?.id === n.id ? null : fileNode);
          setTooltip(null);
        }}
        onNodeHover={(node, prevNode) => {
          if (node) {
            const n = node as GNode;
            // Use canvas center as fallback since we don't have mouse coords in 3D easily
            setTooltip({ x: 200, y: 80, node: n });
          } else {
            setTooltip(null);
          }
        }}
        onBackgroundClick={() => { onSelectNode(null); setTooltip(null); }}
        showNavInfo={false}
        enableNodeDrag={false}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
      />
    </div>
  );
}
