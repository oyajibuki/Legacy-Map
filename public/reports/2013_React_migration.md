# 移行計画レポート — React（初期版）

## 1. 移行難易度評価

**工数見積もり: M（React 18への移行として）**

React v0.3.0から React 18への移行は、主にAPIの変更（createClass廃止、Hooks導入）への対応です。Reactの後方互換性へのコミットメントにより、段階的移行が可能です。

---

## 2. 移行戦略の選択肢

| 戦略 | 概要 | メリット | デメリット | 推奨度 |
|---|---|---|---|---|
| React 18移行 | 最新Reactへのアップグレード | Concurrent・Suspense対応 | 一部APIの廃止対応 | ⭐⭐⭐⭐⭐ |
| Next.js移行 | React + フルスタックFW | SSR・SSG・型安全 | 学習コスト | ⭐⭐⭐⭐⭐ |
| Remix移行 | Webプラットフォーム準拠 | クリーンな設計 | エコシステム小 | ⭐⭐⭐⭐ |
| Vue/Svelte移行 | 別フレームワーク | シンプルさ | 大規模コード変更 | ⭐⭐ |

---

## 3. フェーズ別移行ロードマップ

- **Phase 1（即時）**: React 16.8+のHooks対応（createClass廃止）
- **Phase 2（3ヶ月）**: TypeScript導入・型安全化
- **Phase 3（6ヶ月〜）**: React 18のConcurrent機能（Suspense・Transition）活用

---

## 4. 推奨移行先

| 現在 | 推奨 | 理由 |
|---|---|---|
| createClass | React.FC + Hooks | 現代的・簡潔 |
| PropTypes | TypeScript | 型安全・IDE補完 |
| componentDidMount | useEffect | 関数コンポーネント標準 |
| Flux/Redux | Zustand / Jotai | 軽量・シンプル |

---

## 5. 移行コスト概算

| 作業 | 難易度 | 人月 | 優先度 |
|---|---|---|---|
| React 18移行 | 中 | 2〜4 | 最高 |
| TypeScript導入 | 中 | 2〜4 | 高 |
| テスト整備 | 中 | 2〜4 | 高 |
| Concurrent機能 | 高 | 2〜4 | 中 |