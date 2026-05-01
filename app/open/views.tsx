'use client';

import type { HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';
import { EarningsPanel, TickerDetail } from './panels';
import {
  colorClass,
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

export function PortfolioView(props: {
  rows: HoldingRow[];
  summary: { stockValue: number; totalCost: number; totalPnl: number; totalPnlPct: number; dayPnl: number; totalAsset: number };
  cash: number;
  cashDraft: string;
  setCashDraft: (v: string) => void;
  setCash: (v: number) => void;
  krw: boolean;
  rate: number;
  onAdd: () => void;
  onEdit: (item: HoldingItem) => void;
  onDelete: (ticker: string) => void;
  onRecord: () => void;
  onShare: () => void;
  shareUrl: string;
  onExport: () => void;
  importDraft: string;
  setImportDraft: (v: string) => void;
  onImport: () => void;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  selectedNews: NewsItem[];
  selectedNewsState: NewsState;
  earnings: EarningsItem[];
  loadingEarnings: boolean;
  onRefreshEarnings: () => void;
  onPrint: () => void;
}) {
  const cards = [
    ['주식 평가금액', money(props.summary.stockValue, props.krw, props.rate), `매수 ${money(props.summary.totalCost, props.krw, props.rate)}`, 'text-brand'],
    ['누적 손익', money(props.summary.totalPnl, props.krw, props.rate), pct(props.summary.totalPnlPct), colorClass(props.summary.totalPnl)],
    ['오늘 손익', money(props.summary.dayPnl, props.krw, props.rate), '실시간 시세 기준', colorClass(props.summary.dayPnl)],
    ['예수금', money(props.cash, props.krw, props.rate), '아래에서 수정', 'text-brand'],
    ['총 자산', money(props.summary.totalAsset, props.krw, props.rate), '주식 + 예수금', 'text-brand'],
  ];
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        {cards.map(([label, value, sub, color]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-sub">{label}</div>
            <div className={`mt-2 text-xl font-extrabold ${color}`}>{value}</div>
            <div className="mt-1 text-xs text-sub">{sub}</div>
          </div>
        ))}
      </div>
      <div className="no-print flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <button onClick={props.onAdd} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">보유 추가</button>
        <button onClick={props.onRecord} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">오늘 기록</button>
        <button onClick={props.onShare} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">공유 링크</button>
        <button onClick={props.onPrint} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">PDF/인쇄</button>
        <button onClick={props.onExport} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">백업 저장</button>
        <input value={props.cashDraft} onChange={(e) => props.setCashDraft(e.target.value)} placeholder="예수금" className="min-w-28 rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
        <button onClick={() => props.setCash(Number(props.cashDraft) || 0)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">예수금 반영</button>
      </div>
      {props.shareUrl && <input readOnly value={props.shareUrl} className="no-print w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-sub" />}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-bg text-xs text-sub">
            <tr>
              {['종목', '현재가', '수량', '평단', '평가금액', '손익', '수익률', '오늘', '목표/손절', '비중', '관리'].map((h) => <th key={h} className="px-3 py-3 text-right first:text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((r) => (
              <tr key={r.ticker} className="border-t border-border hover:bg-bg">
                <td className="px-3 py-3 text-left"><strong className="text-brand">{r.ticker}</strong><div className="text-xs text-sub">{r.name}</div></td>
                <td className="px-3 py-3 text-right font-semibold">{r.price ? usd(r.price) : '-'}</td>
                <td className="px-3 py-3 text-right">{r.shares}</td>
                <td className="px-3 py-3 text-right text-sub">{usd(r.avgCost)}</td>
                <td className="px-3 py-3 text-right font-semibold">{r.price ? money(r.value, props.krw, props.rate) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${colorClass(r.pnl)}`}>{r.price ? money(r.pnl, props.krw, props.rate) : '-'}</td>
                <td className={`px-3 py-3 text-right font-semibold ${colorClass(r.pnlPct)}`}>{r.price ? pct(r.pnlPct) : '-'}</td>
                <td className={`px-3 py-3 text-right ${colorClass(r.dayPct)}`}>{r.price ? pct(r.dayPct) : '-'}</td>
                <td className="px-3 py-3 text-right text-xs text-sub">{r.targetPrice ? `목표 ${usd(r.targetPrice)}` : ''}{r.stopLoss ? ` / 손절 ${usd(r.stopLoss)}` : ''}</td>
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
        <TickerDetail ticker={props.selectedTicker} news={props.selectedNews} state={props.selectedNewsState} />
        <EarningsPanel earnings={props.earnings} loading={props.loadingEarnings} onRefresh={props.onRefreshEarnings} />
      </div>
      <div className="no-print rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-sm font-bold">백업 JSON 불러오기</div>
        <textarea value={props.importDraft} onChange={(e) => props.setImportDraft(e.target.value)} className="h-28 w-full rounded-lg border border-border bg-bg p-3 text-xs" placeholder="백업 JSON을 붙여넣으세요" />
        <button onClick={props.onImport} className="mt-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">불러오기</button>
      </div>
    </section>
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
  onExportTradingView: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <button onClick={onAdd} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">관심 추가</button>
        <button onClick={onExportTradingView} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">TradingView 복사</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">종목</th><th className="px-3 py-3 text-right">현재가</th><th className="px-3 py-3 text-right">목표 진입가</th><th className="px-3 py-3 text-right">오늘</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{watch.map((w) => <tr key={w.ticker} className="border-t border-border hover:bg-bg"><td className="px-3 py-3"><strong className="text-brand">{w.ticker}</strong><div className="text-xs text-sub">{w.name}</div></td><td className="px-3 py-3 text-right font-semibold">{prices[w.ticker]?.price ? usd(prices[w.ticker].price) : '-'}</td><td className="px-3 py-3 text-right">{w.targetBuy ? usd(w.targetBuy) : '-'}</td><td className={`px-3 py-3 text-right ${colorClass(prices[w.ticker]?.changePercent ?? 0)}`}>{prices[w.ticker] ? pct(prices[w.ticker].changePercent ?? 0) : '-'}</td><td className="px-3 py-3 text-sub">{w.note || '-'}</td><td className="px-3 py-3 text-right"><button onClick={() => onSelectTicker(w.ticker)} className="no-print mr-2 text-slate-700">상세</button><button onClick={() => onEdit(w)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(w.ticker)} className="no-print text-rose-600">삭제</button></td></tr>)}</tbody>
        </table>
        {!watch.length && <div className="p-12 text-center text-sm text-sub">관심 종목이 없습니다.</div>}
      </div>
      <TickerDetail ticker={selectedTicker} news={selectedNews} state={selectedNewsState} />
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
          <thead className="bg-bg text-xs text-sub"><tr><th className="px-3 py-3 text-left">날짜</th><th className="px-3 py-3">구분</th><th className="px-3 py-3 text-left">종목</th><th className="px-3 py-3 text-right">수량</th><th className="px-3 py-3 text-right">단가</th><th className="px-3 py-3 text-right">금액</th><th className="px-3 py-3 text-left">메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
          <tbody>{sorted.map((j) => <tr key={j.id} className="border-t border-border"><td className="px-3 py-3">{j.date}</td><td className="px-3 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-bold ${j.action === 'buy' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>{j.action === 'buy' ? '매수' : '매도'}</span></td><td className="px-3 py-3 font-bold">{j.ticker}</td><td className="px-3 py-3 text-right">{j.shares}</td><td className="px-3 py-3 text-right">{usd(j.price)}</td><td className={`px-3 py-3 text-right font-semibold ${j.action === 'buy' ? 'text-blue-600' : 'text-emerald-600'}`}>{usd(j.shares * j.price)}</td><td className="px-3 py-3 text-sub">{j.note || '-'}</td><td className="px-3 py-3 text-right"><button onClick={() => onEdit(j)} className="no-print mr-2 text-brand">수정</button><button onClick={() => onDelete(j.id)} className="no-print text-rose-600">삭제</button></td></tr>)}</tbody>
        </table>
        {!journal.length && <div className="p-12 text-center text-sm text-sub">거래 기록이 없습니다.</div>}
      </div>
    </section>
  );
}
