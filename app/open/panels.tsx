'use client';

import {
  colorClass,
  pct,
  money,
  usd,
  type EarningsItem,
  type HistoryEntry,
  type NewsItem,
  type NewsState,
  type SharePayload,
  type Tab,
} from './model';

type AssetRow = {
  ticker: string;
  name?: string;
  value: number;
};

type DonutRow = AssetRow & { weight: number };

const chartColors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#f59e0b', '#0891b2', '#be185d'];

export function MobileTabs({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <nav className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-card p-1 shadow-sm sm:hidden">
      {([
        ['portfolio', '포트폴리오'],
        ['assets', '자산'],
        ['watchlist', '관심'],
        ['journal', '일지'],
      ] as const).map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)} className={`rounded-md px-2 py-2 text-xs font-bold ${tab === key ? 'bg-brand text-white' : 'text-sub'}`}>
          {label}
        </button>
      ))}
    </nav>
  );
}

export function ShareView({ payload }: { payload: SharePayload }) {
  return (
    <main className="min-h-screen bg-bg px-4 py-8 text-text">
      <div className="mx-auto max-w-3xl">
        <ShareSummary payload={payload} />
        <div className="mt-5 flex gap-2 no-print">
          <a href="/open" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">내 포트폴리오 열기</a>
          <button onClick={() => window.print()} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">PDF 내보내기</button>
        </div>
      </div>
    </main>
  );
}

export function PortfolioPdfReport({ payload }: { payload: SharePayload }) {
  return (
    <section className="hidden print:block">
      <ShareSummary payload={payload} />
    </section>
  );
}

