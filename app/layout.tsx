import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'LegacyMap — レガシーコード可視化ツール',
  description: 'コードの依存関係・リスクを可視化し、運用・移行戦略をAIが分析',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
        <Script id="access-counter" strategy="afterInteractive">{`
          fetch("https://script.google.com/macros/s/AKfycbznxYkj5ixnK_pHkGR8LUYhEYdvSYpaiF3x4LaZy964wlu068oak1X1uuIiyqCEtGWF/exec?page=legacymap")
            .catch(() => {});
        `}</Script>
      </body>
    </html>
  );
}
