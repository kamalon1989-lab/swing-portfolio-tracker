/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // / → 랜딩 페이지 (app/page.tsx)
  // /open → legacy HTML 앱 (Phase 4 이후에도 유지)
  // /v2 → /open 리다이렉트 (app/v2/page.tsx에서 처리)
  // 주의: /app 경로는 Next.js App Router 디렉토리와 충돌 → /open 사용.
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
