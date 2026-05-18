import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DependencyGraph } from '@/lib/types';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-anthropic-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key required' }, { status: 401 });
  }

  const client = new Anthropic({ apiKey });

  const body = await req.json();
  const graph: DependencyGraph = body.graph;
  const topFiles: { path: string; content: string }[] = body.topFiles || [];
  const mode: 'operation' | 'migration' = body.mode || 'operation';

  const statsStr = JSON.stringify(graph.stats, null, 2);
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

  const fileSnippets = topFiles
    .slice(0, 3)
    .map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 1500)}\n\`\`\``)
    .join('\n\n');

  const systemPrompt = `You are a senior software architect specializing in legacy code analysis, technical debt assessment, and modernization strategies.
You analyze codebases with a pragmatic, risk-first mindset.
Output in Japanese, using Markdown with tables where helpful.`;

  const operationPrompt = `以下のコードベース分析結果を基に、**現状のまま安全に運用し続けるための戦略**をレポートしてください。

## 分析統計
\`\`\`json
${statsStr}
\`\`\`

## リスクの高いファイルTop10
\`\`\`json
${JSON.stringify(topRiskyNodes, null, 2)}
\`\`\`

${fileSnippets ? `## コードサンプル\n${fileSnippets}` : ''}

## レポート構成（必須）

### 1. エグゼクティブサマリー
- 現状のリスク評価（A〜Eランク）
- 今すぐ対応すべき項目（3つ以内）

### 2. そのまま使えるもの ✅
- 変更不要なファイル・モジュールの特徴
- 安全に運用できる理由

### 3. 要注意エリア ⚠️
- 優先度付きリスクリスト（表形式）
- 各リスクの影響度・発生確率・対策

### 4. 即時対応推奨項目 🚨
- セキュリティリスク（CVE等）
- EOL依存関係の具体的な回避策

### 5. 運用ルール（コード変更なし前提）
- モニタリング推奨事項
- バックアップ戦略
- ドキュメント化すべき暗黙知`;

  const migrationPrompt = `以下のコードベース分析結果を基に、**将来のモダンなシステムへの移行計画**をレポートしてください。

## 分析統計
\`\`\`json
${statsStr}
\`\`\`

## リスクの高いファイルTop10
\`\`\`json
${JSON.stringify(topRiskyNodes, null, 2)}
\`\`\`

${fileSnippets ? `## コードサンプル\n${fileSnippets}` : ''}

## レポート構成（必須）

### 1. 移行難易度評価
- 全体的な移行工数見積もり（S/M/L/XL）
- 最大のリスク・ボトルネック

### 2. 移行戦略の選択肢
| 戦略 | 概要 | メリット | デメリット | 推奨度 |
|-----|------|---------|---------|-------|
（3パターン以上提示）

### 3. フェーズ別移行ロードマップ
- Phase 1（即時）: EOL依存関係の置き換え
- Phase 2（3ヶ月）: 高リスクファイルのリファクタリング
- Phase 3（6ヶ月〜）: アーキテクチャ刷新

### 4. 言語・フレームワーク移行先の提案
- 検出言語: ${graph.stats.languages.join(', ')}
- 各言語の推奨移行先と理由

### 5. 移行時の注意点
- テスト戦略（現状テストカバレッジを考慮）
- データ移行リスク
- ダウンタイム最小化策

### 6. 移行コスト概算
（人月、難易度、優先順位の表）`;

  const prompt = mode === 'migration' ? migrationPrompt : operationPrompt;

  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
