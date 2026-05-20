'use client';

import { useState, useRef, useEffect } from 'react';
import { DependencyGraph, UploadedFile } from '@/lib/types';
import { Bot, ChevronUp, ChevronDown, Loader2, Copy, Check, Key, X } from 'lucide-react';

interface Props {
  graph: DependencyGraph;
  uploadedFiles: UploadedFile[];
  demoId?: string; // when set, try to load pre-computed report from /public/reports/
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^```[\w]*\n([\s\S]*?)```$/gm, '<pre><code>$1</code></pre>')
    .replace(/^\| (.+) \|$/gm, (row) => {
      const cells = row.split('|').filter(c => c.trim() !== '');
      if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
      const tag = cells[0]?.trim().startsWith('-') ? 'td' : 'td';
      return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)/g, (match) => `<table>${match}</table>`)
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hbuptl])(.+)$/gm, (line) => line.trim() ? `<p>${line}</p>` : '')
    .replace(/<p><\/p>/g, '');
}

export default function ReportPanel({ graph, uploadedFiles, demoId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'operation' | 'migration'>('operation');
  const [reports, setReports] = useState<{ operation: string; migration: string }>({ operation: '', migration: '' });
  const [loading, setLoading] = useState<{ operation: boolean; migration: boolean }>({ operation: false, migration: false });
  const [preComputed, setPreComputed] = useState<{ operation: boolean; migration: boolean }>({ operation: false, migration: false });
  const [apiKey, setApiKey] = useState('');
  const [showApiInput, setShowApiInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('vibemap_gemini_api_key');
    if (saved) setApiKey(saved);
  }, []);

  // Auto-load pre-computed reports when demoId changes
  useEffect(() => {
    if (!demoId) {
      setPreComputed({ operation: false, migration: false });
      setReports({ operation: '', migration: '' });
      return;
    }
    setReports({ operation: '', migration: '' });
    setPreComputed({ operation: false, migration: false });

    const load = async (mode: 'operation' | 'migration') => {
      try {
        const res = await fetch(`/reports/${demoId}_${mode}.md`);
        if (!res.ok) return;
        const text = await res.text();
        setReports(prev => ({ ...prev, [mode]: text }));
        setPreComputed(prev => ({ ...prev, [mode]: true }));
      } catch {
        // no pre-computed report — that's OK
      }
    };
    load('operation');
    load('migration');
  }, [demoId]);

  function saveApiKey(key: string) {
    setApiKey(key);
    localStorage.setItem('vibemap_gemini_api_key', key);
    setShowApiInput(false);
  }

  async function runAnalysis(mode: 'operation' | 'migration') {
    if (!apiKey) {
      setShowApiInput(true);
      return;
    }

    setLoading(prev => ({ ...prev, [mode]: true }));
    setReports(prev => ({ ...prev, [mode]: '' }));
    setIsOpen(true);
    setActiveTab(mode);

    // Build slim payload — don't send full graph object
    const topRiskyNodes = graph.nodes
      .filter(n => n.riskLevel === 'critical' || n.riskLevel === 'risk')
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10)
      .map(n => ({
        path: n.path,
        language: n.language,
        lines: n.lines,
        riskScore: n.riskScore,
        riskLevel: n.riskLevel,
        riskFactors: n.riskFactors,
        eolPackages: n.eolPackages,
      }));

    const topFiles = topRiskyNodes.slice(0, 3).map(node => {
      const uploaded = uploadedFiles.find(f => f.path === node.path);
      return { path: node.path, content: uploaded?.content?.slice(0, 1500) || '' };
    });

    try {
      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey,
        },
        body: JSON.stringify({
          stats: graph.stats,
          topRiskyNodes,
          topFiles,
          languages: graph.stats.languages,
          mode,
        }),
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = (await res.text().catch(() => '')) || errMsg;
        }
        setReports(prev => ({ ...prev, [mode]: `エラー: ${errMsg}` }));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setReports(prev => ({ ...prev, [mode]: prev[mode] + chunk }));
        reportRef.current?.scrollTo({ top: reportRef.current.scrollHeight });
      }
    } catch (err) {
      setReports(prev => ({ ...prev, [mode]: `通信エラーが発生しました: ${err}` }));
    } finally {
      setLoading(prev => ({ ...prev, [mode]: false }));
    }
  }

  async function copyReport() {
    await navigator.clipboard.writeText(reports[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const currentReport = reports[activeTab];
  const isLoading = loading[activeTab];

  return (
    <div className={`flex flex-col transition-all duration-300 ${isOpen ? 'h-[45%]' : 'h-auto'}`}>
      {/* API Key Modal */}
      {showApiInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-[#1e293b] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-200">Gemini API Key</h3>
              </div>
              <button onClick={() => setShowApiInput(false)}>
                <X className="w-4 h-4 text-slate-500 hover:text-slate-300" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              AI分析にはGoogle GeminiのAPIキーが必要です。<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>で無料取得できます。ブラウザのlocalStorageに保存されます。
            </p>
            <input
              type="password"
              placeholder="AIza..."
              className="w-full bg-[#0a0a0f] border border-[#2d2d3e] rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 mb-4"
              defaultValue={apiKey}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveApiKey((e.target as HTMLInputElement).value);
              }}
              id="api-key-input"
            />
            <button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              onClick={() => {
                const input = document.getElementById('api-key-input') as HTMLInputElement;
                saveApiKey(input.value);
              }}
            >
              保存して続行
            </button>
          </div>
        </div>
      )}

      {/* Toggle bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e293b] bg-[#111118]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-slate-300">AI分析レポート</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => { setActiveTab('operation'); setIsOpen(true); }}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${activeTab === 'operation' && isOpen
                ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]'}`}
            >
              運用戦略
            </button>
            <button
              onClick={() => { setActiveTab('migration'); setIsOpen(true); }}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${activeTab === 'migration' && isOpen
                ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]'}`}
            >
              移行計画
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Demo mode: show pre-computed badge or "not generated yet" hint */}
          {demoId ? (
            preComputed[activeTab] ? (
              <span className="flex items-center gap-1 text-[10px] text-green-400 border border-green-500/30 bg-green-500/8 px-2 py-0.5 rounded-md">
                ✓ 事前生成済み
              </span>
            ) : (
              <span className="text-[10px] text-slate-600">
                (APIキーで再生成可)
              </span>
            )
          ) : (
            /* Upload mode: show API key button + generate button */
            <>
              <button
                onClick={() => setShowApiInput(true)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors ${
                  apiKey
                    ? 'text-slate-400 hover:text-slate-200 border-slate-700/50 bg-slate-700/10 hover:bg-slate-700/30'
                    : 'text-amber-400 hover:text-amber-300 bg-amber-400/10 border-amber-400/20'
                }`}
                title={apiKey ? 'APIキーを変更' : 'APIキーを設定'}
              >
                <Key className="w-3 h-3" />
                {apiKey ? 'APIキー変更' : 'APIキー設定'}
              </button>
              <button
                onClick={() => runAnalysis(activeTab)}
                disabled={isLoading}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {isLoading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />生成中...</>
                ) : (
                  <><Bot className="w-3 h-3" />{activeTab === 'operation' ? '運用分析' : '移行分析'}</>
                )}
              </button>
            </>
          )}
          {currentReport && (
            <button onClick={copyReport} className="p-1.5 hover:bg-[#1e1e2e] rounded-md text-slate-400 hover:text-slate-200 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => setIsOpen(v => !v)} className="p-1.5 hover:bg-[#1e1e2e] rounded-md text-slate-400 hover:text-slate-200 transition-colors">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Report content */}
      {isOpen && (
        <div ref={reportRef} className="flex-1 overflow-y-auto bg-[#0a0a0f] border-t border-[#1e293b] px-6 py-4">
          {isLoading && !currentReport && (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span className="text-sm">Gemini が分析しています...</span>
            </div>
          )}
          {currentReport && (
            <div
              className="report-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(currentReport) }}
            />
          )}
          {!isLoading && !currentReport && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <Bot className="w-10 h-10 text-slate-700" />
              {demoId ? (
                <>
                  <p className="text-sm text-slate-500">このデモのAIレポートはまだ生成されていません</p>
                  <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                    開発者が <code className="text-indigo-400">/api/generate-reports?key=...</code> を実行するとデモ全件のレポートが事前生成されます
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    「{activeTab === 'operation' ? '運用分析' : '移行分析'}」ボタンでAIレポートを生成します
                  </p>
                  <p className="text-xs text-slate-600">
                    {graph.stats.totalFiles}ファイル・{graph.stats.avgRiskScore}点の平均リスクスコアを分析
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
