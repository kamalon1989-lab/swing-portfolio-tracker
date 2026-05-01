'use client';

import { useMemo, useState } from 'react';
import type { HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';
import { EarningsPanel, TickerDetail } from './panels';
import {
  colorClass,
  daysSince,
  money,
  pct,
  usd,
  type EarningsItem,
  type NewsItem,
  type NewsState,
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

export function PortfolioView(props: {
  rows: HoldingRow[];
  summary: { stockValue: number; totalCost: number; totalPnl: number; totalPnlPct: number; dayPnl: number; totalAsset: number };
  cash: number;
  krw: boolean;
  rate: number;
  onEditCash: () => void;
  onAdd: () => void;
  onEdit: (item: HoldingItem) => void;
  onDelete: (ticker: string) => void;
  onRecord: () => void;
  onShare: () => void;
  onPdf: () => void;
  onExport: () => void;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  selectedNews: NewsItem[];
  selectedNewsState: NewsState;
  theme: 'light' | 'dark';
  earnings: EarningsItem[];
  loadingEarnings: boolean;
  onRefreshEarnings: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
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
  const cards = [
    ['주식 평가금액', money(props.summary.stockValue, props.krw, props.rate), `매수 ${money(props.summary.totalCost, props.krw, props.rate)}`, 'text-brand'],
    ['누적 손익', money(props.summary.totalPnl, props.krw, props.rate), pct(props.summary.totalPnlPct), colorClass(props.summary.totalPnl)],
    ['오늘 손익', money(props.summary.dayPnl, props.krw, props.rate), '실시간 시세 기준', colorClass(props.summary.dayPnl)],
    ['예수금', money(props.cash, props.krw, props.rate), '클릭해서 수정', 'text-brand'],
    ['총 자산', money(props.summary.totalAsset, props.krw, props.rate), '주식 + 예수금', 'text-brand'],
  ];
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        {cards.map(([label, value, sub, color]) => (
          <button key={label} type="button" onClick={label === '예수금' ? props.onEditCash : undefined} className={`rounded-xl border border-border bg-card p-4 text-left shadow-sm ${label === '예수금' ? 'cursor-pointer hover:border-brand/50' : 'cursor-default'}`}>
            <div className="text-xs font-semibold uppercase text-sub">{label}</div>
            <div className={`mt-2 text-xl font-extrabold ${color}`}>{value}</div>
            <div className="mt-1 text-xs text-sub">{sub}</div>
          </button>
        ))}
      </div>
      <div className="no-print flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <button onClick={props.onAdd} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">보유 종목 추가</button>
        <button onClick={props.onRecord} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">오늘 기록</button>
        <button onClick={props.onShare} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">공유 링크</button>
        <button onClick={props.onPdf} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">PDF 내보내기</button>
        <button onClick={props.onExport} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">백업 저장</button>
      </div>
      <PriceAlerts alerts={alerts} />
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
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
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <TickerDetail ticker={props.selectedTicker} news={props.selectedNews} state={props.selectedNewsState} theme={props.theme} earnings={props.earnings} />
        <EarningsPanel earnings={props.earnings} loading={props.loadingEarnings} onRefresh={props.onRefreshEarnings} />
      </div>
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

function earningsSymbolMatches(ticker: string, symbol: string) {
  if (ticker === symbol) return true;
  return (ticker === 'GOOGL' && symbol === 'GOOG') || (ticker === 'GOOG' && symbol === 'GOOGL');
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
  selectedNews,
  selectedNewsState,
  theme,
  earnings,
  loadingEarnings,
  onRefreshEarnings,
  onExportTradingView,
}: {
  watch: WatchItem[];
  prices: PriceMap;
  onAdd: () => void;
  onEdit: (item: WatchItem) => void;
  onDelete: (ticker: string) => void;
  onSelectTicker: (ticker: string) => void;
  selectedTicker: string;
  selectedNews: NewsItem[];
  selectedNewsState: NewsState;
  theme: 'light' | 'dark';
  earnings: EarningsItem[];
  loadingEarnings: boolean;
  onRefreshEarnings: () => void;
  onExportTradingView: () => void;
}) {
  const watchTickers = new Set(watch.map((item) => item.ticker));
  const watchEarnings = earnings.filter((item) => Array.from(watchTickers).some((ticker) => earningsSymbolMatches(ticker, item.symbol)));
  const alerts = makeWatchPriceAlerts(watch, prices);
  return (
    <section className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button onClick={onAdd} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">관심 종목 추가</button>
        <button onClick={onExportTradingView} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">TradingView 복사</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">현재가</th><th className="px-3 py-3 text-right">목표 진입가</th><th className="px-3 py-3 text-right">오늘</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{watch.map((w) => <tr key={w.ticker} className="border-t border-border hover:bg-bg"><td className="px-3 py-3"><strong className="text-brand">{w.ticker}</strong><div className="text-xs text-sub">{w.name}</div></td><td className="px-3 py-3 text-right font-semibold">{prices[w.ticker]?.price ? usd(prices[w.ticker].price) : '-'}</td><td className="px-3 py-3 text-right">{w.targetBuy ? usd(w.targetBuy) : '-'}</td><td className={`px-3 py-3 text-right ${colorClass(prices[w.ticker]?.changePercent ?? 0)}`}>{prices[w.ticker] ? pct(prices[w.ticker].changePercent ?? 0) : '-'}</td><td className="px-3 py-3 text-sub">{w.note || '-'}</td><td className="px-3 py-3 text-right"><button onClick={() => onSelectTicker(w.ticker)} className="no-print mr-2 text-slate-700">상세</button><button onClick={() => onEdit(w)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(w.ticker)} className="no-print text-rose-600">삭제</button></td></tr>)}</tbody>
        </table>
        {!watch.length && <div className="p-12 text-center text-sm text-sub">관심 종목이 없습니다.</div>}
      </div>
      <PriceAlerts alerts={alerts} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <TickerDetail ticker={selectedTicker} news={selectedNews} state={selectedNewsState} theme={theme} earnings={watchEarnings} />
        <EarningsPanel earnings={watchEarnings} loading={loadingEarnings} onRefresh={onRefreshEarnings} />
      </div>
    </section>
  );
}

export function JournalView({ journal, onAdd, onEdit, onDelete }: { journal: JournalItem[]; onAdd: () => void; onEdit: (item: JournalItem) => void; onDelete: (id: string) => void }) {
  const sorted = [...journal].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="space-y-4">
      <button onClick={onAdd} className="no-print rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">거래 추가</button>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">날짜</th><th className="px-3 py-3">구분</th><th className="px-3 py-3 text-left">티커</th><th className="px-3 py-3 text-right">수량</th><th className="px-3 py-3 text-right">단가</th><th className="px-3 py-3 text-right">금액</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{sorted.map((j) => <tr key={j.id} className="border-t border-border"><td className="px-3 py-3">{j.date}</td><td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-bold ${j.action === 'buy' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>{j.action === 'buy' ? '매수' : '매도'}</span></td><td className="px-3 py-3 font-bold">{j.ticker}</td><td className="px-3 py-3 text-right">{j.shares}</td><td className="px-3 py-3 text-right">{usd(j.price)}</td><td className={`px-3 py-3 text-right font-semibold ${j.action === 'buy' ? 'text-blue-600' : 'text-rose-600'}`}>{usd(j.shares * j.price)}</td><td className="px-3 py-3 text-sub">{j.note || '-'}</td><td className="px-3 py-3 text-right"><button onClick={() => onEdit(j)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(j.id)} className="no-print text-rose-600">삭제</button></td></tr>)}</tbody>
        </table>
        {!journal.length && <div className="p-12 text-center text-sm text-sub">거래 기록이 없습니다.</div>}
      </div>
    </section>
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
