import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '스윙 포트폴리오 트래커',
  description: '미국 스윙 포트폴리오 추적 · 실시간 시세 · 매매 일지',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}
