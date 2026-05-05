'use client';

import { useMemo, useState } from 'react';
import {
  colorClass,
  earningsSymbolMatches,
  pct,
  money,
  usd,
  type EarningsItem,
  type GoalConfig,
  type HistoryEntry,
  type InvestStyle,
  type SharePayload,
  type Tab,
} from './model';

/* ─── Goal tracker helpers ─────────────────────────────────── */

function getStyleRates(style: InvestStyle, customRate?: number): [number, number, number] {
  const base = (customRate ?? 10) / 100;
  switch (style) {
    case '공격형': return [0.30, 0.18, 0.08];
    case '중립형': return [0.20, 0.12, 0.05];
    case '보수형': return [0.12, 0.07, 0.03];
    case '자유형': return [Math.min(base * 1.5, 0.5), base, Math.max(base * 0.5, 0.005)];
  }
}

function projectScenario(startVal: number, monthly: number, annualRate: number, months: number): number[] {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const vals: number[] = [];
  let v = startVal;
  for (let i = 0; i < months; i++) {
    v = v * (1 + r) + monthly;
    vals.push(v);
  }
  return vals;
}

function calcRequiredMonthlyRate(start: number, monthly: number, target: number, months: number): number | null {
  if (months <= 0 || target <= 0) return null;
  if (start >= target) return 0;
  let lo = -0.05, hi = 0.5;
  for (let k = 0; k < 60; k++) {
    const r = (lo + hi) / 2;
    let v = start;
    for (let i = 0; i < months; i++) v = v * (1 + r) + monthly;
    if (v < target) lo = r; else hi = r;
  }
  return (lo + hi) / 2;
}

function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

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
  onEditHistory,
  onDeleteHistory,
  benchData = [],
  goalConfig = null,
  onEditGoal,
}: {
  history: HistoryEntry[];
  rows: AssetRow[];
  summary: { stockValue: number; totalAsset: number };
  cash: number;
  krw: boolean;
  rate: number;
  onEditHistory: (entry: HistoryEntry) => void;
  onDeleteHistory: (date: string) => void;
  benchData?: { date: string; price: number }[];
  goalConfig?: GoalConfig | null;
  onEditGoal?: () => void;
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
    <div className="space-y-4">
      {onEditGoal && (
        <GoalTracker
          goalConfig={goalConfig}
          history={sortedHistory}
          currentAsset={summary.totalAsset}
          krw={krw}
          rate={rate}
          onEdit={onEditGoal}
        />
      )}
    <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <AssetTrendChart history={sortedHistory} krw={krw} rate={rate} benchData={benchData} />
        <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 기록</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-2 text-left">날짜</th><th className="px-3 py-2 text-right">총 자산</th><th className="px-3 py-2 text-right">주식</th><th className="px-3 py-2 text-right">예수금</th><th className="px-3 py-2 text-right">변화율</th><th className="px-3 py-2 text-right">관리</th></tr></thead>
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
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => onEditHistory(h)} className="mr-2 text-brand text-xs">수정</button>
                    <button onClick={() => onDeleteHistory(h.date)} className="text-rose-600 text-xs">삭제</button>
                  </td>
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
    </div>
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

