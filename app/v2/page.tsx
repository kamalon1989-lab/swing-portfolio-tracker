'use client';
import { useEffect } from 'react';

// /v2 는 이제 /open 으로 리다이렉트. 직접 URL을 북마크한 사람도 앱에 도달하도록.
export default function V2Redirect() {
  useEffect(() => {
    window.location.replace('/open');
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-2xl font-bold">마이그레이션 완료 ✅</h1>
        <p className="text-sub text-sm">앱으로 이동 중…</p>

        <ul className="text-sm space-y-2 pt-2">
          <li>✅ Phase 0 — HTML 핫픽스 (매수날짜, PDF, 개별 import·export, TradingView)</li>
          <li>✅ Phase 1 — Next.js 스캐폴딩 + 레거시 HTML 제거</li>
          <li>✅ Phase 2 — 랜딩 페이지 + 데모 모드 + /open URL</li>
          <li>✅ Phase 3 — Finnhub API 서버 프록시 (공용 키, 토큰 검증, edge 캐싱)</li>
          <li>✅ Phase 4 — 도메인 컷오버 (루트 정리, /v2 승격)</li>
        </ul>

        <p className="text-sm text-sub pt-2">
          자동으로 이동하지 않으면{' '}
          <a href="/open" className="text-brand underline">여기를 클릭</a>하세요.
        </p>
      </div>
    </main>
  );
}
