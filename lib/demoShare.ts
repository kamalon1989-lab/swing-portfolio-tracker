// 데모 둘러보기용 share 페이로드.
// /open 공유 화면이 받는 base64-url 인코딩 형식과 동일.
// 새 데모 데이터를 추가하고 싶으면 demoPayload만 바꾸면 됨.

const demoPayload = {
  date: '2026-04-28',
  pnl: 14.32,
  rows: [
    { t: 'NVDA',  n: 'NVIDIA Corp',           pnl: 32.18, w: 24.5 },
    { t: 'AAPL',  n: 'Apple Inc.',            pnl: 12.40, w: 18.2 },
    { t: 'MSFT',  n: 'Microsoft Corp',        pnl:  8.95, w: 15.7 },
    { t: 'GOOGL', n: 'Alphabet Inc.',         pnl: 19.62, w: 12.4 },
    { t: 'TSLA',  n: 'Tesla, Inc.',           pnl: -4.21, w:  9.8 },
    { t: 'AMD',   n: 'Advanced Micro Devices', pnl: 22.85, w:  8.6 },
    { t: 'PLTR',  n: 'Palantir Technologies', pnl: 41.30, w:  6.3 },
    { t: 'META',  n: 'Meta Platforms',        pnl:  6.78, w:  4.5 },
  ],
};

function toUrlSafeBase64(input: string): string {
  // Node 환경(빌드시) — Buffer 사용
  const b64 = Buffer.from(unescape(encodeURIComponent(input)), 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export const demoShareHash = toUrlSafeBase64(JSON.stringify(demoPayload));
export const demoShareUrl = `/open#share=${demoShareHash}`;
