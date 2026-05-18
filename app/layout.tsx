import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LegacyMap — レガシーコード可視化ツール',
  description: 'コードの依存関係・リスクを可視化し、運用・移行戦略をAIが分析',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
