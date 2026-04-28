/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // / 는 새 랜딩(app/page.tsx)이 서빙.
  // /open 는 legacy 앱으로 rewrite (URL 깔끔). 기존 직접 URL들도 동일 동작.
  // 주의: /app 이라는 경로는 Next.js App Router 디렉토리명과 충돌해 rewrite가 무시됨 → /open 사용.
  // Phase 4에서 legacy 제거 시 이 rewrites를 비우면 됨.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/open', destination: '/legacy/index.html' },
        { source: '/index.html', destination: '/legacy/index.html' },
        { source: '/ai_studio_code2.1.html', destination: '/legacy/index.html' },
        { source: '/ai_studio_code1.5.html', destination: '/legacy/index.html' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
