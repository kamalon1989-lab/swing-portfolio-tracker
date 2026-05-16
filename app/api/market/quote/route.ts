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
type YahooQuoteItem = {
  symbol?: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
};
type YahooRawValue = number | { raw?: number; fmt?: string } | undefined | null;
type YahooSummaryItem = {
  symbol: string;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  regularMarketVolume?: number;
  averageVolume?: number;
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
  const extendedBasePrice = regularPrice ?? prevClose;
  const extendedChangePercent = extendedPrice && extendedBasePrice ? ((extendedPrice - extendedBasePrice) / extendedBasePrice) * 100 : undefined;
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

async function fetchQuoteBasics(symbols: string[]) {
  if (!symbols.length) return new Map<string, YahooQuoteItem>();
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 60 },
  });
  if (!upstream.ok) return new Map<string, YahooQuoteItem>();
  const data = await upstream.json();
  const results = (data?.quoteResponse?.result ?? []) as YahooQuoteItem[];
  return new Map(
    results
      .filter((item) => item.symbol)
      .map((item) => [String(item.symbol).toUpperCase(), item])
  );
}

function rawNumber(value: YahooRawValue) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.raw === 'number' && Number.isFinite(value.raw)) return value.raw;
  return undefined;
}

async function fetchQuoteSummary(symbol: string): Promise<YahooSummaryItem | null> {
  const modules = 'price,summaryDetail,defaultKeyStatistics';
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 300 },
  });
  if (!upstream.ok) return null;
  const data = await upstream.json();
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;
  const price = result.price ?? {};
  const detail = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  return {
    symbol: String(price.symbol ?? symbol).toUpperCase(),
    marketCap: rawNumber(price.marketCap) ?? rawNumber(stats.enterpriseValue),
    trailingPE: rawNumber(detail.trailingPE) ?? rawNumber(stats.trailingPE),
    forwardPE: rawNumber(detail.forwardPE) ?? rawNumber(stats.forwardPE),
    regularMarketVolume: rawNumber(price.regularMarketVolume) ?? rawNumber(detail.volume),
    averageVolume: rawNumber(detail.averageVolume) ?? rawNumber(detail.averageDailyVolume3Month),
  };
}

async function fetchQuoteSummaries(symbols: string[]) {
  const entries = await Promise.all(symbols.map((symbol) => fetchQuoteSummary(symbol).catch(() => null)));
  return new Map(
    entries
      .filter((item): item is YahooSummaryItem => Boolean(item?.symbol))
      .map((item) => [item.symbol.toUpperCase(), item])
  );
}

export async function GET(req: NextRequest) {
  const user = await verify(req);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const symbols = cleanSymbols(req.nextUrl.searchParams.get('symbols'));
  if (!symbols.length) return Response.json({ quotes: [] });

  try {
    const [quotes, basics, summaries] = await Promise.all([
      Promise.all(symbols.map((symbol) => fetchChartQuote(symbol).catch(() => null))),
      fetchQuoteBasics(symbols).catch(() => new Map<string, YahooQuoteItem>()),
      fetchQuoteSummaries(symbols).catch(() => new Map<string, YahooSummaryItem>()),
    ]);
    return Response.json(
      {
        quotes: quotes.filter(Boolean).map((quote) => {
          const basic = basics.get(String(quote?.symbol ?? '').toUpperCase());
          const summary = summaries.get(String(quote?.symbol ?? '').toUpperCase());
          return {
            ...quote,
            marketCap: basic?.marketCap ?? summary?.marketCap,
            trailingPE: basic?.trailingPE ?? summary?.trailingPE,
            forwardPE: basic?.forwardPE ?? summary?.forwardPE,
            regularMarketVolume: basic?.regularMarketVolume ?? summary?.regularMarketVolume,
            averageVolume: basic?.averageDailyVolume3Month ?? summary?.averageVolume,
          };
        }),
      },
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
