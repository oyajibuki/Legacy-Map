/**
 * Usage:  node scripts/generate-reports.mjs YOUR_GEMINI_API_KEY
 *   or:   GEMINI_KEY=... node scripts/generate-reports.mjs
 *
 * Reads public/demos/*.json, calls Gemini 2.0-flash for each demo
 * in both 'operation' and 'migration' modes, and writes markdown
 * files to public/reports/.
 *
 * After running, commit the generated files so they ship as static assets.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const apiKey = process.argv[2] || process.env.GEMINI_KEY;
if (!apiKey) {
  console.error('❌  Gemini API key required.\n   Usage: node scripts/generate-reports.mjs YOUR_KEY');
  process.exit(1);
}

const SYSTEM = `You are a senior software architect specializing in legacy code analysis, technical debt assessment, and modernization strategies.
You analyze codebases with a pragmatic, risk-first mindset.
Output in Japanese, using Markdown with tables where helpful.`;

function operationPrompt(stats, nodes, langs) {
  return `以下のコードベース分析結果を基に、**現状のまま安全に運用し続けるための戦略**をレポートしてください。

## 分析統計
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`

## リスクの高いファイルTop10
\`\`\`json
${JSON.stringify(nodes, null, 2)}
\`\`\`

## レポート構成（必須）

### 1. エグゼクティブサマリー
- 現状のリスク評価（A〜Eランク）
- 今すぐ対応すべき項目（3つ以内）

### 2. そのまま使えるもの ✅
- 変更不要なファイル・モジュールの特徴と安全に運用できる理由

### 3. 要注意エリア ⚠️
- 優先度付きリスクリスト（表形式: ファイル | リスク種別 | 影響度 | 対策）

### 4. 即時対応推奨項目 🚨
- セキュリティリスク（CVE等）・EOL依存関係の具体的な回避策

### 5. 運用ルール（コード変更なし前提）
- モニタリング・バックアップ戦略・ドキュメント化すべき暗黙知

検出言語: ${langs.join(', ')}`;
}

function migrationPrompt(stats, nodes, langs) {
  return `以下のコードベース分析結果を基に、**将来のモダンなシステムへの移行計画**をレポートしてください。

## 分析統計
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`

## リスクの高いファイルTop10
\`\`\`json
${JSON.stringify(nodes, null, 2)}
\`\`\`

## レポート構成（必須）

### 1. 移行難易度評価
- 全体的な移行工数見積もり（S/M/L/XL）・最大のリスク・ボトルネック

### 2. 移行戦略の選択肢（表形式: 戦略 | 概要 | メリット | デメリット | 推奨度）

### 3. フェーズ別移行ロードマップ
- Phase 1（即時）: EOL依存関係の置き換え
- Phase 2（3ヶ月）: 高リスクファイルのリファクタリング
- Phase 3（6ヶ月〜）: アーキテクチャ刷新

### 4. 言語・フレームワーク移行先の提案
- 検出言語: ${langs.join(', ')}
- 各言語の推奨移行先と理由

### 5. 移行時の注意点・移行コスト概算（人月・難易度・優先順位の表）`;
}

async function generate(genAI, prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(`${SYSTEM}\n\n${prompt}`);
  return result.response.text();
}

// ── Main ──────────────────────────────────────────────────────
const demosDir   = path.join(ROOT, 'public', 'demos');
const reportsDir = path.join(ROOT, 'public', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const force = process.argv.includes('--force');
const files = fs.readdirSync(demosDir).filter(f => f.endsWith('.json')).sort();
const genAI = new GoogleGenerativeAI(apiKey);

console.log(`📊  Found ${files.length} demo files. Generating reports...\n`);

let ok = 0, skip = 0, errors = 0;
for (const file of files) {
  const id     = file.replace('.json', '');
  const opPath = path.join(reportsDir, `${id}_operation.md`);
  const mgPath = path.join(reportsDir, `${id}_migration.md`);

  if (!force && fs.existsSync(opPath) && fs.existsSync(mgPath)) {
    console.log(`  ⏭  ${id} — skipped (already exists, use --force to regenerate)`);
    skip++; continue;
  }

  const graph   = JSON.parse(fs.readFileSync(path.join(demosDir, file), 'utf-8'));
  const langs   = graph.stats?.languages ?? [];
  const topNodes = graph.nodes
    .filter(n => n.riskLevel !== 'safe')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10)
    .map(n => ({ path: n.path, language: n.language, lines: n.lines,
                 riskScore: n.riskScore, riskLevel: n.riskLevel,
                 riskFactors: n.riskFactors, eolPackages: n.eolPackages }));

  try {
    process.stdout.write(`  🤖  ${id} — generating...`);
    const t0 = Date.now();
    const [op, mg] = await Promise.all([
      generate(genAI, operationPrompt(graph.stats, topNodes, langs)),
      generate(genAI, migrationPrompt(graph.stats, topNodes, langs)),
    ]);
    fs.writeFileSync(opPath, op, 'utf-8');
    fs.writeFileSync(mgPath, mg, 'utf-8');
    console.log(` ✅  (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    ok++;
  } catch (err) {
    console.log(` ❌  ${err.message}`);
    errors++;
  }

  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n✨  Done: ${ok} generated, ${skip} skipped, ${errors} errors`);
console.log(`📁  Reports saved to: public/reports/`);
if (ok > 0) console.log(`💡  Commit the .md files to ship them as static assets.`);
