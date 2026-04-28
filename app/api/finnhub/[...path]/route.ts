import { NextRequest } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Firebase ID 토큰 검증용 공개키 (Google이 발행). admin SDK 안 써도 됨.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'swing-dh';

// 허용된 Finnhub 경로만 프록시 (남용 방지). 새 엔드포인트 필요하면 여기 추가.
const ALLOWED = new Set<string>([
  'quote',
  'company-news',
  'calendar/earnings',
]);

// CDN 캐시 TTL (Vercel edge가 자동으로 인식). 초 단위.
const TTL: Record<string, number> = {
  'quote': 30,            // 시세는 짧게
  'company-news': 300,    // 뉴스 5분
  'calendar/earnings': 1800, // 어닝 캘린더 30분
};

async function verify(req: NextRequest): Promise<{ uid: string } | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (typeof payload.sub !== 'string') return null;
    return { uid: payload.sub };
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const subpath = (params.path || []).join('/');
  if (!ALLOWED.has(subpath)) {
    return new Response('Not allowed', { status: 404 });
  }

  const user = await verify(req);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'FINNHUB_API_KEY not set in Vercel environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 클라가 보낸 쿼리스트링 그대로 전달 + token 강제 교체
  const search = new URLSearchParams(req.nextUrl.search);
  search.delete('token');
  search.set('token', apiKey);

  const upstreamUrl = `https://finnhub.io/api/v1/${subpath}?${search.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await upstream.text();
  const ttl = TTL[subpath] ?? 60;

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
      // 클라이언트는 짧게만 캐시 (서버 캐시가 주역할)
      'CDN-Cache-Control': `public, s-maxage=${ttl}`,
    },
  });
}
