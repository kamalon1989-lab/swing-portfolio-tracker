/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // / 는 Next.js 새 랜딩(app/page.tsx)이 서빙.
  // /app 는 legacy 앱으로 rewrite (URL은 /app 유지). 기존 직접 URL들도 /app과 동일 동작.
  // Phase 4에서 legacy 제거 시 이 rewrites를 비우면 됨.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/app', destination: '/legacy/index.html' },
        { source: '/app/:path*', destination: '/legacy/index.html' },
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