function AssetTrendChart({ history, krw, rate, benchData = [] }: { history: HistoryEntry[]; krw: boolean; rate: number; benchData?: { date: string; price: number }[] }) {
  if (history.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">자산 추이</h2>
        <div className="mt-4 rounded-lg bg-bg p-10 text-center text-sm text-sub">두 번 이상 자산 기록을 저장하면 추이가 표시됩니다.</div>
      </div>
    );
  }
  const width = 720;
  const height = 260;
  const paddingX = 72;
  const paddingTop = 28;
  const paddingBottom = 44;
  const values = history.flatMap((item) => [item.totalValue, item.stockValue, item.cashValue]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const chartH = height - paddingTop - paddingBottom;
  const point = (value: number, index: number) => {
    const x = paddingX + (index / Math.max(history.length - 1, 1)) * (width - paddingX - paddingTop);
    const y = paddingTop + chartH - ((value - min) / span) * chartH;
    return `${x},${y}`;
  };
  const xOf = (index: number) => paddingX + (index / Math.max(history.length - 1, 1)) * (width - paddingX - paddingTop);
  const makePoints = (key: 'totalValue' | 'stockValue' | 'cashValue') => history.map((item, index) => point(item[key], index)).join(' ');

  // S&P500 벤치마크 라인: 첫 기록일 기준으로 정규화
  const benchMap = new Map(benchData.map((b) => [b.date, b.price]));
  function findBenchPrice(date: string) {
    if (benchMap.has(date)) return benchMap.get(date)!;
    const before = [...benchMap.entries()].filter(([d]) => d <= date).sort((a, b) => b[0].localeCompare(a[0]))[0];
    return before ? before[1] : null;
  }
  const benchPoints = history.map((h) => findBenchPrice(h.date));
  const benchBaseline = benchPoints[0];
  const baseValue = history[0]?.totalValue ?? 1;
  const benchSvgPoints = benchBaseline
    ? history.map((_, i) => {
        const bp = benchPoints[i];
        const val = bp != null ? baseValue * (bp / benchBaseline) : null;
        return val != null ? point(val, i) : null;
      }).filter(Boolean).join(' ')
    : null;
  const latest = history[history.length - 1];
  const labelIndices = history.length <= 6
    ? history.map((_, i) => i)
    : [0, Math.floor(history.length / 3), Math.floor(history.length * 2 / 3), history.length - 1];
  const shownLabels = new Set(labelIndices);
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
        <svg viewBox={`0 0 ${width} ${height}`} className="h-72 min-w-[620px] rounded-lg bg-bg">
          {[0, 1, 2, 3].map((line) => {
            const y = paddingTop + line * (chartH / 3);
            const value = max - (line / 3) * span;
            return (
              <g key={line}>
                <text x="12" y={y + 4} className="fill-sub text-[11px]" fontSize="11">{money(value, krw, rate)}</text>
                <line x1={paddingX} x2={width - paddingTop} y1={y} y2={y} stroke="rgb(var(--border))" strokeWidth="1" />
              </g>
            );
          })}
          {benchSvgPoints && <polyline points={benchSvgPoints} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 3" strokeLinecap="round" strokeLinejoin="round" />}
          <polyline points={makePoints('totalValue')} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={makePoints('stockValue')} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={makePoints('cashValue')} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {history.map((item, i) => shownLabels.has(i) ? (
            <text key={item.date} x={xOf(i)} y={height - 8} textAnchor="middle" fontSize="10" className="fill-sub">{item.date.slice(5)}</text>
          ) : null)}
          <line x1={paddingX} x2={width - paddingTop} y1={paddingTop + chartH} y2={paddingTop + chartH} stroke="rgb(var(--border))" strokeWidth="1" />
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-sub">
        <span><b className="text-brand">━</b> 총자산</span>
        <span><b className="text-emerald-600">━</b> 주식</span>
        <span><b className="text-amber-500">━</b> 예수금</span>
        {benchSvgPoints && <span><b className="text-slate-400">╌</b> S&amp;P500 (동기)</span>}
      </div>
    </div>
  );
}

export function TickerDetail({
  ticker,
  theme = 'light',
  earnings = [],
  memo = '',
  onSaveMemo,
}: {
  ticker: string;
  theme?: 'light' | 'dark';
  earnings?: EarningsItem[];
  memo?: string;
  onSaveMemo?: (text: string) => void;
}) {
  if (!ticker) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm text-sub">
        티커의 상세 버튼을 누르면 차트가 여기에 표시됩니다.
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
      <div className="p-0">
        <iframe title={`${ticker} TradingView chart`} src={chartUrl} className="h-[360px] w-full border-0" loading="lazy" />
        {earnings.length > 0 && (
          <div className="border-t border-border p-4">
            <TickerEarningsSummary ticker={ticker} earnings={earnings} />
          </div>
        )}
        {onSaveMemo && (
          <div className="border-t border-border p-4">
            <TickerMemo memo={memo} onSave={onSaveMemo} />
          </div>
        )}
      </div>
    </section>
  );
}

