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
    .filter((item) => /^[0-9A-Z]{6}$/.test(item))
    .slice(0, 60);
}

function textContent(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  if (!match) return null;
  return match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function numberFromText(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function signedPercent(html: string) {
  const raw = textContent(html, /<strong[^>]+id=["']_rate["'][^>]*>([\s\S]*?)<\/strong>/i);
  const value = numberFromText(raw);
  if (value === null) return null;
  const around = html.slice(Math.max(0, html.search(/id=["']_rate["']/i) - 300), html.search(/id=["']_rate["']/i) + 500);
  const sign = /no_down|rate_down|하락|minus/i.test(around) ? -1 : 1;
  return sign * Math.abs(value);
}

async function fetchNaverQuote(symbol: string) {
  const url = `https://finance.naver.com/item/sise.naver?code=${encodeURIComponent(symbol)}`;
  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: 'https://finance.naver.com/',
    },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 20 },
  });
  if (!upstream.ok) return null;
  const buffer = await upstream.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buffer);
  const price = numberFromText(textContent(html, /<strong[^>]+id=["']_nowVal["'][^>]*>([\s\S]*?)<\/strong>/i));
  if (!price) return null;
  const changePercent = signedPercent(html);
  const prevClose = changePercent !== null && changePercent !== -100
    ? price / (1 + changePercent / 100)
    : price;
  const volume = numberFromText(textContent(html, /<span[^>]+id=["']_quant["'][^>]*>([\s\S]*?)<\/span>/i));
  const name = textContent(html, /<title>\s*([^:<]+?)\s*[:<]/i);
  return {
    symbol,
    name: name ?? '',
    price,
    prevClose,
    changePercent: changePercent ?? 0,
    volume: volume ?? undefined,
    currency: 'KRW',
    source: 'naver',
  };
}

export async function GET(req: NextRequest) {
  const user = await verify(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const symbols = cleanSymbols(req.nextUrl.searchParams.get('symbols'));
  if (!symbols.length) return Response.json({ quotes: [] });

  try {
    const quotes = await Promise.all(symbols.map((symbol) => fetchNaverQuote(symbol).catch(() => null)));
    return Response.json(
      { quotes: quotes.filter(Boolean) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
          'CDN-Cache-Control': 'public, s-maxage=20',
        },
      }
    );
  } catch {
    return Response.json({ error: 'kr quote upstream timeout' }, { status: 504 });
  }
}
