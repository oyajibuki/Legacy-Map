# 移行計画レポート — Svelte

## 1. 移行難易度評価

**工数見積もり: S〜M（現代的設計のため移行コスト低）**

Svelteは2019年の設計がすでに現代的です。「移行」より「進化」（Svelte 4→5のRunes、SvelteKit活用）が適切な戦略です。

---

## 2. 移行戦略の選択肢

| 戦略 | 概要 | メリット | デメリット | 推奨度 |
|---|---|---|---|---|
| Svelte 5 (Runes) | 新しいリアクティビティ | 最高の性能・DX | $state/$derived等の新記法 | ⭐⭐⭐⭐⭐ |
| SvelteKit移行 | フルスタック化 | SSR・SSG・APIルート | 追加学習 | ⭐⭐⭐⭐⭐ |
| SolidJS移行 | 類似思想の別FW | Runesに近い設計 | エコシステム小 | ⭐⭐ |
| 現状維持 (Svelte 4) | セキュリティパッチ対応のみ | 安定 | 新機能なし | ⭐⭐⭐ |

---

## 3. フェーズ別移行ロードマップ

- **Phase 1（即時）**: SvelteKit 2.0の採用でフルスタック機能追加
- **Phase 2（3ヶ月）**: Svelte 5への移行。$state/$derived/$effectの導入
- **Phase 3（6ヶ月〜）**: Runesに基づく全コンポーネントのリファクタリング

---

## 4. 推奨移行先

| 現在 | 推奨 | 理由 |
|---|---|---|
| Svelte 4 (reactive) | Svelte 5 Runes ($state) | より明示的なリアクティビティ |
| writable store | $state / $derived | Runes記法で統一 |
| onMount | $effect | Runesとの統一性 |

---

## 5. 移行コスト概算

| 作業 | 難易度 | 人月 | 優先度 |
|---|---|---|---|
| SvelteKit導入 | 低 | 0.5〜1 | 高 |
| Svelte 5移行 | 低〜中 | 1〜3 | 中 |
| Runesリファクタ | 中 | 2〜4 | 中 |