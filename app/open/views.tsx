'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AiInsightItem, HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';
import { EarningsPanel, TickerDetail } from './panels';
import {
  colorClass,
  daysSince,
  earningsSymbolMatches,
  money,
  pct,
  usd,
  type EarningsItem,
  type PaperAccount,
  type PaperTrade,
  type Price,
  type PriceMap,
  type PriceSession,
} from './model';

type HoldingRow = HoldingItem & {
  price: number;
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  dayPct: number;
  weight: number;
  priceSession?: PriceSession;
  priceSource?: Price['source'];
  regularPrice?: number;
  extendedPrice?: number;
  regularChangePercent?: number;
  extendedChangePercent?: number;
};

type SortKey = 'ticker' | 'price' | 'shares' | 'avgCost' | 'value' | 'pnl' | 'pnlPct' | 'dayPct' | 'weight';
type SortDir = 'asc' | 'desc';
type AlertLevel = 'danger' | 'warning' | 'success';
type PriceAlert = { ticker: string; label: string; message: string; level: AlertLevel };
type PaperSnapshot = {
  account: PaperAccount;
  holdings: Array<{
    ticker: string;
    shares: number;
    avgCost: number;
    price: number;
    value: number;
    cost: number;
    pnl: number;
    pnlPct: number;
    dayPct: number;
    weight: number;
    totalWeight: number;
    priceSession?: PriceSession;
    priceSource?: Price['source'];
  }>;
  trades: PaperTrade[];
  summary: {
    cash: number;
    stockValue: number;
    totalAsset: number;
    totalCost: number;
    unrealizedPnl: number;
    realizedPnl: number;
    totalPnl: number;
    totalPnlPct: number;
    tradeCount: number;
  };
};

