'use client';

import {
  colorClass,
  pct,
  money,
  type EarningsItem,
  type HistoryEntry,
  type NewsItem,
  type NewsState,
  type SharePayload,
  type Tab,
} from './model';

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
              <tr><th className="px-3 py-3 text-left">종목</th><th className="px-3 py-3 text-right">수익률</th><th className="px-3 py-3 text-right">비중</th></tr>
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
        <div className="mt-5 flex gap-2">
          <a href="/open" className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">내 포트폴리오 열기</a>
          <button onClick={() => window.print()} className="rounded-lg border border-border px-4 py-2 text-sm font-bold">PDF/인쇄</button>
        </div>
      </section>
    </main>
  );
}

export function AssetsView({ history, summary, cash, krw, rate }: { history: HistoryEntry[]; summary: { stockValue: number; totalAsset: number }; cash: number; krw: boolean; rate: number }) {
  const stockRatio = summary.totalAsset ? (summary.stockValue / summary.totalAsset) * 100 : 0;
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 기록</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-2 text-left">날짜</th><th className="px-3 py-2 text-right">총 자산</th><th className="px-3 py-2 text-right">주식</th><th className="px-3 py-2 text-right">예수금</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.date} className="border-t border-border"><td className="px-3 py-2">{h.date}</td><td className="px-3 py-2 text-right">{money(h.totalValue, krw, rate)}</td><td className="px-3 py-2 text-right">{money(h.stockValue, krw, rate)}</td><td className="px-3 py-2 text-right">{money(h.cashValue, krw, rate)}</td></tr>)}</tbody>
          </table>
          {!history.length && <div className="p-10 text-center text-sm text-sub">포트폴리오 탭에서 오늘 기록을 저장하면 여기에 쌓입니다.</div>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 비중</h2>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-brand" style={{ width: `${stockRatio}%` }} />
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-sub">주식</span><strong>{money(summary.stockValue, krw, rate)}</strong></div>
          <div className="flex justify-between"><span className="text-sub">예수금</span><strong>{money(cash, krw, rate)}</strong></div>
          <div className="flex justify-between border-t border-border pt-2"><span className="text-sub">총 자산</span><strong>{money(summary.totalAsset, krw, rate)}</strong></div>
        </div>
      </div>
    </section>
  );
}

export function TickerDetail({ ticker, news, state = 'idle' }: { ticker: string; news: NewsItem[]; state?: NewsState }) {
  if (!ticker) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm text-sub">
        종목의 상세 버튼을 누르면 차트와 최근 뉴스가 여기에 표시됩니다.
      </section>
    );
  }
  const chartUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(ticker)}&interval=D&theme=light&style=1&timezone=Asia%2FSeoul&hide_top_toolbar=1&hide_legend=0&save_image=0`;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-bold">{ticker} 상세</h2>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <iframe title={`${ticker} TradingView chart`} src={chartUrl} className="h-[360px] w-full border-0" loading="lazy" />
        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <h3 className="text-sm font-bold">최근 뉴스</h3>
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
        {!loading && earnings.length ? earnings.map((item) => (
          <div key={`${item.symbol}-${item.date}`} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <strong className="text-brand">{item.symbol}</strong>
              <span className="text-xs text-sub">{item.date} {item.hour ? `· ${item.hour.toUpperCase()}` : ''}</span>
            </div>
            <div className="mt-1 text-xs text-sub">
              EPS 예상 {item.epsEstimate ?? '-'} · 매출 예상 {typeof item.revenueEstimate === 'number' ? `$${Math.round(item.revenueEstimate / 1000000).toLocaleString()}M` : '-'}
            </div>
          </div>
        )) : !loading ? <div className="rounded-lg bg-bg p-4 text-sm text-sub">조회된 실적 일정이 없습니다.</div> : null}
      </div>
    </section>
  );
}
