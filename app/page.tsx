// 이 파일은 Phase 1 동안에는 거의 닿지 않습니다.
// next.config.js의 rewrites가 / → /legacy/index.html 로 라우팅하기 때문.
// rewrite가 실패할 경우 폴백 화면.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">스윙 포트폴리오 트래커</h1>
        <p className="text-sub mb-6">사이트로 이동 중...</p>
        <a
          href="/legacy/index.html"
          className="inline-block px-5 py-2 rounded-lg bg-brand text-white font-medium"
        >
          앱 열기
        </a>
        <div className="mt-4 text-xs text-sub">
          베타: <a href="/v2" className="underline">v2 미리보기</a>
        </div>
      </div>
    </main>
  );
}