function compactUsd(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function priceSessionText(session?: PriceSession) {
  if (session === 'pre') return '프리장';
  if (session === 'post') return '애프터장';
  if (session === 'regular') return '정규장';
  return '종가 기준';
}

function priceSessionClass(session?: PriceSession) {
  if (session === 'pre') return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200';
  if (session === 'post') return 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-200';
  if (session === 'regular') return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200';
  return 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

function PriceSessionBadge({ session }: { session?: PriceSession }) {
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${priceSessionClass(session)}`}>
      {priceSessionText(session)}
    </span>
  );
}

function PriceChangeStack({
  quote,
  fallbackPct,
}: {
  quote?: Pick<Price, 'changePercent' | 'regularChangePercent' | 'extendedChangePercent' | 'session'>;
  fallbackPct?: number;
}) {
  const regularPct = quote?.regularChangePercent ?? fallbackPct ?? quote?.changePercent;
  const isExtended = quote?.session === 'pre' || quote?.session === 'post';
  const extendedPct = isExtended ? quote?.extendedChangePercent ?? quote?.changePercent : undefined;
  const extendedLabel = quote?.session === 'pre' ? 'p' : quote?.session === 'post' ? 'a' : '';
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`text-xs font-semibold ${regularPct === undefined ? 'text-sub' : colorClass(regularPct)}`}>
        {regularPct === undefined ? '-' : pct(regularPct)}
      </span>
      {extendedLabel && extendedPct !== undefined ? (
        <span className={`text-[11px] font-bold ${colorClass(extendedPct)}`}>
          {extendedLabel} {pct(extendedPct)}
        </span>
      ) : null}
    </div>
  );
}

const darkTooltip = {
  background: '#020617',
  border: '1px solid #1e293b',
  borderRadius: 12,
  color: '#e2e8f0',
};

export function PortfolioView(props: {
  rows: HoldingRow[];
  summary: { stockValue: number; totalCost: number; totalPnl: number; totalPnlPct: number; dayPnl: number; totalAsset: number };
  cash: number;
  krw: boolean;
  rate: number;
  onEditCash: () => void;
  onEdit: (item: HoldingItem) => void;
  onDelete: (ticker: string) => void;
  onRecord: () => void;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  theme: 'light' | 'dark';
  earnings: EarningsItem[];
  loadingEarnings: boolean;
  onRefreshEarnings: () => void;
  tickerMemos: Record<string, string>;
  onSaveMemo: (ticker: string, text: string) => void;
  aiInsights: AiInsightItem[];
  onSaveAiInsight: (item: Omit<AiInsightItem, 'id'> & { id?: string }) => void;
  onDeleteAiInsight: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [mobileTicker, setMobileTicker] = useState('');
  const sortedRows = useMemo(() => {
    return [...props.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const result = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : Number(av || 0) - Number(bv || 0);
      return sortDir === 'asc' ? result : -result;
    });
  }, [props.rows, sortDir, sortKey]);
  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  };
  const sortMark = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  const alerts = makePriceAlerts(props.rows);
  const holdingTickers = new Set(props.rows.map((r) => r.ticker));
  const holdingEarnings = props.earnings.filter((item) =>
    Array.from(holdingTickers).some((ticker) => earningsSymbolMatches(ticker, item.symbol))
  );
  const selectedRow = props.rows.find((row) => row.ticker === props.selectedTicker) ?? props.rows[0];
  const detailTicker = props.selectedTicker || selectedRow?.ticker || '';
  const mobileRow = props.rows.find((row) => row.ticker === mobileTicker);
  const maxRiskLoss = props.rows.reduce((sum, r) => {
    if (!r.price || !r.stopLoss || r.price <= r.stopLoss) return sum;
    return sum + (r.price - r.stopLoss) * r.shares;
  }, 0);
  const cards = [
    ['주식 평가금액', money(props.summary.stockValue, props.krw, props.rate), `매수 ${money(props.summary.totalCost, props.krw, props.rate)}`, 'text-brand'],
    ['누적 손익', money(props.summary.totalPnl, props.krw, props.rate), pct(props.summary.totalPnlPct), colorClass(props.summary.totalPnl)],
    ['오늘 손익', money(props.summary.dayPnl, props.krw, props.rate), '실시간 시세 기준', colorClass(props.summary.dayPnl)],
    ['예수금', money(props.cash, props.krw, props.rate), '클릭해서 수정', 'text-brand'],
    ['총 자산', money(props.summary.totalAsset, props.krw, props.rate), '주식 + 예수금', 'text-brand'],
    ...(maxRiskLoss > 0 ? [['손절 시 최대손실', `-${money(maxRiskLoss, props.krw, props.rate)}`, `총 자산의 ${props.summary.totalAsset > 0 ? ((maxRiskLoss / props.summary.totalAsset) * 100).toFixed(1) : 0}%`, 'text-rose-600']] : []),
  ];
  const openMobileTicker = (ticker: string) => {
    props.onSelectTicker(ticker);
    setMobileTicker(ticker);
  };
  return (
    <section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
      <div className={`grid gap-3 ${cards.length === 6 ? 'sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'md:grid-cols-5'}`}>
        {cards.map(([label, value, sub, color]) => (
          <button key={label} type="button" onClick={label === '예수금' ? props.onEditCash : undefined} className={`rounded-xl border border-border bg-card p-4 text-left shadow-sm ${label === '예수금' ? 'cursor-pointer hover:border-brand/50' : 'cursor-default'}`}>
            <div className="text-xs font-semibold uppercase text-sub">{label}</div>
            <div className={`mt-2 text-xl font-extrabold ${color}`}>{value}</div>
            <div className="mt-1 text-xs text-sub">{sub}</div>
          </button>
        ))}
      </div>
      <PriceAlerts alerts={alerts} />
      <AiInsightPanel
        insights={props.aiInsights}
        tickers={props.rows.map((row) => row.ticker)}
        onSave={props.onSaveAiInsight}
        onDelete={props.onDeleteAiInsight}
        category="portfolio"
      />
      <div className="space-y-3 sm:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">보유 종목</h2>
          <button onClick={props.onRecord} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold">오늘 기록</button>
        </div>
        {sortedRows.map((r) => (
          <div key={r.ticker} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
            <button type="button" onClick={() => openMobileTicker(r.ticker)} className="w-full text-left">
              <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-lg text-brand">{r.ticker}</strong>
                  <HoldingDaysBadge buyDate={r.buyDate || r.lastBuyDate} />
                </div>
                {r.name && <div className="mt-0.5 truncate text-xs text-sub">{r.name}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold">{r.price ? usd(r.price) : '-'}</div>
                <div className="mt-1 flex flex-col items-end gap-1">
                  {r.price ? (
                    <PriceChangeStack
                      quote={{
                        changePercent: r.dayPct,
                        regularChangePercent: r.regularChangePercent,
                        extendedChangePercent: r.extendedChangePercent,
                        session: r.priceSession,
                      }}
                      fallbackPct={r.dayPct}
                    />
                  ) : <span className="text-xs font-semibold text-sub">-</span>}
                  {r.price ? <PriceSessionBadge session={r.priceSession} /> : null}
                </div>
              </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">평가</div>
                <div className="mt-1 font-bold">{r.price ? money(r.value, props.krw, props.rate) : '-'}</div>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">손익</div>
                <div className={`mt-1 font-bold ${colorClass(r.pnl)}`}>{r.price ? money(r.pnl, props.krw, props.rate) : '-'}</div>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">수익률</div>
                <div className={`mt-1 font-bold ${colorClass(r.pnlPct)}`}>{r.price ? pct(r.pnlPct) : '-'}</div>
              </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-sub">
              <span>수량 {r.shares} · 비중 {r.weight.toFixed(1)}%</span>
              <span>{r.targetPrice ? `목표 ${usd(r.targetPrice)}` : '목표 없음'}</span>
              </div>
            </button>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => props.onEdit(r)} className="rounded-md border border-border px-2 py-1 text-xs font-bold text-brand">수정</button>
              <button type="button" onClick={() => props.onDelete(r.ticker)} className="rounded-md border border-rose-200 px-2 py-1 text-xs font-bold text-rose-600">삭제</button>
            </div>
          </div>
        ))}
        {!props.rows.length && <div className="rounded-xl bg-card p-10 text-center text-sm text-sub">보유 종목이 없습니다.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm sm:block">
        <div className="no-print flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-bold">보유 종목</span>
          <button onClick={props.onRecord} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold">오늘 기록</button>
        </div>
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-bg text-xs text-sub">
            <tr>
              <SortableTh label={`티커${sortMark('ticker')}`} onClick={() => setSort('ticker')} align="left" />
              <SortableTh label={`현재가${sortMark('price')}`} onClick={() => setSort('price')} />
              <SortableTh label={`수량${sortMark('shares')}`} onClick={() => setSort('shares')} />
              <SortableTh label={`평단${sortMark('avgCost')}`} onClick={() => setSort('avgCost')} />
              <SortableTh label={`평가금액${sortMark('value')}`} onClick={() => setSort('value')} />
              <SortableTh label={`손익${sortMark('pnl')}`} onClick={() => setSort('pnl')} />
              <SortableTh label={`수익률${sortMark('pnlPct')}`} onClick={() => setSort('pnlPct')} />
              <SortableTh label={`오늘${sortMark('dayPct')}`} onClick={() => setSort('dayPct')} />
              <th className="px-3 py-3 text-right">목표/손절</th>
              <th className="px-3 py-3 text-right"><RRHeader /></th>
              <SortableTh label={`비중${sortMark('weight')}`} onClick={() => setSort('weight')} />
              <th className="px-3 py-3 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.ticker} onClick={() => props.onSelectTicker(r.ticker)} className="cursor-pointer border-t border-border hover:bg-bg">
                <td className="px-3 py-3 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-brand">{r.ticker}</strong>
                    <HoldingDaysBadge buyDate={r.buyDate || r.lastBuyDate} />
                  </div>
                  <div className="text-xs text-sub">{r.name}</div>
                </td>
                <td className="px-3 py-3 text-right font-semibold">
                  {r.price ? <div className="flex flex-col items-end gap-1"><span>{usd(r.price)}</span><PriceSessionBadge session={r.priceSession} /></div> : '-'}
                </td>
                <td className="px-3 py-3 text-right">{r.shares}</td>
                <td className="px-3 py-3 text-right text-sub">{usd(r.avgCost)}</td>
                <td className="px-3 py-3 text-right font-semibold">{r.price ? money(r.value, props.krw, props.rate) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${colorClass(r.pnl)}`}>{r.price ? money(r.pnl, props.krw, props.rate) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${colorClass(r.pnlPct)}`}>{r.price ? pct(r.pnlPct) : '-'}</td>
                <td className="px-3 py-3 text-right">
                  {r.price ? (
                    <PriceChangeStack
                      quote={{
                        changePercent: r.dayPct,
                        regularChangePercent: r.regularChangePercent,
                        extendedChangePercent: r.extendedChangePercent,
                        session: r.priceSession,
                      }}
                      fallbackPct={r.dayPct}
                    />
                  ) : '-'}
                </td>
                <td className="px-3 py-3 text-right text-xs text-sub"><TargetStopCell row={r} /></td>
                <td className="px-3 py-3 text-right text-xs font-semibold"><RRCell row={r} /></td>
                <td className="px-3 py-3 text-right">{r.weight.toFixed(1)}%</td>
                <td className="px-3 py-3 text-right">
                  <button onClick={(event) => { event.stopPropagation(); props.onEdit(r); }} className="no-print mr-2 text-brand">수정</button>
                  <button onClick={(event) => { event.stopPropagation(); props.onDelete(r.ticker); }} className="no-print text-rose-600">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.rows.length && <div className="p-12 text-center text-sm text-sub">보유 종목이 없습니다.</div>}
      </div>
      <div className="hidden gap-4 sm:grid xl:hidden lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <PositionPathChart row={selectedRow} />
          <TickerDetail ticker={detailTicker} theme={props.theme} earnings={holdingEarnings} memo={props.tickerMemos[detailTicker] ?? selectedRow?.note ?? ''} aiInsights={props.aiInsights.filter((item) => (item.category ?? 'portfolio') === 'portfolio' && item.scope === 'ticker' && item.ticker === detailTicker)} onSaveMemo={detailTicker ? (text) => props.onSaveMemo(detailTicker, text) : undefined} />
        </div>
        <EarningsPanel earnings={holdingEarnings} loading={props.loadingEarnings} onRefresh={props.onRefreshEarnings} />
      </div>
        </div>
        <aside className="hidden xl:block xl:self-start">
          <div
            className="fixed bottom-6 top-24 z-20 w-[380px] space-y-4 overflow-y-auto pr-1"
            style={{ right: 'max(1.5rem, calc((100vw - 1540px) / 2 + 1.5rem))' }}
          >
            <PositionPathChart row={selectedRow} />
            <TickerDetail ticker={detailTicker} theme={props.theme} earnings={holdingEarnings} memo={props.tickerMemos[detailTicker] ?? selectedRow?.note ?? ''} aiInsights={props.aiInsights.filter((item) => (item.category ?? 'portfolio') === 'portfolio' && item.scope === 'ticker' && item.ticker === detailTicker)} onSaveMemo={detailTicker ? (text) => props.onSaveMemo(detailTicker, text) : undefined} />
            <EarningsPanel earnings={holdingEarnings} loading={props.loadingEarnings} onRefresh={props.onRefreshEarnings} />
          </div>
        </aside>
      </div>
      <MobileTickerSheet
        open={Boolean(mobileTicker)}
        onClose={() => setMobileTicker('')}
        ticker={mobileTicker}
        theme={props.theme}
        earnings={holdingEarnings}
        memo={mobileTicker ? props.tickerMemos[mobileTicker] ?? mobileRow?.note ?? '' : ''}
        aiInsights={mobileTicker ? props.aiInsights.filter((item) => (item.category ?? 'portfolio') === 'portfolio' && item.scope === 'ticker' && item.ticker === mobileTicker) : []}
        onSaveMemo={mobileTicker ? (text) => props.onSaveMemo(mobileTicker, text) : undefined}
        extra={mobileRow ? <PositionPathChart row={mobileRow} /> : null}
      />
    </section>
  );
}

function PositionPathChart({ row }: { row?: HoldingRow }) {
  if (!row || !row.price || (!row.targetPrice && !row.stopLoss)) return null;
  const lower = Math.min(row.stopLoss || row.price, row.avgCost, row.price, row.targetPrice || row.price);
  const upper = Math.max(row.stopLoss || row.price, row.avgCost, row.price, row.targetPrice || row.price);
  const span = Math.max(upper - lower, 1);
  const data = [
    { label: '손절', value: row.stopLoss || lower, type: 'stop' },
    { label: '평단', value: row.avgCost, type: 'avg' },
    { label: '현재', value: row.price, type: 'now' },
    { label: '목표', value: row.targetPrice || upper, type: 'target' },
  ].filter((item) => item.value > 0).map((item) => ({
    ...item,
    floor: Math.max(0, lower - span * 0.12),
  }));
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">{row.ticker} 가격 경로</h3>
          <p className="mt-1 text-xs text-slate-400">손절가, 평단, 현재가, 목표가의 위치</p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-bold ${row.pnl >= 0 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/30 bg-rose-400/10 text-rose-200'}`}>
          {pct(row.pnlPct)}
        </div>
      </div>
      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id={`positionPath-${row.ticker}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={compactUsd} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={58} domain={['dataMin', 'dataMax']} />
            <Tooltip formatter={(value) => [usd(Number(value)), '가격']} contentStyle={darkTooltip} labelStyle={{ color: '#cbd5e1' }} />
            {row.stopLoss ? <ReferenceLine y={row.stopLoss} stroke="#fb7185" strokeDasharray="5 5" /> : null}
            {row.targetPrice ? <ReferenceLine y={row.targetPrice} stroke="#34d399" strokeDasharray="5 5" /> : null}
            <Area type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={3} fill={`url(#positionPath-${row.ticker})`} dot={{ r: 4, fill: '#38bdf8' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MobileTickerSheet({
  open,
  onClose,
  ticker,
  theme,
  earnings,
  memo,
  aiInsights = [],
  onSaveMemo,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  ticker: string;
  theme: 'light' | 'dark';
  earnings: EarningsItem[];
  memo: string;
  aiInsights?: AiInsightItem[];
  onSaveMemo?: (text: string) => void;
  extra?: ReactNode;
}) {
  if (!open || !ticker) return null;
  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      <button type="button" aria-label="상세 닫기" onClick={onClose} className="absolute inset-0 bg-slate-950/55" />
      <section
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[28px] border border-slate-800 bg-slate-950 p-3 pb-6 shadow-2xl"
        style={{ animation: 'mobileSheetUp 220ms ease-out' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-700" />
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg font-extrabold text-slate-100">{ticker}</h2>
            <p className="text-xs text-slate-400">상세 차트와 메모</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300">닫기</button>
        </div>
        <div className="space-y-3">
          {extra}
          <TickerDetail ticker={ticker} theme={theme} earnings={earnings} memo={memo} aiInsights={aiInsights} onSaveMemo={onSaveMemo} />
        </div>
      </section>
    </div>
  );
}

function AiInsightPanel({
  insights,
  tickers,
  onSave,
  onDelete,
  category,
  panelTitle = 'ChatGPT 분석 기록',
  description = 'ChatGPT 답변을 붙여넣어 전체 포트폴리오나 티커별 메모로 보관합니다.',
}: {
  insights: AiInsightItem[];
  tickers: string[];
  onSave: (item: Omit<AiInsightItem, 'id'> & { id?: string }) => void;
  onDelete: (id: string) => void;
  category: NonNullable<AiInsightItem['category']>;
  panelTitle?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<AiInsightItem | null>(null);
  const [scope, setScope] = useState<AiInsightItem['scope']>('portfolio');
  const [ticker, setTicker] = useState(tickers[0] ?? '');
  const [content, setContent] = useState('');
  const panelInsights = insights.filter((item) => (item.category ?? 'portfolio') === category);
  const insightTitle = (item: AiInsightItem) => item.title || (item.ticker ? `${item.ticker} AI 분석` : category === 'watchlist' ? '관심 종목 AI 분석' : '포트폴리오 AI 분석');
  const submit = () => {
    onSave({
      date: new Date().toISOString().slice(0, 10),
      category,
      scope,
      ticker: scope === 'ticker' ? ticker : undefined,
      title: '',
      content,
      source: 'ChatGPT',
    });
    setContent('');
    setOpen(false);
  };
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-100">{panelTitle}</h2>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">
          {open ? '닫기' : '답변 붙여넣기'}
        </button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-400">
              저장 위치
              <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none" value={scope} onChange={(e) => setScope(e.target.value as AiInsightItem['scope'])}>
                <option value="portfolio">전체 포트폴리오</option>
                <option value="ticker">특정 티커</option>
              </select>
            </label>
            {scope === 'ticker' && (
              <label className="block text-xs font-bold text-slate-400">
                티커
                <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-100 outline-none" value={ticker} onChange={(e) => setTicker(e.target.value)}>
                  {tickers.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
          </div>
          <div>
            <textarea className="h-56 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm leading-6 text-slate-100 outline-none" value={content} placeholder="ChatGPT 답변을 여기에 붙여넣으세요." onChange={(e) => setContent(e.target.value)} />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setContent('')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300">비우기</button>
              <button type="button" onClick={submit} disabled={!content.trim()} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-40">저장</button>
            </div>
          </div>
        </div>
      )}
      {panelInsights.length > 0 && (
        <div className="mt-4 max-h-80 overflow-y-auto pr-1">
          <div className="grid gap-2 md:grid-cols-3">
          {panelInsights.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setSelectedInsight(item)} className="min-w-0 flex-1 text-left">
                  <div className="text-[11px] font-bold text-slate-400">{item.date} · {item.ticker ?? '전체'}</div>
                  <h3 className="mt-1 truncate text-sm font-bold text-slate-100">{insightTitle(item)}</h3>
                </button>
                <button type="button" onClick={() => onDelete(item.id)} className="text-xs font-bold text-rose-300">삭제</button>
              </div>
              <button type="button" onClick={() => setSelectedInsight(item)} className="mt-2 block w-full text-left">
                <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-400">{item.content}</p>
                <span className="mt-2 inline-flex text-xs font-bold text-sky-300">크게 보기</span>
              </button>
            </article>
          ))}
          </div>
        </div>
      )}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <section className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-400">{selectedInsight.date} · {selectedInsight.ticker ?? '전체 포트폴리오'} · {selectedInsight.source ?? 'ChatGPT'}</div>
                <h3 className="mt-1 text-lg font-extrabold text-slate-100">{insightTitle(selectedInsight)}</h3>
              </div>
              <button type="button" onClick={() => setSelectedInsight(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300">닫기</button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{selectedInsight.content}</p>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PriceAlerts({ alerts }: { alerts: PriceAlert[] }) {
  if (!alerts.length) return null;
  return (
    <section className="grid gap-2 md:grid-cols-2">
      {alerts.map((alert) => (
        <button
          key={`${alert.ticker}-${alert.label}`}
          type="button"
          className={`rounded-xl border px-4 py-3 text-left shadow-sm ${
            alert.level === 'danger'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : alert.level === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <div className="text-xs font-bold">{alert.ticker} · {alert.label}</div>
          <div className="mt-1 text-sm font-semibold">{alert.message}</div>
        </button>
      ))}
    </section>
  );
}

function makePriceAlerts(rows: HoldingRow[]) {
  const threshold = 5;
  const alerts: PriceAlert[] = [];
  rows.forEach((row) => {
    if (!row.price) return;
    if (row.targetPrice) {
      const distance = ((row.targetPrice - row.price) / row.price) * 100;
      if (distance <= 0) {
        alerts.push({ ticker: row.ticker, label: '목표가', level: 'success', message: `${usd(row.price)}로 목표가 ${usd(row.targetPrice)}를 초과했습니다.` });
      } else if (distance <= threshold) {
        alerts.push({ ticker: row.ticker, label: '목표가 근접', level: 'warning', message: `목표가 ${usd(row.targetPrice)}까지 ${pct(distance)} 남았습니다.` });
      }
    }
    if (row.stopLoss) {
      const distance = ((row.price - row.stopLoss) / row.price) * 100;
      if (distance <= 0) {
        alerts.push({ ticker: row.ticker, label: '손절가', level: 'danger', message: `${usd(row.price)}로 손절가 ${usd(row.stopLoss)}를 이탈했습니다.` });
      } else if (distance <= threshold) {
        alerts.push({ ticker: row.ticker, label: '손절가 근접', level: 'warning', message: `손절가 ${usd(row.stopLoss)}까지 ${pct(distance)} 여유입니다.` });
      }
    }
  });
  return alerts;
}

function makeWatchPriceAlerts(watch: WatchItem[], prices: PriceMap) {
  const threshold = 5;
  const alerts: PriceAlert[] = [];
  watch.forEach((item) => {
    const price = prices[item.ticker]?.price;
    if (!price || !item.targetBuy) return;
    const distance = ((price - item.targetBuy) / price) * 100;
    if (distance <= 0) {
      alerts.push({
        ticker: item.ticker,
        label: '목표 진입가 도달',
        level: 'success',
        message: `${usd(price)}로 목표 진입가 ${usd(item.targetBuy)} 이하에 도달했습니다.`,
      });
    } else if (distance <= threshold) {
      alerts.push({
        ticker: item.ticker,
        label: '목표 진입가 근접',
        level: 'warning',
        message: `목표 진입가 ${usd(item.targetBuy)}까지 ${pct(distance)} 남았습니다.`,
      });
    }
  });
  return alerts;
}

function HoldingDaysBadge({ buyDate }: { buyDate?: string | null }) {
  const days = daysSince(buyDate);
  if (days === null) return null;
  return (
    <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-bold text-sub">
      D+{String(days).padStart(2, '0')}
    </span>
  );
}

export function WatchView({
  watch,
  prices,
  onAdd,
  onEdit,
  onDelete,
  onSelectTicker,
  selectedTicker,
  theme,
  earnings,
  loadingEarnings,
  onRefreshEarnings,
  onExportTradingView,
  tickerMemos,
  onSaveMemo,
  aiInsights = [],
  onSaveAiInsight,
  onDeleteAiInsight,
}: {
  watch: WatchItem[];
  prices: PriceMap;
  onAdd: () => void;
  onEdit: (item: WatchItem) => void;
  onDelete: (ticker: string) => void;
  onSelectTicker: (ticker: string) => void;
  selectedTicker: string;
  theme: 'light' | 'dark';
  earnings: EarningsItem[];
  loadingEarnings: boolean;
  onRefreshEarnings: () => void;
  onExportTradingView: () => void;
  tickerMemos: Record<string, string>;
  onSaveMemo: (ticker: string, text: string) => void;
  aiInsights?: AiInsightItem[];
  onSaveAiInsight?: (item: Omit<AiInsightItem, 'id'> & { id?: string }) => void;
  onDeleteAiInsight?: (id: string) => void;
}) {
  const [mobileTicker, setMobileTicker] = useState('');
  const watchTickers = new Set(watch.map((item) => item.ticker));
  const watchEarnings = earnings.filter((item) => Array.from(watchTickers).some((ticker) => earningsSymbolMatches(ticker, item.symbol)));
  const alerts = makeWatchPriceAlerts(watch, prices);
  const detailTicker = selectedTicker || watch[0]?.ticker || '';
  const openMobileTicker = (ticker: string) => {
    onSelectTicker(ticker);
    setMobileTicker(ticker);
  };
  return (
    <section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button onClick={onAdd} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">관심 종목 추가</button>
        <button onClick={onExportTradingView} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">TradingView 복사</button>
      </div>
      <PriceAlerts alerts={alerts} />
      {onSaveAiInsight && onDeleteAiInsight && (
        <AiInsightPanel
          insights={aiInsights}
          tickers={watch.map((item) => item.ticker)}
          onSave={onSaveAiInsight}
          onDelete={onDeleteAiInsight}
          category="watchlist"
          panelTitle="관심 종목 ChatGPT 분석"
          description="관심 종목에 대한 ChatGPT 답변을 붙여넣고 티커별 분석으로 보관합니다."
        />
      )}
      <WatchDistanceChart watch={watch} prices={prices} />
      <div className="space-y-3 sm:hidden">
        {watch.map((w) => {
          const price = prices[w.ticker]?.price;
          const dist = (price && w.targetBuy) ? ((price - w.targetBuy) / price) * 100 : null;
          return (
            <button key={w.ticker} type="button" onClick={() => openMobileTicker(w.ticker)} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="text-lg text-brand">{w.ticker}</strong>
                  {w.name && <div className="mt-0.5 truncate text-xs text-sub">{w.name}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold">{price ? usd(price) : '-'}</div>
                  <div className="mt-1 flex flex-col items-end gap-1">
                    <PriceChangeStack quote={prices[w.ticker]} />
                    {price ? <PriceSessionBadge session={prices[w.ticker]?.session} /> : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-bg p-2">
                  <div className="text-sub">목표 진입가</div>
                  <div className="mt-1 font-bold">{w.targetBuy ? usd(w.targetBuy) : '-'}</div>
                </div>
                <div className="rounded-xl bg-bg p-2">
                  <div className="text-sub">거리</div>
                  <div className={`mt-1 font-bold ${dist === null ? '' : dist <= 0 ? 'text-emerald-600' : dist <= 5 ? 'text-amber-500' : 'text-sub'}`}>
                    {dist === null ? '-' : dist <= 0 ? '도달' : `+${dist.toFixed(1)}%`}
                  </div>
                </div>
              </div>
              {w.note && <div className="mt-3 line-clamp-2 text-xs text-sub">{w.note}</div>}
              <div className="mt-3 flex justify-end gap-2">
                <span onClick={(e) => { e.stopPropagation(); onEdit(w); }} className="rounded-md border border-border px-2 py-1 text-xs font-bold text-brand">수정</span>
                <span onClick={(e) => { e.stopPropagation(); onDelete(w.ticker); }} className="rounded-md border border-rose-200 px-2 py-1 text-xs font-bold text-rose-600">삭제</span>
              </div>
            </button>
          );
        })}
        {!watch.length && <div className="rounded-xl bg-card p-10 text-center text-sm text-sub">관심 종목이 없습니다.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">현재가</th><th className="px-3 py-3 text-right">목표 진입가</th><th className="px-3 py-3 text-right">거리</th><th className="px-3 py-3 text-right">오늘</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{watch.map((w) => {
            const price = prices[w.ticker]?.price;
            const dist = (price && w.targetBuy) ? ((price - w.targetBuy) / price) * 100 : null;
            return (
              <tr key={w.ticker} onClick={() => onSelectTicker(w.ticker)} className="cursor-pointer border-t border-border hover:bg-bg">
                <td className="px-3 py-3"><strong className="text-brand">{w.ticker}</strong><div className="text-xs text-sub">{w.name}</div></td>
                <td className="px-3 py-3 text-right font-semibold">
                  {price ? <div className="flex flex-col items-end gap-1"><span>{usd(price)}</span><PriceSessionBadge session={prices[w.ticker]?.session} /></div> : '-'}
                </td>
                <td className="px-3 py-3 text-right">{w.targetBuy ? usd(w.targetBuy) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${dist === null ? '' : dist <= 0 ? 'text-emerald-600' : dist <= 5 ? 'text-amber-500' : 'text-sub'}`}>
                  {dist === null ? '-' : dist <= 0 ? '도달' : `+${dist.toFixed(1)}%`}
                </td>
                <td className="px-3 py-3 text-right">{prices[w.ticker] ? <PriceChangeStack quote={prices[w.ticker]} /> : '-'}</td>
                <td className="px-3 py-3 text-sub">{w.note || '-'}</td>
                <td className="px-3 py-3 text-right"><button onClick={(event) => { event.stopPropagation(); onEdit(w); }} className="no-print mr-2 text-brand">수정</button><button onClick={(event) => { event.stopPropagation(); onDelete(w.ticker); }} className="no-print text-rose-600">삭제</button></td>
              </tr>
            );
          })}</tbody>
        </table>
        {!watch.length && <div className="p-12 text-center text-sm text-sub">관심 종목이 없습니다.</div>}
      </div>
      <div className="hidden gap-4 sm:grid xl:hidden lg:grid-cols-[1fr_360px]">
        <TickerDetail ticker={detailTicker} theme={theme} earnings={watchEarnings} memo={tickerMemos[detailTicker] ?? ''} aiInsights={aiInsights.filter((item) => item.category === 'watchlist' && item.scope === 'ticker' && item.ticker === detailTicker)} onSaveMemo={detailTicker ? (text) => onSaveMemo(detailTicker, text) : undefined} />
        <EarningsPanel earnings={watchEarnings} loading={loadingEarnings} onRefresh={onRefreshEarnings} />
      </div>
        </div>
        <aside className="hidden xl:block xl:self-start">
          <div
            className="fixed bottom-6 top-24 z-20 w-[380px] space-y-4 overflow-y-auto pr-1"
            style={{ right: 'max(1.5rem, calc((100vw - 1540px) / 2 + 1.5rem))' }}
          >
            <TickerDetail ticker={detailTicker} theme={theme} earnings={watchEarnings} memo={tickerMemos[detailTicker] ?? ''} aiInsights={aiInsights.filter((item) => item.category === 'watchlist' && item.scope === 'ticker' && item.ticker === detailTicker)} onSaveMemo={detailTicker ? (text) => onSaveMemo(detailTicker, text) : undefined} />
            <EarningsPanel earnings={watchEarnings} loading={loadingEarnings} onRefresh={onRefreshEarnings} />
          </div>
        </aside>
      </div>
      <MobileTickerSheet
        open={Boolean(mobileTicker)}
        onClose={() => setMobileTicker('')}
        ticker={mobileTicker}
        theme={theme}
        earnings={watchEarnings}
        memo={mobileTicker ? tickerMemos[mobileTicker] ?? '' : ''}
        aiInsights={mobileTicker ? aiInsights.filter((item) => item.category === 'watchlist' && item.scope === 'ticker' && item.ticker === mobileTicker) : []}
        onSaveMemo={mobileTicker ? (text) => onSaveMemo(mobileTicker, text) : undefined}
      />
    </section>
  );
}

function WatchDistanceChart({ watch, prices }: { watch: WatchItem[]; prices: PriceMap }) {
  const data = watch
    .map((item) => {
      const price = prices[item.ticker]?.price;
      if (!price || !item.targetBuy) return null;
      const distance = ((price - item.targetBuy) / price) * 100;
      return {
        ticker: item.ticker,
        distance,
        price,
        targetBuy: item.targetBuy,
      };
    })
    .filter((item): item is { ticker: string; distance: number; price: number; targetBuy: number } => Boolean(item))
    .sort((a, b) => a.distance - b.distance);
  if (!data.length) return null;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">관심 종목 진입 거리</h3>
          <p className="mt-1 text-xs text-slate-400">현재가가 목표 진입가까지 얼마나 남았는지 비교</p>
        </div>
        <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">
          {data.length}개 추적
        </div>
      </div>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="ticker" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(value, name, item) => {
                const payload = item.payload as { price: number; targetBuy: number };
                return [`${Number(value).toFixed(1)}% · 현재 ${usd(payload.price)} / 목표 ${usd(payload.targetBuy)}`, '진입 거리'];
              }}
              contentStyle={darkTooltip}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <ReferenceLine y={0} stroke="#34d399" strokeDasharray="5 5" label={{ value: '도달', fill: '#86efac', fontSize: 11, position: 'insideTopRight' }} />
            <Bar dataKey="distance" radius={[8, 8, 0, 0]}>
              {data.map((item) => (
                <Cell key={item.ticker} fill={item.distance <= 0 ? '#34d399' : item.distance <= 5 ? '#f59e0b' : '#38bdf8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function isCashFlowJournal(item: JournalItem) {
  return item.action === 'deposit' || item.action === 'withdraw';
}

function journalAmount(item: JournalItem) {
  return isCashFlowJournal(item) ? item.price : item.shares * item.price;
}

function journalActionLabel(action: JournalItem['action']) {
  if (action === 'buy') return '매수';
  if (action === 'sell') return '매도';
  if (action === 'deposit') return '입금';
  return '출금';
}

function journalActionClass(action: JournalItem['action']) {
  if (action === 'buy') return 'bg-blue-50 text-blue-700';
  if (action === 'sell') return 'bg-rose-50 text-rose-700';
  if (action === 'deposit') return 'bg-emerald-50 text-emerald-700';
  return 'bg-amber-50 text-amber-700';
}

function journalAmountClass(action: JournalItem['action']) {
  if (action === 'buy') return 'text-blue-600';
  if (action === 'sell') return 'text-rose-600';
  if (action === 'deposit') return 'text-emerald-600';
  return 'text-amber-600';
}

function JournalSummary({ journal }: { journal: JournalItem[] }) {
  const tradeJournal = journal.filter((j) => j.action === 'buy' || j.action === 'sell');
  const sells = tradeJournal.filter((j) => j.action === 'sell');
  const totalBuyMap: Record<string, { cost: number; shares: number }> = {};
  tradeJournal.filter((j) => j.action === 'buy').forEach((j) => {
    if (!totalBuyMap[j.ticker]) totalBuyMap[j.ticker] = { cost: 0, shares: 0 };
    totalBuyMap[j.ticker].cost += j.shares * j.price;
    totalBuyMap[j.ticker].shares += j.shares;
  });
  let realizedPnl = 0;
  let wins = 0;
  const strategyStats: Record<string, { wins: number; total: number }> = {};
  sells.forEach((j) => {
    const buy = totalBuyMap[j.ticker];
    if (!buy || !buy.shares) return;
    const avgCost = buy.cost / buy.shares;
    const pnlAmt = (j.price - avgCost) * j.shares - (j.fee || 0);
    realizedPnl += pnlAmt;
    const isWin = pnlAmt > 0;
    if (isWin) wins++;
    if (j.strategy) {
      if (!strategyStats[j.strategy]) strategyStats[j.strategy] = { wins: 0, total: 0 };
      strategyStats[j.strategy].total++;
      if (isWin) strategyStats[j.strategy].wins++;
    }
  });
  const winRate = sells.length ? (wins / sells.length) * 100 : 0;
  const totalBuy = tradeJournal.filter((j) => j.action === 'buy').reduce((s, j) => s + j.shares * j.price, 0);
  const totalSell = sells.reduce((s, j) => s + j.shares * j.price, 0);
  const totalDeposit = journal.filter((j) => j.action === 'deposit').reduce((s, j) => s + j.price, 0);
  const totalWithdraw = journal.filter((j) => j.action === 'withdraw').reduce((s, j) => s + j.price, 0);
  const strategyEntries = Object.entries(strategyStats).sort((a, b) => b[1].total - a[1].total);
  const summaryCards = [
    ['총 매수 금액', usd(totalBuy), 'text-blue-600'],
    ['총 매도 금액', usd(totalSell), 'text-rose-600'],
    ['실현 손익', usd(realizedPnl), colorClass(realizedPnl)],
    ['매도 승률', `${winRate.toFixed(0)}% (${wins}/${sells.length})`, colorClass(winRate - 50)],
    ['예수금 입금', usd(totalDeposit), 'text-emerald-600'],
    ['예수금 출금', usd(totalWithdraw), 'text-amber-600'],
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase text-sub">{label}</div>
            <div className={`mt-2 text-lg font-extrabold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      {strategyEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase text-sub mb-3">전략별 승률</div>
          <div className="flex flex-wrap gap-2">
            {strategyEntries.map(([strategy, { wins: w, total }]) => {
              const wr = (w / total) * 100;
              return (
                <div key={strategy} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-semibold">{strategy}</span>
                  <span className={`ml-2 font-bold ${colorClass(wr - 50)}`}>{wr.toFixed(0)}%</span>
                  <span className="ml-1 text-xs text-sub">({w}/{total})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function JournalView({ journal, onAdd, onEdit, onDelete }: { journal: JournalItem[]; onAdd: () => void; onEdit: (item: JournalItem) => void; onDelete: (id: string) => void }) {
  const sorted = [...journal].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
      <button onClick={onAdd} className="no-print rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">거래 추가</button>
      <JournalSummary journal={journal} />
      <JournalFlowChart journal={journal} />
      <MonthlyPnlCalendar journal={journal} />
      <div className="space-y-3 sm:hidden">
        {sorted.map((j) => (
          <div key={j.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-sub">{j.date}</div>
                <div className="mt-1 flex items-center gap-2">
                  <strong>{isCashFlowJournal(j) ? '예수금' : j.ticker}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${journalActionClass(j.action)}`}>{journalActionLabel(j.action)}</span>
                </div>
              </div>
              <div className={`text-right font-bold ${journalAmountClass(j.action)}`}>{usd(journalAmount(j))}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">수량</div>
                <div className="mt-1 font-bold">{isCashFlowJournal(j) ? '-' : j.shares}</div>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">{isCashFlowJournal(j) ? '금액' : '단가'}</div>
                <div className="mt-1 font-bold">{usd(j.price)}</div>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">전략</div>
                <div className="mt-1 truncate font-bold">{j.strategy || '-'}</div>
              </div>
            </div>
            {j.note && <div className="mt-3 line-clamp-2 text-xs text-sub">{j.note}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => onEdit(j)} className="rounded-md border border-border px-2 py-1 text-xs font-bold text-brand">수정</button>
              <button onClick={() => onDelete(j.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs font-bold text-rose-600">삭제</button>
            </div>
          </div>
        ))}
        {!journal.length && <div className="rounded-xl bg-card p-10 text-center text-sm text-sub">거래 기록이 없습니다.</div>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">날짜</th><th className="px-3 py-3">구분</th><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">수량</th><th className="px-3 py-3 text-right">단가/금액</th><th className="px-3 py-3 text-right">금액</th><th className="px-3 py-3 text-left">전략</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{sorted.map((j) => <tr key={j.id} className="border-t border-border"><td className="px-3 py-3">{j.date}</td><td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-bold ${journalActionClass(j.action)}`}>{journalActionLabel(j.action)}</span></td><td className="px-3 py-3 font-bold">{isCashFlowJournal(j) ? '-' : j.ticker}</td><td className="px-3 py-3 text-right">{isCashFlowJournal(j) ? '-' : j.shares}</td><td className="px-3 py-3 text-right">{usd(j.price)}</td><td className={`px-3 py-3 text-right font-semibold ${journalAmountClass(j.action)}`}>{usd(journalAmount(j))}</td><td className="px-3 py-3">{j.strategy ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{j.strategy}</span> : <span className="text-sub">-</span>}</td><td className="px-3 py-3 text-sub">{j.note || '-'}</td><td className="px-3 py-3 text-right"><button onClick={() => onEdit(j)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(j.id)} className="no-print text-rose-600">삭제</button></td></tr>)}</tbody>
        </table>
        {!journal.length && <div className="p-12 text-center text-sm text-sub">거래 기록이 없습니다.</div>}
      </div>
      </div>
      <aside className="hidden xl:block xl:self-start">
        <JournalSidePanel journal={journal} onAdd={onAdd} />
      </aside>
    </section>
  );
}

function JournalSidePanel({ journal, onAdd }: { journal: JournalItem[]; onAdd: () => void }) {
  const month = new Date().toISOString().slice(0, 7);
  const monthItems = journal.filter((item) => item.date.startsWith(month));
  const trades = journal.filter((item) => item.action === 'buy' || item.action === 'sell');
  const sells = trades.filter((item) => item.action === 'sell');
  const recent = [...journal].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const cashFlows = monthItems.filter(isCashFlowJournal);
  const monthDeposit = cashFlows.filter((item) => item.action === 'deposit').reduce((sum, item) => sum + item.price, 0);
  const monthWithdraw = cashFlows.filter((item) => item.action === 'withdraw').reduce((sum, item) => sum + item.price, 0);
  const buyMap: Record<string, { cost: number; shares: number }> = {};
  trades.filter((item) => item.action === 'buy').forEach((item) => {
    if (!buyMap[item.ticker]) buyMap[item.ticker] = { cost: 0, shares: 0 };
    buyMap[item.ticker].cost += item.shares * item.price;
    buyMap[item.ticker].shares += item.shares;
  });
  let realized = 0;
  let wins = 0;
  const strategy: Record<string, { pnl: number; count: number }> = {};
  const sellReviews: Array<{ item: JournalItem; pnl: number; avg: number }> = [];
  sells.forEach((item) => {
    const buy = buyMap[item.ticker];
    const avg = buy?.shares ? buy.cost / buy.shares : item.price;
    const pnl = (item.price - avg) * item.shares - (item.fee || 0);
    realized += pnl;
    if (pnl > 0) wins += 1;
    sellReviews.push({ item, pnl, avg });
    const key = item.strategy || '전략 없음';
    if (!strategy[key]) strategy[key] = { pnl: 0, count: 0 };
    strategy[key].pnl += pnl;
    strategy[key].count += 1;
  });
  const strategyRows = Object.entries(strategy).sort((a, b) => b[1].pnl - a[1].pnl);
  const noMemo = trades.filter((item) => !item.note);
  const noStrategy = trades.filter((item) => !item.strategy);
  const tickerCounts = trades.reduce<Record<string, number>>((acc, item) => {
    acc[item.ticker] = (acc[item.ticker] || 0) + 1;
    return acc;
  }, {});
  const activeTickers = Object.entries(tickerCounts).filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const lossReviews = sellReviews.filter((row) => row.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 3);
  return (
    <div
      className="fixed bottom-6 top-24 z-20 w-[360px] space-y-4 overflow-y-auto pr-1"
      style={{ right: 'max(1.5rem, calc((100vw - 1540px) / 2 + 1.5rem))' }}
    >
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-100">매매 복기 패널</h2>
            <p className="mt-1 text-xs text-slate-400">이번 달 성과와 바로 점검할 거래를 모았습니다.</p>
          </div>
          <button onClick={onAdd} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white">추가</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs text-slate-400">이번 달 기록</div>
            <div className="mt-1 text-lg font-extrabold text-slate-100">{monthItems.length}건</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs text-slate-400">매도 승률</div>
            <div className={`mt-1 text-lg font-extrabold ${colorClass((sells.length ? wins / sells.length : 0) * 100 - 50)}`}>{sells.length ? `${Math.round((wins / sells.length) * 100)}%` : '-'}</div>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs text-slate-400">실현 손익</div>
            <div className={`mt-1 text-xl font-extrabold ${colorClass(realized)}`}>{usd(realized)}</div>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs text-slate-400">이번 달 예수금 흐름</div>
            <div className="mt-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-emerald-400">입금 {usd(monthDeposit)}</span>
              <span className="font-bold text-amber-400">출금 {usd(monthWithdraw)}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <h3 className="font-bold text-slate-100">최근 거래</h3>
        <div className="mt-3 space-y-2">
          {recent.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-900/70 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-200">{item.date} · {isCashFlowJournal(item) ? '예수금' : item.ticker}</span>
                <span className={`rounded-full px-2 py-0.5 font-bold ${journalActionClass(item.action)}`}>{journalActionLabel(item.action)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-slate-400">
                <span className="truncate">{item.strategy || item.note || '전략/메모 없음'}</span>
                <strong className={journalAmountClass(item.action)}>{usd(journalAmount(item))}</strong>
              </div>
            </div>
          ))}
          {!recent.length && <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-400">거래를 입력하면 최근 기록이 표시됩니다.</div>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <h3 className="font-bold text-slate-100">전략별 성과</h3>
        <div className="mt-3 space-y-2">
          {strategyRows.slice(0, 4).map(([name, stat]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 p-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-slate-300">{name}</span>
                <span className="text-xs text-slate-500">매도 {stat.count}회</span>
              </span>
              <strong className={colorClass(stat.pnl)}>{usd(stat.pnl)}</strong>
            </div>
          ))}
          {!strategyRows.length && <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-400">매도 기록이 쌓이면 전략별 성과가 표시됩니다.</div>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <h3 className="font-bold text-slate-100">손실 매도 점검</h3>
        <div className="mt-3 space-y-2">
          {lossReviews.map(({ item, pnl, avg }) => (
            <div key={item.id} className="rounded-xl bg-slate-900/70 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-200">{item.date} · {item.ticker}</span>
                <strong className={colorClass(pnl)}>{usd(pnl)}</strong>
              </div>
              <div className="mt-1 text-slate-400">평단 {usd(avg)} → 매도 {usd(item.price)}</div>
              <div className="mt-1 line-clamp-2 text-slate-500">{item.note || '손절 이유를 메모로 남기면 다음 매매 때 참고하기 좋습니다.'}</div>
            </div>
          ))}
          {!lossReviews.length && <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-400">손실 매도 기록이 없습니다. 수익 실현과 보유 판단에 집중하면 됩니다.</div>}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <h3 className="font-bold text-slate-100">체크포인트</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="rounded-xl bg-slate-900/70 p-3 text-slate-300">
            메모 없는 거래 <strong className={noMemo.length ? 'text-amber-300' : 'text-emerald-300'}>{noMemo.length}건</strong>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-3 text-slate-300">
            전략 태그 없는 거래 <strong className={noStrategy.length ? 'text-amber-300' : 'text-emerald-300'}>{noStrategy.length}건</strong>
          </div>
          <div className="rounded-xl bg-slate-900/70 p-3 text-slate-300">
            반복 거래 티커{' '}
            <strong className={activeTickers.length ? 'text-sky-300' : 'text-slate-500'}>
              {activeTickers.length ? activeTickers.map(([ticker, count]) => `${ticker} ${count}회`).join(', ') : '없음'}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PaperTradingView({
  accounts,
  snapshots,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onExport,
  onImport,
  onImportText,
  onClonePortfolio,
  krw,
  rate,
}: {
  accounts: PaperAccount[];
  snapshots: PaperSnapshot[];
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  onAddAccount: () => void;
  onEditAccount: (item: PaperAccount) => void;
  onDeleteAccount: (id: string) => void;
  onAddTrade: () => void;
  onEditTrade: (item: PaperTrade) => void;
  onDeleteTrade: (id: string) => void;
  onExport: (accountId: string) => void;
  onImport: (file: File) => void;
  onImportText: (text: string) => void;
  onClonePortfolio: () => void;
  krw: boolean;
  rate: number;
}) {
  const [importKey, setImportKey] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const selected = snapshots.find((item) => item.account.id === selectedAccountId) ?? snapshots[0];
  const ranking = [...snapshots].sort((a, b) => b.summary.totalPnlPct - a.summary.totalPnlPct);
  const importPrompt = `아래 JSON 스키마에 맞춰 모의투자 데이터를 만들어줘. 실제 포트폴리오 AI export와 섞지 말고, 모의투자 전용으로만 작성해줘.

필수 규칙:
- schemaVersion은 "1.0"
- exportPurpose는 "paper_trading"
- accounts 배열에는 계좌 1개만 넣어줘. id, name, owner, initialCash, createdAt을 포함해줘
- trades 배열의 accountId는 accounts의 id와 반드시 일치해야 해
- action은 "buy" 또는 "sell"만 사용해
- ticker는 대문자로 써줘
- fee는 달러 기준 실제 수수료 금액이야

예시:
{
  "schemaVersion": "1.0",
  "exportPurpose": "paper_trading",
  "accounts": [
    {
      "id": "gpt-account",
      "name": "GPT 계좌",
      "owner": "GPT",
      "initialCash": 100000,
      "createdAt": "2026-05-14",
      "note": "GPT와 투자내기용 모의계좌"
    }
  ],
  "trades": [
    {
      "id": "gpt-trade-1",
      "accountId": "gpt-account",
      "date": "2026-05-14",
      "action": "buy",
      "ticker": "NVDA",
      "shares": 5,
      "price": 920.5,
      "fee": 11.51,
      "strategy": "earnings momentum",
      "thesis": "실적 기대와 AI 인프라 수요 지속",
      "risk": "실적 발표 후 차익실현 가능성",
      "scenario": "목표 구간까지 분할 매도",
      "review": "",
      "note": "GPT 추천 매수"
    }
  ]
}`;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">모의투자</h2>
            <p className="mt-1 text-xs text-sub">계좌별로 실계좌와 분리해서 투자 아이디어를 기록합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onAddTrade} disabled={!accounts.length} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-40">거래 추가</button>
            <button onClick={onAddAccount} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">계좌 추가</button>
          </div>
        </div>

        <details className="mt-3 rounded-xl border border-border bg-bg">
          <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-sub">데이터 관리</summary>
          <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-5">
            <button onClick={() => selected && onExport(selected.account.id)} disabled={!selected} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold disabled:opacity-40">계좌 내보내기</button>
            <label className="cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-bold">
              파일 가져오기
              <input
                key={importKey}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(file);
                  setImportKey((v) => v + 1);
                }}
              />
            </label>
            <button onClick={() => setShowPasteImport((v) => !v)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold">JSON 붙여넣기</button>
            <button onClick={() => setShowPrompt((v) => !v)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold">AI 입력 예시</button>
            <button onClick={onClonePortfolio} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold">실계좌 복사</button>
          </div>
        </details>
      </div>

      {showPrompt && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">AI에게 줄 모의투자 JSON 작성 프롬프트</h3>
              <p className="mt-1 text-xs text-sub">GPT에게 이 형식으로 작성하게 한 뒤, 결과 JSON 파일을 모의 가져오기로 불러오면 됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(importPrompt)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-brand"
            >
              복사
            </button>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{importPrompt}</pre>
        </div>
      )}

      {showPasteImport && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">모의투자 JSON 붙여넣기</h3>
              <p className="mt-1 text-xs text-sub">GPT가 만든 계좌별 JSON을 붙여넣으면 같은 계좌만 새 내용으로 교체됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.readText().then((text) => setPasteJson(text))}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-brand"
            >
              클립보드 붙여넣기
            </button>
          </div>
          <textarea
            className="mt-3 h-72 w-full resize-y rounded-xl border border-border bg-bg p-3 font-mono text-xs outline-none focus:border-brand"
            value={pasteJson}
            placeholder='{"schemaVersion":"1.0","exportPurpose":"paper_trading","accounts":[],"trades":[]}'
            onChange={(e) => setPasteJson(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setPasteJson('')} className="rounded-lg border border-border px-3 py-2 text-sm font-bold text-sub">비우기</button>
            <button
              type="button"
              onClick={() => {
                onImportText(pasteJson);
                setShowPasteImport(false);
                setPasteJson('');
              }}
              disabled={!pasteJson.trim()}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              붙여넣은 JSON 불러오기
            </button>
          </div>
        </div>
      )}

      {!accounts.length ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-bold">모의투자 계좌가 없습니다</h2>
          <p className="mt-2 text-sm text-sub">내 모의계좌나 GPT 계좌를 만들어서 실계좌와 분리된 투자 기록을 시작하세요.</p>
          <button onClick={onAddAccount} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">첫 계좌 만들기</button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase text-sky-300">Paper Trading</div>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-100">{selected?.account.name}</h2>
                  <p className="mt-1 text-xs text-slate-400">{selected?.account.owner || '소유자 미지정'} · 시작일 {selected?.account.createdAt}</p>
                </div>
                {selected && (
                  <div className="flex flex-col items-end gap-2">
                    <div className={`rounded-full border px-3 py-1 text-xs font-bold ${selected.summary.totalPnl >= 0 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/30 bg-rose-400/10 text-rose-200'}`}>
                      {pct(selected.summary.totalPnlPct)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onEditAccount(selected.account)} className="rounded-md border border-slate-700 px-2 py-1 text-xs font-bold text-slate-300">수정</button>
                      <button onClick={() => onDeleteAccount(selected.account.id)} className="rounded-md border border-rose-400/30 px-2 py-1 text-xs font-bold text-rose-300">삭제</button>
                    </div>
                  </div>
                )}
              </div>
              {selected && (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <PaperMetric label="총자산" value={money(selected.summary.totalAsset, krw, rate)} />
                  <PaperMetric label="현금" value={money(selected.summary.cash, krw, rate)} />
                  <PaperMetric label="평가금액" value={money(selected.summary.stockValue, krw, rate)} />
                  <PaperMetric label="총손익" value={money(selected.summary.totalPnl, krw, rate)} color={colorClass(selected.summary.totalPnl)} />
                  <PaperMetric label="실현손익" value={money(selected.summary.realizedPnl, krw, rate)} color={colorClass(selected.summary.realizedPnl)} />
                  <PaperMetric label="미실현손익" value={money(selected.summary.unrealizedPnl, krw, rate)} color={colorClass(selected.summary.unrealizedPnl)} />
                  <PaperMetric label="거래 수" value={`${selected.summary.tradeCount}건`} />
                  <PaperMetric label="시작 현금" value={money(selected.account.initialCash, krw, rate)} />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold">계좌 랭킹</h3>
                <span className="text-xs text-sub">{accounts.length}개</span>
              </div>
              <div className="space-y-2">
                {ranking.map((item, index) => (
                  <button key={item.account.id} onClick={() => onSelectAccount(item.account.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.account.id === item.account.id ? 'border-brand bg-brand/5' : 'border-border bg-bg'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-sub">#{index + 1}</div>
                        <div className="truncate font-bold">{item.account.name}</div>
                      </div>
                      <div className={`text-right font-extrabold ${colorClass(item.summary.totalPnlPct)}`}>{pct(item.summary.totalPnlPct)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selected && (
            <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-bg text-xs text-sub">
                    <tr><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">현재가</th><th className="px-3 py-3 text-right">수량</th><th className="px-3 py-3 text-right">평단</th><th className="px-3 py-3 text-right">평가금액</th><th className="px-3 py-3 text-right">손익</th><th className="px-3 py-3 text-right">비중</th></tr>
                  </thead>
                  <tbody>
                    {selected.holdings.map((row) => (
                      <tr key={row.ticker} className="border-t border-border">
                        <td className="px-3 py-3 font-bold text-brand">{row.ticker}</td>
                        <td className="px-3 py-3 text-right">{money(row.price, krw, rate)}</td>
                        <td className="px-3 py-3 text-right">{row.shares.toFixed(4).replace(/\.?0+$/, '')}</td>
                        <td className="px-3 py-3 text-right">{money(row.avgCost, krw, rate)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{money(row.value, krw, rate)}</td>
                        <td className={`px-3 py-3 text-right font-semibold ${colorClass(row.pnl)}`}>{money(row.pnl, krw, rate)}<div className="text-xs">{pct(row.pnlPct)}</div></td>
                        <td className="px-3 py-3 text-right">{row.weight.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selected.holdings.length && <div className="p-10 text-center text-sm text-sub">보유 중인 모의 종목이 없습니다.</div>}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-bold">거래/복기 기록</h3>
                <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {selected.trades.map((trade) => (
                    <div key={trade.id} className="rounded-xl border border-border bg-bg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-sub">{trade.date}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <strong>{trade.ticker}</strong>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${trade.action === 'buy' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>{trade.action === 'buy' ? '매수' : '매도'}</span>
                          </div>
                        </div>
                        <div className={`text-right font-bold ${trade.action === 'buy' ? 'text-blue-600' : 'text-rose-600'}`}>{money(trade.shares * trade.price, krw, rate)}</div>
                      </div>
                      <div className="mt-2 text-xs text-sub">수량 {trade.shares} · 단가 {money(trade.price, krw, rate)} · {trade.strategy || '전략 없음'}</div>
                      {trade.thesis && <p className="mt-2 text-xs leading-5 text-sub">근거: {trade.thesis}</p>}
                      {trade.risk && <p className="mt-1 text-xs leading-5 text-sub">리스크: {trade.risk}</p>}
                      {trade.review && <p className="mt-1 text-xs leading-5 text-sub">복기: {trade.review}</p>}
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => onEditTrade(trade)} className="rounded-md border border-border px-2 py-1 text-xs font-bold text-brand">수정</button>
                        <button onClick={() => onDeleteTrade(trade.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs font-bold text-rose-600">삭제</button>
                      </div>
                    </div>
                  ))}
                  {!selected.trades.length && <div className="rounded-xl bg-bg p-8 text-center text-sm text-sub">모의 거래 기록이 없습니다.</div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PaperMetric({ label, value, color = 'text-slate-100' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function JournalFlowChart({ journal }: { journal: JournalItem[] }) {
  const data = useMemo(() => {
    const sortedJ = [...journal].sort((a, b) => a.date.localeCompare(b.date));
    const avgCostMap: Record<string, { cost: number; shares: number }> = {};
    const months: Record<string, { month: string; buy: number; sell: number; realized: number; deposit: number; withdraw: number }> = {};
    for (const item of sortedJ) {
      const month = item.date.slice(0, 7);
      if (!months[month]) months[month] = { month, buy: 0, sell: 0, realized: 0, deposit: 0, withdraw: 0 };
      if (item.action === 'deposit') {
        months[month].deposit += item.price;
        continue;
      }
      if (item.action === 'withdraw') {
        months[month].withdraw += item.price;
        continue;
      }
      const amount = item.shares * item.price;
      if (item.action === 'buy') {
        months[month].buy += amount;
        if (!avgCostMap[item.ticker]) avgCostMap[item.ticker] = { cost: 0, shares: 0 };
        avgCostMap[item.ticker].cost += amount;
        avgCostMap[item.ticker].shares += item.shares;
      } else {
        months[month].sell += amount;
        const entry = avgCostMap[item.ticker];
        const avgCost = entry?.shares ? entry.cost / entry.shares : item.price;
        months[month].realized += (item.price - avgCost) * item.shares - (item.fee || 0);
        if (entry) {
          const usedCost = avgCost * item.shares;
          entry.cost = Math.max(0, entry.cost - usedCost);
          entry.shares = Math.max(0, entry.shares - item.shares);
        }
      }
    }
    return Object.values(months).slice(-12);
  }, [journal]);
  if (!data.length) return null;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">매매 흐름</h3>
          <p className="mt-1 text-xs text-slate-400">월별 매수·매도 금액과 실현 손익</p>
        </div>
        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">
          최근 {data.length}개월
        </div>
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={(value) => String(value).slice(2)} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={compactUsd} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
            <Tooltip
              formatter={(value, name) => {
                const labels: Record<string, string> = { buy: '매수', sell: '매도', realized: '실현 손익', deposit: '예수금 입금', withdraw: '예수금 출금' };
                return [usd(Number(value)), labels[String(name)] ?? String(name)];
              }}
              contentStyle={darkTooltip}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <ReferenceLine y={0} stroke="#334155" />
            <Bar dataKey="buy" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="sell" fill="#fb7185" radius={[8, 8, 0, 0]} />
            <Bar dataKey="deposit" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar dataKey="withdraw" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            <Bar dataKey="realized" radius={[8, 8, 0, 0]}>
              {data.map((item) => (
                <Cell key={item.month} fill={item.realized >= 0 ? '#34d399' : '#f43f5e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        <span><b className="text-blue-400">■</b> 매수</span>
        <span><b className="text-rose-400">■</b> 매도</span>
        <span><b className="text-emerald-400">■</b> 입금</span>
        <span><b className="text-amber-400">■</b> 출금</span>
        <span><b className="text-emerald-400">■</b> 실현 손익</span>
      </div>
    </div>
  );
}

function MonthlyPnlCalendar({ journal }: { journal: JournalItem[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { pnlByDate, activityByDate } = useMemo(() => {
    const sortedJ = [...journal].sort((a, b) => a.date.localeCompare(b.date));
    const avgCostMap: Record<string, { cost: number; shares: number }> = {};
    const pnlByDate: Record<string, number> = {};
    const activityByDate: Record<string, 'buy' | 'sell' | 'cash' | 'both'> = {};
    for (const j of sortedJ) {
      if (j.action === 'deposit' || j.action === 'withdraw') {
        if (!activityByDate[j.date]) activityByDate[j.date] = 'cash';
        else if (activityByDate[j.date] !== 'cash') activityByDate[j.date] = 'both';
      } else if (j.action === 'buy') {
        if (!avgCostMap[j.ticker]) avgCostMap[j.ticker] = { cost: 0, shares: 0 };
        avgCostMap[j.ticker].cost += j.shares * j.price;
        avgCostMap[j.ticker].shares += j.shares;
        if (!activityByDate[j.date]) activityByDate[j.date] = 'buy';
        else if (activityByDate[j.date] !== 'buy') activityByDate[j.date] = 'both';
      } else {
        const entry = avgCostMap[j.ticker];
        const avgCost = entry?.shares ? entry.cost / entry.shares : j.price;
        const pnl = (j.price - avgCost) * j.shares - (j.fee || 0);
        pnlByDate[j.date] = (pnlByDate[j.date] ?? 0) + pnl;
        if (!activityByDate[j.date]) activityByDate[j.date] = 'sell';
        else if (activityByDate[j.date] !== 'sell') activityByDate[j.date] = 'both';
      }
    }
    return { pnlByDate, activityByDate };
  }, [journal]);

  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7));
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setMonth((m) => {
    const d = new Date(m + '-01T00:00:00');
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const nextMonth = () => setMonth((m) => {
    const d = new Date(m + '-01T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">월별 손익 달력</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded border border-border px-2 py-1 text-xs font-bold">◀</button>
          <span className="min-w-[70px] text-center text-sm font-semibold">{month}</span>
          <button onClick={nextMonth} className="rounded border border-border px-2 py-1 text-xs font-bold">▶</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="py-1 text-center font-semibold text-sub">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`pad-${i}`} />;
          const dateStr = `${month}-${String(d).padStart(2, '0')}`;
          const pnl = pnlByDate[dateStr];
          const activity = activityByDate[dateStr];
          let bg = '';
          if (pnl !== undefined && pnl > 0) bg = 'bg-emerald-50 text-emerald-800';
          else if (pnl !== undefined && pnl < 0) bg = 'bg-rose-50 text-rose-800';
          else if (activity === 'buy') bg = 'bg-blue-50 text-blue-700';
          else if (activity === 'cash') bg = 'bg-amber-50 text-amber-700';
          const isToday = dateStr === todayStr;
          return (
            <div key={d} className={`flex min-h-[44px] flex-col items-center justify-start gap-0.5 rounded p-1 ${bg} ${isToday ? 'ring-1 ring-brand' : ''}`}>
              <span className={`font-semibold leading-none ${isToday ? 'text-brand' : ''}`}>{d}</span>
              {pnl !== undefined && (
                <span className="text-[9px] font-bold leading-none">{pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-sub">
        <span><b className="text-emerald-600">■</b> 매도 익절</span>
        <span><b className="text-rose-600">■</b> 매도 손절</span>
        <span><b className="text-blue-500">■</b> 매수만</span>
        <span><b className="text-amber-500">■</b> 입출금</span>
      </div>
    </div>
  );
}

function SortableTh({ label, onClick, align = 'right' }: { label: string; onClick: () => void; align?: 'left' | 'right' }) {
  return (
    <th className={`px-3 py-3 ${align === 'left' ? 'text-left' : 'text-right'}`}>
      <button type="button" onClick={onClick} className="font-semibold hover:text-brand">
        {label}
      </button>
    </th>
  );
}

function TargetStopCell({ row }: { row: HoldingRow }) {
  const targetHit = Boolean(row.price && row.targetPrice && row.price >= row.targetPrice);
  const stopHit = Boolean(row.price && row.stopLoss && row.price <= row.stopLoss);
  if (!row.targetPrice && !row.stopLoss) return <span>-</span>;
  return (
    <div className="space-y-1">
      {row.targetPrice ? <div>목표 {usd(row.targetPrice)}</div> : null}
      {row.stopLoss ? <div>손절 {usd(row.stopLoss)}</div> : null}
      {targetHit && <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">목표 도달</span>}
      {stopHit && <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">손절 이탈</span>}
    </div>
  );
}

function RRCell({ row }: { row: HoldingRow }) {
  if (!row.price || !row.targetPrice || !row.stopLoss) return <span className="text-sub">-</span>;
  const risk = row.price - row.stopLoss;
  const reward = row.targetPrice - row.price;
  if (risk <= 0 || reward <= 0) return <span className="text-sub">-</span>;
  const rr = reward / risk;
  const color = rr >= 2 ? 'text-emerald-600' : rr >= 1 ? 'text-amber-500' : 'text-rose-600';
  return <span className={color}>{rr.toFixed(1)}R</span>;
}

function RRHeader() {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center justify-end gap-1">
      R:R
      <span className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold text-sub hover:border-brand hover:text-brand"
        >
          ?
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-6 z-20 w-64 rounded-xl border border-border bg-card p-4 text-left text-xs shadow-xl">
              <div className="mb-2 font-bold text-text">손익비 (Risk : Reward)</div>
              <div className="leading-5 text-sub">
                현재가를 기준으로 <b className="text-text">목표가까지 수익</b>과 <b className="text-text">손절가까지 손실</b>의 비율입니다.
                숫자가 클수록 같은 리스크에 더 많은 수익을 기대할 수 있습니다.
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2"><span className="font-extrabold text-emerald-600">2R 이상</span><span className="text-sub">— 우수 (목표 수익 ≥ 리스크 2배)</span></div>
                <div className="flex items-center gap-2"><span className="font-extrabold text-amber-500">1R ~ 2R</span><span className="text-sub">— 보통</span></div>
                <div className="flex items-center gap-2"><span className="font-extrabold text-rose-600">1R 미만</span><span className="text-sub">— 주의 (리스크 대비 수익 작음)</span></div>
              </div>
            </div>
          </>
        )}
      </span>
    </span>
  );
}