function TickerMemo({ memo, onSave }: { memo: string; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo);
  function handleSave() {
    onSave(draft);
    setEditing(false);
  }
  function handleEdit() {
    setDraft(memo);
    setEditing(true);
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold">메모</h3>
        {!editing && (
          <button onClick={handleEdit} className="text-xs font-semibold text-brand hover:underline">
            {memo ? '편집' : '작성'}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand resize-none"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="이 종목에 대한 메모를 입력하세요..."
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">저장</button>
            <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-sub">취소</button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleEdit}
          className={`min-h-[60px] cursor-text rounded-lg border border-border bg-bg px-3 py-2 text-sm ${memo ? 'text-text whitespace-pre-wrap' : 'text-sub'}`}
        >
          {memo || '메모를 작성하려면 클릭하세요...'}
        </div>
      )}
    </div>
  );
}

function TickerEarningsSummary({ ticker, earnings }: { ticker: string; earnings: EarningsItem[] }) {
  const nearestEarnings = earnings
    .filter((item) => earningsSymbolMatches(ticker, item.symbol))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!nearestEarnings) return null;
  return (
    <div className="rounded-lg border border-border p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">가까운 실적</span>
        <span className="text-sub">{formatEarningsDate(nearestEarnings)} · {formatEarningsHour(nearestEarnings.hour)}</span>
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
                {formatEarningsDate(item)} · {formatEarningsHour(item.hour)}
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

function formatEarningsDate(item: EarningsItem) {
  return `${item.date} · ${earningsDday(item.date)}`;
}

function earningsDday(date: string) {
  const days = daysUntil(date);
  if (days === null) return 'D-?';
  if (days === 0) return 'D-Day';
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

function daysUntil(date: string) {
  const event = new Date(`${date}T00:00:00`);
  if (Number.isNaN(event.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((event.getTime() - todayStart.getTime()) / 86400000);
}

function formatEarningsHour(hour?: string) {
  const key = hour?.toLowerCase();
  if (key === 'bmo' || key === 'before market open') return '장전';
  if (key === 'amc' || key === 'after market close') return '장후';
  if (key === 'dmh' || key === 'during market hours') return '장중';
  return '시간 미정';
}

/* ─── 투자 목표 트래커 ─────────────────────────────────────── */

function GoalScenarioChart({
  currentAsset, targetAmount, history,
  neutralProj, optimisticProj, conservativeProj,
  totalMonths, now, krw, rate,
  optimisticAchieveMonth, neutralAchieveMonth, conservativeAchieveMonth,
}: {
  currentAsset: number; targetAmount: number; history: HistoryEntry[];
  neutralProj: number[]; optimisticProj: number[]; conservativeProj: number[];
  totalMonths: number; now: Date; krw: boolean; rate: number;
  optimisticAchieveMonth: number; neutralAchieveMonth: number; conservativeAchieveMonth: number;
}) {
  const W = 720, H = 260, PX = 70, PT = 20, PB = 46, PR = 16;
  const chartW = W - PX - PR, chartH = H - PT - PB;
  const histBack = 6;
  const futureLen = Math.min(Math.max(totalMonths + 3, 6), 60);
  const totalDisp = histBack + futureLen;
  const xOf = (m: number) => PX + ((histBack + m) / totalDisp) * chartW;

  // All y values for range
  const len = futureLen + 1;
  const allVals = [
    currentAsset, targetAmount,
    ...optimisticProj.slice(0, len),
    ...neutralProj.slice(0, len),
    ...conservativeProj.slice(0, len),
    ...history.map((h) => h.totalValue),
  ].filter((v) => !isNaN(v));
  const raw0 = Math.min(...allVals), raw1 = Math.max(...allVals);
  const sp = raw1 - raw0 || 1;
  const minV = raw0 - sp * 0.04, maxV = raw1 + sp * 0.08;
  const vSp = maxV - minV;
  const yOf = (v: number) => PT + chartH - ((Math.max(minV, Math.min(maxV, v)) - minV) / vSp) * chartH;

  // Projection polyline (month 0 = now)
  const projPts = (arr: number[]) =>
    [[0, currentAsset] as [number, number], ...arr.slice(0, len).map((v, i) => [i + 1, v] as [number, number])]
      .map(([m, v]) => `${xOf(m)},${yOf(v)}`).join(' ');

  // History points
  const histPts = history.map((h) => {
    const d = new Date(h.date + 'T00:00:00');
    const m = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
    return { m, v: h.totalValue };
  }).filter(({ m }) => m >= -histBack && m <= 0).sort((a, b) => a.m - b.m);

  // Y labels
  const yLabels = [0, 1, 2, 3].map((i) => ({ y: PT + (i * chartH) / 3, val: maxV - (i / 3) * vSp }));

  // X labels (every 3 months)
  const xLabels: { x: number; lbl: string }[] = [];
  for (let m = 0; m <= futureLen; m += 3) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + m);
    xLabels.push({ x: xOf(m), lbl: m === 0 ? '현재' : `${d.getFullYear().toString().slice(2)}/${String(d.getMonth() + 1).padStart(2, '0')}` });
  }

  const targetY = yOf(targetAmount);
  const nowX = xOf(0);
  const targetX = xOf(totalMonths);

  function monthToStr(idx: number) {
    const d = new Date(now); d.setMonth(d.getMonth() + idx + 1);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }

  const scenarios = [
    { lbl: '낙관', color: '#16a34a', am: optimisticAchieveMonth, pts: projPts(optimisticProj), dash: '7 3' },
    { lbl: '중립', color: '#2563eb', am: neutralAchieveMonth,    pts: projPts(neutralProj),    dash: undefined },
    { lbl: '보수', color: '#e11d48', am: conservativeAchieveMonth, pts: projPts(conservativeProj), dash: '4 4' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-bold">시나리오별 예측 그래프</h3>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-64 min-w-[600px] rounded-lg bg-bg">
          {/* Grid lines + Y labels */}
          {yLabels.map(({ y, val }, i) => (
            <g key={i}>
              <text x="6" y={y + 4} fontSize="10" className="fill-sub">{fmtShort(val)}</text>
              <line x1={PX} x2={W - PR} y1={y} y2={y} stroke="rgb(var(--border))" strokeWidth="1" />
            </g>
          ))}
          {/* Target horizontal line */}
          <line x1={PX} x2={W - PR} y1={targetY} y2={targetY} stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="8 4" />
          <text x={W - PR - 2} y={targetY - 4} fontSize="10" textAnchor="end" fill="#8b5cf6" fontWeight="600">목표 {fmtShort(targetAmount)}</text>
          {/* Now vertical */}
          <line x1={nowX} x2={nowX} y1={PT} y2={PT + chartH} stroke="rgb(var(--border))" strokeWidth="1.5" strokeDasharray="4 3" />
          {/* Target date vertical */}
          {targetX < W - PR && (
            <line x1={targetX} x2={targetX} y1={PT} y2={PT + chartH} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
          )}
          {/* Scenario lines */}
          {scenarios.map(({ color, pts, dash }) => (
            <polyline key={color} points={pts} fill="none" stroke={color} strokeWidth="2"
              strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {/* Achievement dots on target line */}
          {scenarios.map(({ color, am }) =>
            am >= 0 && am < len ? (
              <circle key={color} cx={xOf(am + 1)} cy={targetY} r={5} fill={color} stroke="rgb(var(--bg))" strokeWidth="2" />
            ) : null
          )}
          {/* History line */}
          {histPts.length >= 2 && (
            <polyline points={histPts.map(({ m, v }) => `${xOf(m)},${yOf(v)}`).join(' ')}
              fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {histPts.map(({ m, v }) => (
            <circle key={m} cx={xOf(m)} cy={yOf(v)} r={3} fill="#94a3b8" />
          ))}
          {/* X labels */}
          {xLabels.map(({ x, lbl }) => (
            <text key={lbl} x={x} y={H - 6} fontSize="10" textAnchor="middle" className="fill-sub">{lbl}</text>
          ))}
          <line x1={PX} x2={W - PR} y1={PT + chartH} y2={PT + chartH} stroke="rgb(var(--border))" strokeWidth="1" />
        </svg>
      </div>
      {/* Legend + intersection summary */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-sub">
        {scenarios.map(({ lbl, color, am }) => (
          <span key={lbl} style={{ color }}><b>━</b> {lbl}: {am >= 0 ? monthToStr(am) + ' 달성' : '기간 초과'}</span>
        ))}
        {histPts.length > 0 && <span className="text-slate-400"><b>━</b> 실제 기록</span>}
        <span className="text-violet-500"><b>╌</b> 목표</span>
      </div>
    </div>
  );
}

function RequiredReturnCard({
  requiredAnnualRate, neutralRate, totalMonths, goalConfig, krw, rate,
}: {
  requiredAnnualRate: number | null; neutralRate: number; totalMonths: number;
  goalConfig: GoalConfig; krw: boolean; rate: number;
}) {
  if (requiredAnnualRate === null) return null;
  const pct100 = (requiredAnnualRate * 100);
  const isAchieved = requiredAnnualRate <= 0;
  const isHard = pct100 > 40;
  const isMid = !isAchieved && !isHard && requiredAnnualRate > neutralRate;
  const rColor = isAchieved ? 'text-emerald-600' : isHard ? 'text-rose-600' : isMid ? 'text-amber-500' : 'text-brand';
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-bold">필요 수익률 역산기</h3>
      <p className="mt-0.5 text-xs text-sub">{totalMonths}개월 이내 목표 달성 기준</p>
      <div className="mt-4 flex items-end gap-2">
        <div>
          <div className="text-xs text-sub">필요 연수익률</div>
          <div className={`mt-1 text-3xl font-extrabold ${rColor}`}>
            {isAchieved ? '이미 달성 🎉' : `${pct100.toFixed(1)}%`}
          </div>
        </div>
        {!isAchieved && (
          <div className="mb-1.5 text-xs text-sub">
            월 {((Math.pow(1 + requiredAnnualRate, 1 / 12) - 1) * 100).toFixed(2)}%
          </div>
        )}
      </div>
      {isHard && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400">
          ⚠️ 도전적인 목표입니다. 기한을 늘리거나 월 적립액을 높여보세요.<br />
          <span className="mt-0.5 block text-sub">현재 적립액: {money(goalConfig.monthlyContrib, krw, rate)}/월</span>
        </div>
      )}
      {!isAchieved && !isHard && (
        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-sub">
            <span>{goalConfig.style} 중립 수익률</span>
            <span className="font-semibold text-text">{(neutralRate * 100).toFixed(0)}%/년</span>
          </div>
          <div className="flex justify-between text-sub">
            <span>필요 수익률</span>
            <span className={`font-semibold ${rColor}`}>{pct100.toFixed(1)}%/년</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyCheckin({ history, neutralProj, krw, rate }: {
  history: HistoryEntry[]; neutralProj: number[]; krw: boolean; rate: number;
}) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-bold">월간 체크인</h3>
        <div className="mt-3 rounded-lg bg-bg p-4 text-center text-sm text-sub">
          자산 기록이 2개 이상이면 체크인 데이터가 표시됩니다.
        </div>
      </div>
    );
  }
  const first = sorted[0], last = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const momChange = prev ? ((last.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0;
  const d0 = new Date(first.date + 'T00:00:00'), d1 = new Date(last.date + 'T00:00:00');
  const yearsDiff = (d1.getTime() - d0.getTime()) / (365.25 * 86400000);
  const cagr = yearsDiff > 0.05 && first.totalValue > 0
    ? (Math.pow(last.totalValue / first.totalValue, 1 / yearsDiff) - 1) * 100 : null;
  const monthsSince = (d1.getFullYear() - d0.getFullYear()) * 12 + (d1.getMonth() - d0.getMonth());
  const expected = neutralProj[Math.max(0, monthsSince - 1)] ?? null;
  const vsNeutral = expected && expected > 0 ? ((last.totalValue - expected) / expected) * 100 : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-bold">월간 체크인</h3>
      <p className="mt-0.5 text-xs text-sub">마지막 기록 기준 · {last.date}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-sub">총 자산</div>
          <div className="mt-1 font-bold">{money(last.totalValue, krw, rate)}</div>
        </div>
        <div>
          <div className="text-xs text-sub">전 기록 대비</div>
          <div className={`mt-1 font-bold ${colorClass(momChange)}`}>{momChange >= 0 ? '+' : ''}{momChange.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-xs text-sub">연환산 수익률</div>
          {cagr !== null
            ? <div className={`mt-1 font-bold ${colorClass(cagr)}`}>{cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%</div>
            : <div className="mt-1 text-sm text-sub">기간 부족</div>}
        </div>
        <div>
          <div className="text-xs text-sub">중립 시나리오 대비</div>
          {vsNeutral !== null
            ? <div className={`mt-1 font-bold ${colorClass(vsNeutral)}`}>{vsNeutral >= 0 ? '+' : ''}{vsNeutral.toFixed(1)}%</div>
            : <div className="mt-1 text-sm text-sub">—</div>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-sub">
        <span>첫 기록</span><span className="font-semibold text-text">{first.date}</span>
        <span className="text-border">|</span>
        <span>{monthsSince}개월 경과</span>
      </div>
    </div>
  );
}

export function GoalTracker({
  goalConfig, history, currentAsset, krw, rate, onEdit,
}: {
  goalConfig: GoalConfig | null;
  history: HistoryEntry[];
  currentAsset: number;
  krw: boolean;
  rate: number;
  onEdit: () => void;
}) {
  if (!goalConfig) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="text-center">
          <div className="text-4xl">🎯</div>
          <h2 className="mt-3 text-lg font-bold">투자 목표 트래커</h2>
          <p className="mt-2 text-sm leading-6 text-sub">
            목표 금액과 기한을 설정하면<br />달성률 · 예측 그래프 · 필요 수익률을 확인할 수 있습니다.
          </p>
          <button onClick={onEdit} className="mt-5 rounded-xl bg-brand px-6 py-2.5 font-bold text-white">
            목표 설정하기
          </button>
        </div>
      </div>
    );
  }
  return <GoalTrackerContent goalConfig={goalConfig} history={history} currentAsset={currentAsset} krw={krw} rate={rate} onEdit={onEdit} />;
}

function GoalTrackerContent({
  goalConfig, history, currentAsset, krw, rate, onEdit,
}: {
  goalConfig: GoalConfig;
  history: HistoryEntry[];
  currentAsset: number;
  krw: boolean;
  rate: number;
  onEdit: () => void;
}) {
  const [optimisticRate, neutralRate, conservativeRate] = getStyleRates(goalConfig.style, goalConfig.customRate);
  const now = useMemo(() => new Date(), []);
  const targetDate = new Date(goalConfig.targetDate + 'T00:00:00');
  const dday = Math.ceil((targetDate.getTime() - now.getTime()) / 86400000);
  const totalMonths = Math.max(1, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const achieveRate = goalConfig.targetAmount > 0 ? Math.min((currentAsset / goalConfig.targetAmount) * 100, 100) : 0;

  const displayMonths = Math.min(totalMonths + 6, 66);
  const optimisticProj = useMemo(() => projectScenario(currentAsset, goalConfig.monthlyContrib, optimisticRate, displayMonths), [currentAsset, goalConfig.monthlyContrib, optimisticRate, displayMonths]);
  const neutralProj    = useMemo(() => projectScenario(currentAsset, goalConfig.monthlyContrib, neutralRate,    displayMonths), [currentAsset, goalConfig.monthlyContrib, neutralRate,    displayMonths]);
  const conservativeProj = useMemo(() => projectScenario(currentAsset, goalConfig.monthlyContrib, conservativeRate, displayMonths), [currentAsset, goalConfig.monthlyContrib, conservativeRate, displayMonths]);

  const optAm = optimisticProj.findIndex((v) => v >= goalConfig.targetAmount);
  const neuAm = neutralProj.findIndex((v) => v >= goalConfig.targetAmount);
  const conAm = conservativeProj.findIndex((v) => v >= goalConfig.targetAmount);

  function monthToStr(idx: number) {
    const d = new Date(now); d.setMonth(d.getMonth() + idx + 1);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }

  const requiredRate = useMemo(() => calcRequiredMonthlyRate(currentAsset, goalConfig.monthlyContrib, goalConfig.targetAmount, totalMonths), [currentAsset, goalConfig.monthlyContrib, goalConfig.targetAmount, totalMonths]);
  const requiredAnnual = requiredRate !== null ? Math.pow(1 + requiredRate, 12) - 1 : null;

  const ddayColor = dday < 0 ? 'text-rose-600' : dday < 90 ? 'text-amber-500' : 'text-text';
  const achColor  = achieveRate >= 100 ? 'text-emerald-600' : achieveRate >= 50 ? 'text-brand' : 'text-text';

  return (
    <div className="space-y-4">
      {/* Header + 3 key metrics */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">🎯 투자 목표 트래커</h2>
            <p className="mt-0.5 text-xs text-sub">{goalConfig.purpose} · 목표 {money(goalConfig.targetAmount, krw, rate)}</p>
          </div>
          <button onClick={onEdit} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold text-sub hover:text-brand">수정</button>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${achieveRate}%` }} />
        </div>
        {/* 3 key numbers */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-bg p-3 text-center">
            <div className="text-xs text-sub">달성률</div>
            <div className={`mt-1 text-2xl font-extrabold ${achColor}`}>{achieveRate.toFixed(1)}%</div>
            <div className="mt-0.5 text-[11px] text-sub">{money(currentAsset, krw, rate)}</div>
          </div>
          <div className="rounded-xl bg-bg p-3 text-center">
            <div className="text-xs text-sub">D-Day</div>
            <div className={`mt-1 text-2xl font-extrabold tabular-nums ${ddayColor}`}>
              {dday > 0 ? `D-${dday.toLocaleString()}` : dday === 0 ? 'D-Day' : `D+${Math.abs(dday)}`}
            </div>
            <div className="mt-0.5 text-[11px] text-sub">{goalConfig.targetDate}</div>
          </div>
          <div className="rounded-xl bg-bg p-3 text-center">
            <div className="text-xs text-sub">예상 달성 (중립)</div>
            <div className="mt-1 text-sm font-extrabold leading-snug text-brand">
              {neuAm >= 0 ? monthToStr(neuAm) : '기간 초과'}
            </div>
            <div className="mt-0.5 text-[11px] text-sub">{goalConfig.style}</div>
          </div>
        </div>
      </div>

      {/* Scenario chart */}
      <GoalScenarioChart
        currentAsset={currentAsset} targetAmount={goalConfig.targetAmount} history={history}
        optimisticProj={optimisticProj} neutralProj={neutralProj} conservativeProj={conservativeProj}
        totalMonths={totalMonths} now={now} krw={krw} rate={rate}
        optimisticAchieveMonth={optAm} neutralAchieveMonth={neuAm} conservativeAchieveMonth={conAm}
      />

      {/* Required return + monthly check-in */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RequiredReturnCard
          requiredAnnualRate={requiredAnnual} neutralRate={neutralRate}
          totalMonths={totalMonths} goalConfig={goalConfig} krw={krw} rate={rate}
        />
        <MonthlyCheckin history={history} neutralProj={neutralProj} krw={krw} rate={rate} />
      </div>
    </div>
  );
}

