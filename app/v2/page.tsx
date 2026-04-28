// Phase 2에서 본격 채울 새 대시보드 자리.
// 지금은 마이그레이션 진행 상황 표시용 플레이스홀더.
export default function V2Preview() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <a href="/legacy/index.html" className="text-sm text-sub hover:underline">
          ← 기존 앱으로 돌아가기
        </a>
      </div>
      <h1 className="text-3xl font-bold mb-3">v2 미리보기</h1>
      <p className="text-sub mb-8">Next.js로 이식 중인 새 버전입니다. 단계별로 기능이 추가됩니다.</p>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold">진행 상황</h2>
        <ul className="text-sm space-y-2">
          <li>✅ Phase 0 — HTML 핫픽스 (매수날짜 동기화, PDF 내보내기, 보유/관심 개별 import·export, TradingView 연동)</li>
          <li>🔧 Phase 1 — Next.js 스캐폴딩 + legacy 보존 <span className="text-brand">(현재 단계)</span></li>
          <li>⏳ Phase 2 — 랜딩 페이지 + UI 세련화 + 데모 모드</li>
          <li>⏳ Phase 3 — Finnhub API 서버 프록시 (공용 키)</li>
          <li>⏳ Phase 4 — 도메인 컷오버</li>
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold">데이터 호환성</h2>
        <p className="text-sm text-sub leading-relaxed">
          새 버전은 기존과 완전히 동일한 Firebase 경로(<code>users/&#123;uid&#125;/ptf</code>)와
          키 이름(h, w, j, hi, c, k)을 사용합니다.
          기존 앱과 새 앱이 같은 데이터를 읽고 쓰므로, 어느 쪽을 사용해도 데이터가 보존됩니다.
        </p>
      </div>
    </main>
  );
}
