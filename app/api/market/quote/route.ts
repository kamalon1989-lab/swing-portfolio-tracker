import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'swing-dh';

async function verify(req: NextRequest): Promise<{ uid: string } | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return typeof payload.sub === 'string' ? { uid: payload.sub } : null;
  } catch {
    return null;
  }
}

function cleanSymbols(value: string | null) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z0-9.-]{1,16}$/.test(item))
    .slice(0, 60);
}

export async function GET(req: NextRequest) {
  const user = await verify(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const symbols = cleanSymbols(req.nextUrl.searchParams.get('symbols'));
  if (!symbols.length) return Response.json({ quotes: [] });

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&fields=symbol,regularMarketPrice,regularMarketPreviousClose,regularMarketChangePercent,preMarketPrice,preMarketChangePercent,postMarketPrice,postMarketChangePercent,marketState`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 20 },
    });
    if (!upstream.ok) {
      return Response.json({ error: 'quote upstream failed' }, { status: upstream.status });
    }
    const data = await upstream.json();
    return Response.json(
      { quotes: data?.quoteResponse?.result ?? [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
          'CDN-Cache-Control': 'public, s-maxage=20',
        },
      }
    );
  } catch {
    return Response.json({ error: 'quote upstream timeout' }, { status: 504 });
  }
}
