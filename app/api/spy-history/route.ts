import { NextRequest, NextResponse } from 'next/server';

// Yahoo Finance에서 SPY 일봉 데이터를 서버사이드로 가져와 프록시 (CORS 없이, API 키 불필요)
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') || '';
  const to   = req.nextUrl.searchParams.get('to')   || '';
  if (!from || !to) {
    return NextResponse.json({ error: 'missing from/to params' }, { status: 400 });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&period1=${from}&period2=${to}&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Next.js server)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