function ShareSummary({ payload }: { payload: SharePayload }) {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold">공유 포트폴리오</h1>
          <p className="mt-1 text-sm text-sub">{payload.date} 기준 · 금액 비공개</p>
        </div>
        <div className={`text-2xl font-extrabold ${colorClass(payload.pnl)}`}>{pct(payload.pnl)}</div>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-bg text-xs text-sub">
            <tr><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">수익률</th><th className="px-3 py-3 text-right">비중</th></tr>
          </thead>
          <tbody>
            {payload.rows.map((row) => (
              <tr key={row.t} className="border-t border-border">
                <td className="px-3 py-3"><strong className="text-brand">{row.t}</strong><div className="text-xs text-sub">{row.n}</div></td>
                <td className={`px-3 py-3 text-right font-bold ${colorClass(row.pnl)}`}>{pct(row.pnl)}</td>
                <td className="px-3 py-3 text-right">{row.w.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AssetsView({
  history,
  rows,
  summary,
  cash,
  krw,
  rate,
}: {
  history: HistoryEntry[];
  rows: AssetRow[];
  summary: { stockValue: number; totalAsset: number };
  cash: number;
  krw: boolean;
  rate: number;
}) {
  const donutRows: DonutRow[] = [
    ...rows.map((row) => ({
      ...row,
      weight: summary.totalAsset ? (row.value / summary.totalAsset) * 100 : 0,
    })),
    {
      ticker: 'CASH',
      name: '예수금',
      value: cash,
      weight: summary.totalAsset ? (cash / summary.totalAsset) * 100 : 0,
    },
  ].filter((row) => row.value > 0);
  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <AssetTrendChart history={sortedHistory} krw={krw} rate={rate} />
        <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 기록</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-2 text-left">날짜</th><th className="px-3 py-2 text-right">총 자산</th><th className="px-3 py-2 text-right">주식</th><th className="px-3 py-2 text-right">예수금</th><th className="px-3 py-2 text-right">변화율</th></tr></thead>
            <tbody>{history.map((h, index) => {
              const next = history[index + 1];
              const change = next?.totalValue ? ((h.totalValue - next.totalValue) / next.totalValue) * 100 : 0;
              return (
                <tr key={h.date} className="border-t border-border">
                  <td className="px-3 py-2">{h.date}</td>
                  <td className="px-3 py-2 text-right">{money(h.totalValue, krw, rate)}</td>
                  <td className="px-3 py-2 text-right">{money(h.stockValue, krw, rate)}</td>
                  <td className="px-3 py-2 text-right">{money(h.cashValue, krw, rate)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${colorClass(change)}`}>{next ? pct(change) : '-'}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {!history.length && <div className="p-10 text-center text-sm text-sub">포트폴리오 탭에서 오늘 기록을 저장하면 여기에 쌓입니다.</div>}
        </div>
      </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 비중</h2>
        <div className="mt-4 flex justify-center">
          <AssetDonut rows={donutRows} totalAsset={summary.totalAsset} krw={krw} rate={rate} />
        </div>
        <div className="mt-5 space-y-2 text-sm">
          {donutRows.map((row, index) => (
            <div key={row.ticker} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <span className="min-w-0">
                  <span className="font-bold text-text">{row.ticker}</span>
                  {row.name && <span className="ml-1 text-xs text-sub">{row.name}</span>}
                </span>
              </span>
              <strong>{row.weight.toFixed(1)}%</strong>
            </div>
          ))}
          <div className="flex justify-between"><span className="text-sub">주식</span><strong>{money(summary.stockValue, krw, rate)}</strong></div>
          <div className="flex justify-between"><span className="text-sub">예수금</span><strong>{money(cash, krw, rate)}</strong></div>
          <div className="flex justify-between border-t border-border pt-2"><span className="text-sub">총 자산</span><strong>{money(summary.totalAsset, krw, rate)}</strong></div>
        </div>
      </div>
    </section>
  );
}

function AssetDonut({ rows, totalAsset, krw, rate }: { rows: DonutRow[]; totalAsset: number; krw: boolean; rate: number }) {
  if (!rows.length) {
    return (
      <div className="grid h-48 w-48 place-items-center rounded-full bg-bg text-center text-sm font-bold text-sub">
        기록 없음
      </div>
    );
  }
  let cursor = 0;
  const segments = rows.map((row, index) => {
    const start = cursor;
    const end = cursor + row.weight;
    cursor = end;
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
  });
  return (
    <div className="relative h-52 w-52 rounded-full" style={{ background: `conic-gradient(${segments.join(', ')})` }}>
      <div className="absolute inset-10 grid place-items-center rounded-full bg-card text-center">
        <div>
          <div className="text-xs text-sub">총 자산</div>
          <div className="text-lg font-extrabold text-brand">{money(totalAsset, krw, rate)}</div>
        </div>
      </div>
      {rows.slice(0, 5).map((row, index) => {
        const angle = rows.slice(0, index).reduce((sum, item) => sum + item.weight, 0) + row.weight / 2;
        const rad = (angle / 100) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(rad) * 39;
        const y = 50 + Math.sin(rad) * 39;
        return (
          <span
            key={row.ticker}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-bold shadow-sm"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {row.ticker}
          </span>
        );
      })}
    </div>
  );
}

function AssetTrendChart({ history, krw, rate }: { history: HistoryEntry[]; krw: boolean; rate: number }) {
  if (history.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 추이</h2>
        <div className="mt-4 rounded-lg bg-bg p-10 text-center text-sm text-sub">두 번 이상 자산 기록을 저장하면 추이가 표시됩니다.</div>
      </div>
    );
  }
  const width = 720;
  const height = 240;
  const paddingX = 72;
  const paddingY = 28;
  const values = history.flatMap((item) => [item.totalValue, item.stockValue, item.cashValue]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const point = (value: number, index: number) => {
    const x = paddingX + (index / Math.max(history.length - 1, 1)) * (width - paddingX - paddingY);
    const y = height - paddingY - ((value - min) / span) * (height - paddingY * 2);
    return `${x},${y}`;
  };
  const makePoints = (key: 'totalValue' | 'stockValue' | 'cashValue') => history.map((item, index) => point(item[key], index)).join(' ');
  const latest = history[history.length - 1];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">자산 추이</h2>
          <p className="mt-1 text-xs text-sub">총자산, 주식, 예수금 흐름</p>
        </div>
        <div className="text-right text-sm">
          <div className="font-bold">{money(latest.totalValue, krw, rate)}</div>
          <div className="text-xs text-sub">{latest.date}</div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 min-w-[620px] rounded-lg bg-bg">
          {[0, 1, 2, 3].map((line) => {
            const y = paddingY + line * ((height - paddingY * 2) / 3);
            const value = max - (line / 3) * span;
            return (
              <g key={line}>
                <text x="12" y={y + 4} className="fill-sub text-[11px]">{money(value, krw, rate)}</text>
                <line x1={paddingX} x2={width - paddingY} y1={y} y2={y} stroke="rgb(var(--border))" strokeWidth="1" />
              </g>
            );
          })}
          <polyline points={makePoints('totalValue')} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={makePoints('stockValue')} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={makePoints('cashValue')} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-sub">
        <span><b className="text-brand">━</b> 총자산</span>
        <span><b className="text-emerald-600">━</b> 주식</span>
        <span><b className="text-amber-500">━</b> 예수금</span>
      </div>
    </div>
  );
}

export function TickerDetail({
  ticker,
  news,
  state = 'idle',
  theme = 'light',
  earnings = [],
}: {
  ticker: string;
  news: NewsItem[];
  state?: NewsState;
  theme?: 'light' | 'dark';
  earnings?: EarningsItem[];
}) {
  if (!ticker) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm text-sub">
        티커의 상세 버튼을 누르면 차트와 최근 뉴스가 여기에 표시됩니다.
      </section>
    );
  }
  const chartUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(ticker)}&interval=D&theme=${theme}&style=1&timezone=Asia%2FSeoul&hide_top_toolbar=1&hide_legend=0&save_image=0`;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-bold">{ticker} 상세</h2>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-bold text-sub hover:text-brand"
        >
          TradingView 열기
        </a>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
        <iframe title={`${ticker} TradingView chart`} src={chartUrl} className="h-[360px] w-full border-0" loading="lazy" />
        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <TickerEarningsSummary ticker={ticker} earnings={earnings} />
          <h3 className="mt-5 text-sm font-bold">최근 뉴스</h3>
          <div className="mt-3 space-y-3">
            {state === 'loading' && <div className="rounded-lg bg-bg p-4 text-sm text-sub">최근 뉴스를 불러오는 중입니다.</div>}
            {state === 'error' && <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">뉴스를 불러오지 못했습니다.</div>}
            {state === 'empty' && <div className="rounded-lg bg-bg p-4 text-sm text-sub">최근 7일 내 뉴스가 없습니다.</div>}
            {news.length ? news.map((item) => (
              <a key={`${item.id}-${item.datetime}`} href={item.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border p-3 hover:bg-bg">
                <div className="line-clamp-2 text-sm font-semibold">{item.headline}</div>
                <div className="mt-1 text-xs text-sub">{item.source} · {new Date(item.datetime * 1000).toLocaleDateString('ko-KR')}</div>
              </a>
            )) : state === 'idle' ? <div className="rounded-lg bg-bg p-4 text-sm text-sub">상세 버튼을 누르면 최근 뉴스를 함께 불러옵니다.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function TickerEarningsSummary({ ticker, earnings }: { ticker: string; earnings: EarningsItem[] }) {
  const nearestEarnings = earnings
    .filter((item) => item.symbol === ticker)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!nearestEarnings) return null;
  return (
    <div className="rounded-lg border border-border p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">가까운 실적</span>
        <span className="text-sub">{nearestEarnings.date}</span>
      </div>
      <div className="mt-1 text-sub">EPS 예상 {nearestEarnings.epsEstimate ?? '-'} · 매출 예상 {formatRevenue(nearestEarnings.revenueEstimate)}</div>
    </div>
  );
}

export function EarningsPanel({ earnings, loading, onRefresh }: { earnings: EarningsItem[]; loading: boolean; onRefresh: () => void }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">실적 일정</h2>
        <button onClick={onRefresh} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold" disabled={loading}>
          {loading ? '조회 중' : '새로고침'}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {loading && <div className="rounded-lg bg-bg p-4 text-sm text-sub">실적 일정을 불러오는 중입니다.</div>}
        {!loading && earnings.length ? earnings.map((item) => {
          const epsSurprise = typeof item.epsSurprise === 'number'
            ? item.epsSurprise
            : typeof item.epsActual === 'number' && typeof item.epsEstimate === 'number'
              ? item.epsActual - item.epsEstimate
              : null;
          const revenueSurprise = typeof item.revenueSurprise === 'number'
            ? item.revenueSurprise
            : typeof item.revenueActual === 'number' && typeof item.revenueEstimate === 'number'
              ? item.revenueActual - item.revenueEstimate
              : null;
          const result = epsSurprise === null && revenueSurprise === null
            ? null
            : (epsSurprise ?? 0) >= 0 && (revenueSurprise ?? 0) >= 0 ? 'beat' : 'miss';
          return (
          <div key={`${item.symbol}-${item.date}`} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <strong className="text-brand">{item.symbol}</strong>
              <span className="flex items-center gap-2 text-xs text-sub">
                {result && <b className={`rounded-full px-2 py-0.5 ${result === 'beat' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{result.toUpperCase()}</b>}
                {item.date} {item.hour ? `· ${item.hour.toUpperCase()}` : ''}
              </span>
            </div>
            <div className="mt-1 grid gap-1 text-xs text-sub">
              <div>EPS 예상 {item.epsEstimate ?? '-'}{typeof item.epsActual === 'number' ? ` · 실제 ${item.epsActual}` : ''}</div>
              <div>
                매출 예상 {formatRevenue(item.revenueEstimate)}
                {typeof item.revenueActual === 'number' ? ` · 실제 ${formatRevenue(item.revenueActual)}` : ''}
              </div>
            </div>
          </div>
        );}) : !loading ? <div className="rounded-lg bg-bg p-4 text-sm text-sub">조회된 실적 일정이 없습니다.</div> : null}
      </div>
    </section>
  );
}

function formatRevenue(value?: number) {
  if (typeof value !== 'number') return '-';
  return `$${(value / 1000000000).toLocaleString('en-US', { maximumFractionDigits: 2 })}B`;
}
