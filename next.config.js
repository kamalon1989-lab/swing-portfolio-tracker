/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 1: 루트(/)와 기존 진입점(/ai_studio_code2.1.html)을 legacy HTML로 라우팅.
  // 친구들이 기존에 사용하던 URL이 그대로 동작하도록 보장.
  // Phase 4에서 새 랜딩으로 승격시킬 때 이 rewrites 블록을 제거하면 됨.
  async rewrites() {
    return [
      { source: '/', destination: '/legacy/index.html' },
      { source: '/index.html', destination: '/legacy/index.html' },
      { source: '/ai_studio_code2.1.html', destination: '/legacy/index.html' },
      { source: '/ai_studio_code1.5.html', destination: '/legacy/index.html' },
    ];
  },
};

module.exports = nextConfig;
