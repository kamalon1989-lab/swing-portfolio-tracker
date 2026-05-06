import { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'swing-dh';

type YahooPeriod = { start?: number; end?: number };
type YahooChartResult = {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketPreviousClose?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    currentTradingPeriod?: {
      pre?: YahooPeriod;
      regular?: YahooPeriod;
      post?: YahooPeriod;
    };
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{ close?: Array<number | null> }>;
  };
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

function inPeriod(timestamp: number | null, period?: YahooPeriod) {
  return Boolean(timestamp && period?.start && period?.end && timestamp >= period.start && timestamp <= period.end);
}

function latestClose(result: YahooChartResult) {
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result.timestamp ?? [];
  for (let index = closes.length - 1; index >= 0; index--) {
    const close = closes[index];
    if (typeof close === 'number' && Number.isFinite(close)) {
      return { price: close, timestamp: timestamps[index] ?? null };
    }
  }
  return { price: null, timestamp: null };
}

async function fetchChartQuote(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=true`;
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 20 },
  });
  if (!upstream.ok) return null;
  const data = await upstream.json();
  const result = data?.chart?.result?.[0] as YahooChartResult | undefined;
  if (!result?.meta) return null;

  const { price: extendedPrice, timestamp } = latestClose(result);
  const regularPrice = result.meta.regularMarketPrice;
  const prevClose = result.meta.regularMarketPreviousClose ?? result.meta.previousClose ?? result.meta.chartPreviousClose ?? regularPrice;
  const periods = result.meta.currentTradingPeriod;
  const marketState = inPeriod(timestamp, periods?.pre)
    ? 'PRE'
    : inPeriod(timestamp, periods?.post)
      ? 'POST'
      : inPeriod(timestamp, periods?.regular)
        ? 'REGULAR'
        : 'CLOSED';
  const extendedChangePercent = extendedPrice && prevClose ? ((extendedPrice - prevClose) / prevClose) * 100 : undefined;
  const regularChangePercent = regularPrice && prevClose ? ((regularPrice - prevClose) / prevClose) * 100 : undefined;

  return {
    symbol: result.meta.symbol ?? symbol,
    regularMarketPrice: regularPrice,
    regularMarketPreviousClose: prevClose,
    regularMarketChangePercent: regularChangePercent,
    preMarketPrice: marketState === 'PRE' ? extendedPrice : undefined,
    preMarketChangePercent: marketState === 'PRE' ? extendedChangePercent : undefined,
    postMarketPrice: marketState === 'POST' ? extendedPrice : undefined,
    postMarketChangePercent: marketState === 'POST' ? extendedChangePercent : undefined,
    marketState,
  };
}

export async function GET(req: NextRequest) {
  const user = await verify(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const symbols = cleanSymbols(req.nextUrl.searchParams.get('symbols'));
  if (!symbols.length) return Response.json({ quotes: [] });

  try {
    const quotes = await Promise.all(symbols.map((symbol) => fetchChartQuote(symbol).catch(() => null)));
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
    return Response.json({ error: 'quote upstream timeout' }, { status: 504 });
  }
}
