/**
 * One-time endpoint: GET /api/generate-reports?key=GEMINI_KEY
 * Reads every demo JSON from /public/demos/, calls Gemini for both
 * operation & migration modes, writes markdown to /public/reports/.
 * Run once in development; commit the resulting .md files.
 */
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; // 5 min

const SYSTEM_PROMPT = `You are a senior software architect specializing in legacy code analysis, technical debt assessment, and modernization strategies.
You analyze codebases with a pragmatic, risk-first mindset.
Output in Japanese, using Markdown with tables where helpful.`;

function buildOperationPrompt(statsStr: string, nodesStr: string, langs: string[]): string {
  return `以下のコードベース分析結果を基に、**現状のまま安全に運用し続けるための戦略**をレポートしてください。

## 分析統計
\`\`\`json
${statsStr}
\`\`\`

## リスクの高いファイルTop10
\`\`\`json
${nodesStr}
\`\`\`

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
- ドキュメント化すべき暗黙知

検出言語: ${langs.join(', ')}`;
}

function buildMigrationPrompt(statsStr: string, nodesStr: string, langs: string[]): string {
  return `以下のコードベース分析結果を基に、**将来のモダンなシステムへの移行計画**をレポートしてください。

## 分析統計
\`\`\`json
${statsStr}
\`\`\`

## リスクの高いファイルTop10
\`\`\`json
${nodesStr}
\`\`\`

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
- 検出言語: ${langs.join(', ')}
- 各言語の推奨移行先と理由

### 5. 移行時の注意点
- テスト戦略（現状テストカバレッジを考慮）
- データ移行リスク
- ダウンタイム最小化策

### 6. 移行コスト概算
（人月、難易度、優先順位の表）`;
}

async function generateReport(
  genAI: GoogleGenerativeAI,
  prompt: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${prompt}`);
  return result.response.text();
}

export async function GET(req: NextRequest) {
  // Accept key via query param or header
  const apiKey =
    req.nextUrl.searchParams.get('key') ||
    req.headers.get('x-gemini-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key required. Pass as ?key=... or x-gemini-api-key header' },
      { status: 401 },
    );
  }

  const demosDir   = path.join(process.cwd(), 'public', 'demos');
  const reportsDir = path.join(process.cwd(), 'public', 'reports');

  if (!fs.existsSync(demosDir)) {
    return NextResponse.json({ error: 'public/demos/ not found. Run /api/generate-demos first.' }, { status: 404 });
  }
  fs.mkdirSync(reportsDir, { recursive: true });

  const demoFiles = fs.readdirSync(demosDir).filter(f => f.endsWith('.json'));
  const genAI = new GoogleGenerativeAI(apiKey);

  const results: Record<string, { operation: string; migration: string; ms: number; error?: string }> = {};

  for (const file of demoFiles) {
    const id = file.replace('.json', '');
    const t0 = Date.now();

    // Skip if both already exist (allow re-run with force=1)
    const opPath  = path.join(reportsDir, `${id}_operation.md`);
    const migPath = path.join(reportsDir, `${id}_migration.md`);
    const force   = req.nextUrl.searchParams.get('force') === '1';
    if (!force && fs.existsSync(opPath) && fs.existsSync(migPath)) {
      results[id] = { operation: 'skipped', migration: 'skipped', ms: 0 };
      continue;
    }

    try {
      const graphRaw  = fs.readFileSync(path.join(demosDir, file), 'utf-8');
      const graph     = JSON.parse(graphRaw);
      const statsStr  = JSON.stringify(graph.stats, null, 2);
      const langs: string[] = graph.stats?.languages ?? [];
      const topNodes  = (graph.nodes as {riskLevel:string;riskScore:number;path:string;language:string;lines:number;riskFactors:unknown[];eolPackages:unknown[]}[])
        .filter(n => n.riskLevel !== 'safe')
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10)
        .map(n => ({
          path: n.path, language: n.language, lines: n.lines,
          riskScore: n.riskScore, riskLevel: n.riskLevel,
          riskFactors: n.riskFactors, eolPackages: n.eolPackages,
        }));
      const nodesStr = JSON.stringify(topNodes, null, 2);

      const [opReport, migReport] = await Promise.all([
        generateReport(genAI, buildOperationPrompt(statsStr, nodesStr, langs)),
        generateReport(genAI, buildMigrationPrompt(statsStr, nodesStr, langs)),
      ]);

      fs.writeFileSync(opPath,  opReport,  'utf-8');
      fs.writeFileSync(migPath, migReport, 'utf-8');

      results[id] = { operation: 'ok', migration: 'ok', ms: Date.now() - t0 };
      console.log(`[generate-reports] ${id} done (${Date.now() - t0}ms)`);
    } catch (err) {
      console.error(`[generate-reports] ${id} failed:`, err);
      results[id] = {
        operation: 'error', migration: 'error',
        ms: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const total  = Object.keys(results).length;
  const ok     = Object.values(results).filter(r => r.operation === 'ok').length;
  const skip   = Object.values(results).filter(r => r.operation === 'skipped').length;
  const errors = Object.values(results).filter(r => r.operation === 'error').length;

  return NextResponse.json({ done: true, total, ok, skip, errors, results });
}
