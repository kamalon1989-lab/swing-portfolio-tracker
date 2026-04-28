/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 1: 루트(/)와 기존 진입점들을 legacy HTML로 라우팅.
  // beforeFiles를 써야 app/page.tsx나 public/index.html보다 먼저 적용됨.
  // Phase 4에서 새 랜딩으로 승격시킬 때 이 rewrites 블록을 제거하면 됨.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/legacy/index.html' },
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
