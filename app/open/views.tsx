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
import type { HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';
import { EarningsPanel, TickerDetail } from './panels';
import {
  colorClass,
  daysSince,
  earningsSymbolMatches,
  money,
  pct,
  usd,
  type EarningsItem,
  type PriceMap,
} from './model';

type HoldingRow = HoldingItem & {
  price: number;
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  dayPct: number;
  weight: number;
};

type SortKey = 'ticker' | 'price' | 'shares' | 'avgCost' | 'value' | 'pnl' | 'pnlPct' | 'dayPct' | 'weight';
type SortDir = 'asc' | 'desc';
type AlertLevel = 'danger' | 'warning' | 'success';
type PriceAlert = { ticker: string; label: string; message: string; level: AlertLevel };

function compactUsd(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
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
    <section className="space-y-4">
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
      <div className="space-y-3 sm:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">보유 종목</h2>
          <button onClick={props.onRecord} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold">오늘 기록</button>
        </div>
        {sortedRows.map((r) => (
          <button key={r.ticker} type="button" onClick={() => openMobileTicker(r.ticker)} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
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
                <div className={`text-xs font-semibold ${colorClass(r.dayPct)}`}>{r.price ? pct(r.dayPct) : '-'}</div>
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
              <tr key={r.ticker} className="border-t border-border hover:bg-bg">
                <td className="px-3 py-3 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-brand">{r.ticker}</strong>
                    <HoldingDaysBadge buyDate={r.buyDate || r.lastBuyDate} />
                  </div>
                  <div className="text-xs text-sub">{r.name}</div>
                </td>
                <td className="px-3 py-3 text-right font-semibold">{r.price ? usd(r.price) : '-'}</td>
                <td className="px-3 py-3 text-right">{r.shares}</td>
                <td className="px-3 py-3 text-right text-sub">{usd(r.avgCost)}</td>
                <td className="px-3 py-3 text-right font-semibold">{r.price ? money(r.value, props.krw, props.rate) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${colorClass(r.pnl)}`}>{r.price ? money(r.pnl, props.krw, props.rate) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${colorClass(r.pnlPct)}`}>{r.price ? pct(r.pnlPct) : '-'}</td>
                <td className={`px-3 py-3 text-right ${colorClass(r.dayPct)}`}>{r.price ? pct(r.dayPct) : '-'}</td>
                <td className="px-3 py-3 text-right text-xs text-sub"><TargetStopCell row={r} /></td>
                <td className="px-3 py-3 text-right text-xs font-semibold"><RRCell row={r} /></td>
                <td className="px-3 py-3 text-right">{r.weight.toFixed(1)}%</td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => props.onSelectTicker(r.ticker)} className="no-print mr-2 text-slate-700">상세</button>
                  <button onClick={() => props.onEdit(r)} className="no-print mr-2 text-brand">수정</button>
                  <button onClick={() => props.onDelete(r.ticker)} className="no-print text-rose-600">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.rows.length && <div className="p-12 text-center text-sm text-sub">보유 종목이 없습니다.</div>}
      </div>
      <div className="hidden gap-4 sm:grid lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <PositionPathChart row={selectedRow} />
          <TickerDetail ticker={props.selectedTicker} theme={props.theme} earnings={holdingEarnings} memo={props.tickerMemos[props.selectedTicker] ?? props.rows.find((r) => r.ticker === props.selectedTicker)?.note ?? ''} onSaveMemo={props.selectedTicker ? (text) => props.onSaveMemo(props.selectedTicker, text) : undefined} />
        </div>
        <EarningsPanel earnings={holdingEarnings} loading={props.loadingEarnings} onRefresh={props.onRefreshEarnings} />
      </div>
      <MobileTickerSheet
        open={Boolean(mobileTicker)}
        onClose={() => setMobileTicker('')}
        ticker={mobileTicker}
        theme={props.theme}
        earnings={holdingEarnings}
        memo={mobileTicker ? props.tickerMemos[mobileTicker] ?? mobileRow?.note ?? '' : ''}
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
  onSaveMemo,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  ticker: string;
  theme: 'light' | 'dark';
  earnings: EarningsItem[];
  memo: string;
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
          <TickerDetail ticker={ticker} theme={theme} earnings={earnings} memo={memo} onSaveMemo={onSaveMemo} />
        </div>
      </section>
    </div>
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
}) {
  const [mobileTicker, setMobileTicker] = useState('');
  const watchTickers = new Set(watch.map((item) => item.ticker));
  const watchEarnings = earnings.filter((item) => Array.from(watchTickers).some((ticker) => earningsSymbolMatches(ticker, item.symbol)));
  const alerts = makeWatchPriceAlerts(watch, prices);
  const openMobileTicker = (ticker: string) => {
    onSelectTicker(ticker);
    setMobileTicker(ticker);
  };
  return (
    <section className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button onClick={onAdd} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">관심 종목 추가</button>
        <button onClick={onExportTradingView} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">TradingView 복사</button>
      </div>
      <PriceAlerts alerts={alerts} />
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
                  <div className={`text-xs font-semibold ${colorClass(prices[w.ticker]?.changePercent ?? 0)}`}>{prices[w.ticker] ? pct(prices[w.ticker].changePercent ?? 0) : '-'}</div>
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
              <tr key={w.ticker} className="border-t border-border hover:bg-bg">
                <td className="px-3 py-3"><strong className="text-brand">{w.ticker}</strong><div className="text-xs text-sub">{w.name}</div></td>
                <td className="px-3 py-3 text-right font-semibold">{price ? usd(price) : '-'}</td>
                <td className="px-3 py-3 text-right">{w.targetBuy ? usd(w.targetBuy) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${dist === null ? '' : dist <= 0 ? 'text-emerald-600' : dist <= 5 ? 'text-amber-500' : 'text-sub'}`}>
                  {dist === null ? '-' : dist <= 0 ? '도달' : `+${dist.toFixed(1)}%`}
                </td>
                <td className={`px-3 py-3 text-right ${colorClass(prices[w.ticker]?.changePercent ?? 0)}`}>{prices[w.ticker] ? pct(prices[w.ticker].changePercent ?? 0) : '-'}</td>
                <td className="px-3 py-3 text-sub">{w.note || '-'}</td>
                <td className="px-3 py-3 text-right"><button onClick={() => onSelectTicker(w.ticker)} className="no-print mr-2 text-slate-700">상세</button><button onClick={() => onEdit(w)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(w.ticker)} className="no-print text-rose-600">삭제</button></td>
              </tr>
            );
          })}</tbody>
        </table>
        {!watch.length && <div className="p-12 text-center text-sm text-sub">관심 종목이 없습니다.</div>}
      </div>
      <div className="hidden gap-4 sm:grid lg:grid-cols-[1fr_360px]">
        <TickerDetail ticker={selectedTicker} theme={theme} earnings={watchEarnings} memo={tickerMemos[selectedTicker] ?? ''} onSaveMemo={selectedTicker ? (text) => onSaveMemo(selectedTicker, text) : undefined} />
        <EarningsPanel earnings={watchEarnings} loading={loadingEarnings} onRefresh={onRefreshEarnings} />
      </div>
      <MobileTickerSheet
        open={Boolean(mobileTicker)}
        onClose={() => setMobileTicker('')}
        ticker={mobileTicker}
        theme={theme}
        earnings={watchEarnings}
        memo={mobileTicker ? tickerMemos[mobileTicker] ?? '' : ''}
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

function JournalSummary({ journal }: { journal: JournalItem[] }) {
  const sells = journal.filter((j) => j.action === 'sell');
  if (!sells.length) return null;
  const totalBuyMap: Record<string, { cost: number; shares: number }> = {};
  journal.filter((j) => j.action === 'buy').forEach((j) => {
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
  const totalBuy = journal.filter((j) => j.action === 'buy').reduce((s, j) => s + j.shares * j.price, 0);
  const totalSell = sells.reduce((s, j) => s + j.shares * j.price, 0);
  const strategyEntries = Object.entries(strategyStats).sort((a, b) => b[1].total - a[1].total);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['총 매수 금액', usd(totalBuy), 'text-blue-600'],
          ['총 매도 금액', usd(totalSell), 'text-rose-600'],
          ['실현 손익', usd(realizedPnl), colorClass(realizedPnl)],
          ['매도 승률', `${winRate.toFixed(0)}% (${wins}/${sells.length})`, colorClass(winRate - 50)],
        ].map(([label, value, color]) => (
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
    <section className="space-y-4">
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
                  <strong>{j.ticker}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${j.action === 'buy' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>{j.action === 'buy' ? '매수' : '매도'}</span>
                </div>
              </div>
              <div className={`text-right font-bold ${j.action === 'buy' ? 'text-blue-600' : 'text-rose-600'}`}>{usd(j.shares * j.price)}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">수량</div>
                <div className="mt-1 font-bold">{j.shares}</div>
              </div>
              <div className="rounded-xl bg-bg p-2">
                <div className="text-sub">단가</div>
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
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">날짜</th><th className="px-3 py-3">구분</th><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">수량</th><th className="px-3 py-3 text-right">단가</th><th className="px-3 py-3 text-right">금액</th><th className="px-3 py-3 text-left">전략</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{sorted.map((j) => <tr key={j.id} className="border-t border-border"><td className="px-3 py-3">{j.date}</td><td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-bold ${j.action === 'buy' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>{j.action === 'buy' ? '매수' : '매도'}</span></td><td className="px-3 py-3 font-bold">{j.ticker}</td><td className="px-3 py-3 text-right">{j.shares}</td><td className="px-3 py-3 text-right">{usd(j.price)}</td><td className={`px-3 py-3 text-right font-semibold ${j.action === 'buy' ? 'text-blue-600' : 'text-rose-600'}`}>{usd(j.shares * j.price)}</td><td className="px-3 py-3">{j.strategy ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{j.strategy}</span> : <span className="text-sub">-</span>}</td><td className="px-3 py-3 text-sub">{j.note || '-'}</td><td className="px-3 py-3 text-right"><button onClick={() => onEdit(j)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(j.id)} className="no-print text-rose-600">삭제</button></td></tr>)}</tbody>
        </table>
        {!journal.length && <div className="p-12 text-center text-sm text-sub">거래 기록이 없습니다.</div>}
      </div>
    </section>
  );
}

function JournalFlowChart({ journal }: { journal: JournalItem[] }) {
  const data = useMemo(() => {
    const sortedJ = [...journal].sort((a, b) => a.date.localeCompare(b.date));
    const avgCostMap: Record<string, { cost: number; shares: number }> = {};
    const months: Record<string, { month: string; buy: number; sell: number; realized: number }> = {};
    for (const item of sortedJ) {
      const month = item.date.slice(0, 7);
      if (!months[month]) months[month] = { month, buy: 0, sell: 0, realized: 0 };
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
                const labels: Record<string, string> = { buy: '매수', sell: '매도', realized: '실현 손익' };
                return [usd(Number(value)), labels[String(name)] ?? String(name)];
              }}
              contentStyle={darkTooltip}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <ReferenceLine y={0} stroke="#334155" />
            <Bar dataKey="buy" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="sell" fill="#fb7185" radius={[8, 8, 0, 0]} />
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
    const activityByDate: Record<string, 'buy' | 'sell' | 'both'> = {};
    for (const j of sortedJ) {
      if (j.action === 'buy') {
        if (!avgCostMap[j.ticker]) avgCostMap[j.ticker] = { cost: 0, shares: 0 };
        avgCostMap[j.ticker].cost += j.shares * j.price;
        avgCostMap[j.ticker].shares += j.shares;
        if (!activityByDate[j.date]) activityByDate[j.date] = 'buy';
        else if (activityByDate[j.date] === 'sell') activityByDate[j.date] = 'both';
      } else {
        const entry = avgCostMap[j.ticker];
        const avgCost = entry?.shares ? entry.cost / entry.shares : j.price;
        const pnl = (j.price - avgCost) * j.shares - (j.fee || 0);
        pnlByDate[j.date] = (pnlByDate[j.date] ?? 0) + pnl;
        if (!activityByDate[j.date]) activityByDate[j.date] = 'sell';
        else activityByDate[j.date] = 'both';
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
