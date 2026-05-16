'use client';

import { useMemo, useState } from 'react';
import type { AiInsightItem } from '@/lib/firebase';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  colorClass,
  earningsSymbolMatches,
  pct,
  money,
  usd,
  type EarningsItem,
  type GoalConfig,
  type HistoryEntry,
  type SharePayload,
  type Tab,
} from './model';

/* ─── Goal tracker helpers ─────────────────────────────────── */

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

function monthDiff(from: Date, to: Date) {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function shortMonthLabel(date: Date) {
  return `${String(date.getFullYear()).slice(2)}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function compactUsd(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatSignedMonths(months: number) {
  if (months === 0) return '목표 일정과 동일';
  return months > 0 ? `목표 대비 ${months}개월 지연` : `목표 대비 ${Math.abs(months)}개월 빠름`;
}

function projectValue(start: number, monthly: number, monthlyRate: number, months: number) {
  let value = start;
  for (let i = 0; i < months; i++) value = value * (1 + monthlyRate) + monthly;
  return value;
}

function findEtaMonths(start: number, monthly: number, monthlyRate: number, target: number, maxMonths = 360) {
  if (start >= target) return 0;
  let value = start;
  for (let i = 1; i <= maxMonths; i++) {
    value = value * (1 + monthlyRate) + monthly;
    if (value >= target) return i;
  }
  return null;
}

function calcRequiredMonthlyDeposit(start: number, monthly: number, monthlyRate: number, target: number, months: number) {
  if (months <= 0) return 0;
  const projectedWithoutExtra = projectValue(start, monthly, monthlyRate, months);
  if (projectedWithoutExtra >= target) return 0;
  const factor = Math.abs(monthlyRate) < 0.000001
    ? months
    : ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  return Math.max(0, (target - projectedWithoutExtra) / Math.max(factor, 1));
}

function monthlyReturnStats(history: HistoryEntry[], currentAsset: number, now: Date) {
  const sorted = [...history]
    .filter((item) => item.date && item.totalValue > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestHistory = sorted[sorted.length - 1];
  const latest = latestHistory ?? { date: now.toISOString().slice(0, 10), totalValue: currentAsset };
  const latestDate = new Date(`${latest.date}T00:00:00`);
  const recentCutoff = new Date(latestDate);
  recentCutoff.setMonth(recentCutoff.getMonth() - 3);
  const recent = sorted.filter((item) => new Date(`${item.date}T00:00:00`) >= recentCutoff);
  const sample = recent.length >= 2 ? recent : sorted.slice(-4);
  if (sample.length < 2) {
    return { monthlyRate: 0, volatility: 0.03, sampleMonths: 0, sampleCount: sample.length, returns: [] as number[] };
  }
  const first = sample[0];
  const last = sample[sample.length - 1];
  const firstDate = new Date(`${first.date}T00:00:00`);
  const lastDate = new Date(`${last.date}T00:00:00`);
  const months = Math.max((lastDate.getTime() - firstDate.getTime()) / (30.44 * 86400000), 0.1);
  const monthlyRate = Math.pow(last.totalValue / first.totalValue, 1 / months) - 1;
  const returns = sample.slice(1).map((item, index) => {
    const prev = sample[index];
    const prevDate = new Date(`${prev.date}T00:00:00`);
    const itemDate = new Date(`${item.date}T00:00:00`);
    const days = Math.max((itemDate.getTime() - prevDate.getTime()) / 86400000, 1);
    return Math.pow(item.totalValue / prev.totalValue, 30.44 / days) - 1;
  }).filter(Number.isFinite);
  const avg = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / Math.max(returns.length, 1);
  return {
    monthlyRate: Number.isFinite(monthlyRate) ? monthlyRate : 0,
    volatility: Math.max(Math.sqrt(variance), 0.015),
    sampleMonths: months,
    sampleCount: sample.length,
    returns,
  };
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
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur sm:hidden mobile-bottom-nav">
      {([
        ['portfolio', '포트폴리오'],
        ['assets', '자산'],
        ['watchlist', '관심'],
        ['journal', '일지'],
        ['paper', '모의'],
      ] as const).map(([key, label]) => (
        <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-2 py-2.5 text-xs font-bold ${tab === key ? 'bg-brand text-white shadow-sm' : 'text-sub'}`}>
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
  const latestHistory = sortedHistory[sortedHistory.length - 1];
  const prevHistory = sortedHistory[sortedHistory.length - 2];
  const latestChangePct = latestHistory && prevHistory?.totalValue ? ((latestHistory.totalValue - prevHistory.totalValue) / prevHistory.totalValue) * 100 : null;
  const topHolding = rows.slice().sort((a, b) => b.value - a.value)[0];
  const stockWeight = summary.totalAsset ? (summary.stockValue / summary.totalAsset) * 100 : 0;
  const cashWeight = summary.totalAsset ? (cash / summary.totalAsset) * 100 : 0;
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
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-100">자산 기록</h2>
            <p className="mt-1 text-xs text-slate-400">기록별 총자산, 주식, 예수금과 변화율</p>
          </div>
          <div className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">
            {sortedHistory.length}건
          </div>
        </div>
        <div className="mt-4 space-y-3 sm:hidden">
          {sortedHistory.map((h, index) => {
            const prev = sortedHistory[index - 1];
            const change = prev?.totalValue ? ((h.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0;
            return (
              <div key={h.date} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">기록일</div>
                    <div className="mt-1 font-bold text-slate-100">{h.date}</div>
                  </div>
                  {prev ? (
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${change >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                      {pct(change)}
                    </span>
                  ) : <span className="text-xs text-slate-500">첫 기록</span>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-950 p-2">
                    <div className="text-slate-500">총 자산</div>
                    <div className="mt-1 font-bold text-slate-100">{money(h.totalValue, krw, rate)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-2">
                    <div className="text-slate-500">주식</div>
                    <div className="mt-1 font-bold text-slate-200">{money(h.stockValue, krw, rate)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-950 p-2">
                    <div className="text-slate-500">예수금</div>
                    <div className="mt-1 font-bold text-slate-200">{money(h.cashValue, krw, rate)}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => onEditHistory(h)} className="rounded-md border border-slate-700 px-2 py-1 text-xs font-bold text-sky-300">수정</button>
                  <button onClick={() => onDeleteHistory(h.date)} className="rounded-md border border-rose-400/30 px-2 py-1 text-xs font-bold text-rose-300">삭제</button>
                </div>
              </div>
            );
          })}
          {!sortedHistory.length && <div className="p-10 text-center text-sm text-slate-400">포트폴리오 탭에서 오늘 기록을 저장하면 여기에 쌓입니다.</div>}
        </div>
        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-800 sm:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-900 text-xs text-slate-400"><tr><th className="px-3 py-3 text-left">날짜</th><th className="px-3 py-3 text-right">총 자산</th><th className="px-3 py-3 text-right">주식</th><th className="px-3 py-3 text-right">예수금</th><th className="px-3 py-3 text-right">변화율</th><th className="px-3 py-3 text-right">관리</th></tr></thead>
            <tbody>{sortedHistory.map((h, index) => {
              const prev = sortedHistory[index - 1];
              const change = prev?.totalValue ? ((h.totalValue - prev.totalValue) / prev.totalValue) * 100 : 0;
              return (
                <tr key={h.date} className="border-t border-slate-800 hover:bg-slate-900/70">
                  <td className="px-3 py-3 font-semibold text-slate-200">{h.date}</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-100">{money(h.totalValue, krw, rate)}</td>
                  <td className="px-3 py-3 text-right text-slate-300">{money(h.stockValue, krw, rate)}</td>
                  <td className="px-3 py-3 text-right text-slate-300">{money(h.cashValue, krw, rate)}</td>
                  <td className="px-3 py-3 text-right">
                    {prev ? (
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${change >= 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                        {pct(change)}
                      </span>
                    ) : <span className="text-slate-500">-</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => onEditHistory(h)} className="mr-2 rounded-md border border-slate-700 px-2 py-1 text-xs font-bold text-sky-300 hover:border-sky-400">수정</button>
                    <button onClick={() => onDeleteHistory(h.date)} className="rounded-md border border-rose-400/30 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-400/10">삭제</button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {!sortedHistory.length && <div className="p-10 text-center text-sm text-slate-400">포트폴리오 탭에서 오늘 기록을 저장하면 여기에 쌓입니다.</div>}
        </div>
      </div>
      </div>
      <aside
        className="space-y-4 lg:self-start xl:fixed xl:bottom-6 xl:top-24 xl:z-20 xl:w-[380px] xl:overflow-y-auto xl:pr-1"
        style={{ right: 'max(1.5rem, calc((100vw - 1540px) / 2 + 1.5rem))' }}
      >
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <h2 className="font-bold text-slate-100">자산 상태 요약</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs font-bold text-slate-400">총자산</div>
            <div className="mt-1 text-xl font-extrabold text-slate-100">{money(summary.totalAsset, krw, rate)}</div>
            <div className={`mt-1 text-xs font-bold ${latestChangePct === null ? 'text-slate-500' : colorClass(latestChangePct)}`}>
              최근 기록 대비 {latestChangePct === null ? '-' : pct(latestChangePct)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-xs text-slate-400">주식 비중</div>
              <div className="mt-1 font-extrabold text-sky-300">{stockWeight.toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-xs text-slate-400">현금 비중</div>
              <div className="mt-1 font-extrabold text-amber-300">{cashWeight.toFixed(1)}%</div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs text-slate-400">최대 보유</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <strong className="text-slate-100">{topHolding?.ticker ?? '-'}</strong>
              <span className="text-sm font-bold text-slate-300">{topHolding && summary.totalAsset ? ((topHolding.value / summary.totalAsset) * 100).toFixed(1) : '0.0'}%</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-xs text-slate-400">다음 행동</div>
            <div className="mt-2 text-xs leading-5 text-slate-300">
              {cashWeight < 10 ? '현금 비중이 낮습니다. 다음 매수 전 예수금 여유를 확인하세요.' : cashWeight > 35 ? '현금 비중이 높습니다. 관심 종목 진입 조건을 점검해도 좋습니다.' : '현금과 주식 비중이 비교적 균형 구간입니다.'}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-100">자산 비중</h2>
            <p className="mt-1 text-xs text-slate-400">보유 종목과 현금 비중</p>
          </div>
          <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">
            {money(summary.totalAsset, krw, rate)}
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <AssetDonut rows={donutRows} totalAsset={summary.totalAsset} krw={krw} rate={rate} />
        </div>
        <div className="mt-5 space-y-2 text-sm">
          {donutRows.map((row, index) => (
            <div key={row.ticker} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <span className="min-w-0">
                  <span className="font-bold text-slate-100">{row.ticker}</span>
                  {row.name && <span className="ml-1 text-xs text-slate-500">{row.name}</span>}
                </span>
              </span>
              <strong className="text-slate-200">{row.weight.toFixed(1)}%</strong>
            </div>
          ))}
          <div className="flex justify-between text-slate-400"><span>주식</span><strong className="text-slate-200">{money(summary.stockValue, krw, rate)}</strong></div>
          <div className="flex justify-between text-slate-400"><span>예수금</span><strong className="text-slate-200">{money(cash, krw, rate)}</strong></div>
          <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-400"><span>총 자산</span><strong className="text-slate-100">{money(summary.totalAsset, krw, rate)}</strong></div>
        </div>
      </div>
      </aside>
    </section>
    </div>
  );
}

function AssetDonut({ rows, totalAsset, krw, rate }: { rows: DonutRow[]; totalAsset: number; krw: boolean; rate: number }) {
  if (!rows.length) {
    return (
      <div className="grid h-56 w-full place-items-center rounded-xl bg-slate-900 text-center text-sm font-bold text-slate-400">
        기록 없음
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, color: '#e2e8f0' }}
            labelStyle={{ color: '#cbd5e1' }}
          />
          <Pie
            data={rows}
            dataKey="weight"
            nameKey="ticker"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            labelLine={false}
            label={({ name, percent }) => percent && percent > 0.055 ? name : ''}
            stroke="#020617"
            strokeWidth={3}
          >
            {rows.map((row, index) => (
              <Cell key={row.ticker} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="-mt-44 grid place-items-center text-center pointer-events-none">
        <div className="rounded-full bg-slate-950/80 px-4 py-3">
          <div className="text-xs text-slate-500">총 자산</div>
          <div className="text-lg font-extrabold text-sky-300">{money(totalAsset, krw, rate)}</div>
        </div>
      </div>
    </div>
  );
}

function AssetTrendChart({ history, krw, rate, benchData = [] }: { history: HistoryEntry[]; krw: boolean; rate: number; benchData?: { date: string; price: number }[] }) {
  if (history.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h2 className="font-bold text-slate-100">자산 추이</h2>
        <div className="mt-4 rounded-xl bg-slate-900 p-10 text-center text-sm text-slate-400">두 번 이상 자산 기록을 저장하면 추이가 표시됩니다.</div>
      </div>
    );
  }
  const benchMap = new Map(benchData.map((b) => [b.date, b.price]));
  function findBenchPrice(date: string) {
    if (benchMap.has(date)) return benchMap.get(date)!;
    const before = [...benchMap.entries()].filter(([d]) => d <= date).sort((a, b) => b[0].localeCompare(a[0]))[0];
    return before ? before[1] : null;
  }
  const benchPoints = history.map((h) => findBenchPrice(h.date));
  const benchBaseline = benchPoints[0];
  const baseValue = history[0]?.totalValue ?? 1;
  const chartData = history.map((item, index) => {
    const benchmark = benchBaseline
      ? (() => {
        const bp = benchPoints[index];
        return bp != null ? baseValue * (bp / benchBaseline) : undefined;
      })()
      : undefined;
    return {
      label: item.date.slice(5),
      date: item.date,
      totalValue: item.totalValue,
      stockValue: item.stockValue,
      cashValue: item.cashValue,
      benchmark,
    };
  });
  const latest = history[history.length - 1];
  const moneyTick = (value: number) => krw && rate ? `₩${Math.round(value * rate / 10000).toLocaleString('ko-KR')}만` : compactUsd(value);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-100">자산 추이</h2>
          <p className="mt-1 text-xs text-slate-400">총자산, 주식, 예수금 흐름</p>
        </div>
        <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-right text-xs font-bold text-sky-200">
          <div>{money(latest.totalValue, krw, rate)}</div>
          <div className="font-medium text-sky-100/60">{latest.date}</div>
        </div>
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="assetTotal" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="label" minTickGap={24} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={moneyTick} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
            <Tooltip
              formatter={(value, name) => {
                const labels: Record<string, string> = { totalValue: '총자산', stockValue: '주식', cashValue: '예수금', benchmark: 'S&P500 동기' };
                return [money(Number(value), krw, rate), labels[String(name)] ?? String(name)];
              }}
              contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, color: '#e2e8f0' }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Area type="monotone" dataKey="totalValue" stroke="#38bdf8" strokeWidth={3} fill="url(#assetTotal)" dot={{ r: 3, fill: '#38bdf8' }} />
            <Line type="monotone" dataKey="stockValue" stroke="#22c55e" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="cashValue" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
            {benchBaseline && <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" strokeWidth={2} strokeDasharray="7 6" dot={false} connectNulls />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        <span><b className="text-sky-400">━</b> 총자산</span>
        <span><b className="text-emerald-400">━</b> 주식</span>
        <span><b className="text-amber-400">━</b> 예수금</span>
        {benchBaseline && <span><b className="text-slate-400">╌</b> S&amp;P500 동기</span>}
      </div>
    </div>
  );
}

export function TickerDetail({
  ticker,
  theme = 'light',
  earnings = [],
  memo = '',
  aiInsights = [],
  onSaveMemo,
}: {
  ticker: string;
  theme?: 'light' | 'dark';
  earnings?: EarningsItem[];
  memo?: string;
  aiInsights?: AiInsightItem[];
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
        {aiInsights.length > 0 && (
          <div className="border-t border-border p-4">
            <TickerAiInsights insights={aiInsights} />
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

function TickerAiInsights({ insights }: { insights: AiInsightItem[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">ChatGPT 분석</h3>
        <span className="text-xs text-sub">{insights.length}개</span>
      </div>
      <div className="space-y-2">
        {insights.slice(0, 3).map((item) => (
          <article key={item.id} className="rounded-lg border border-border bg-bg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold">{item.title}</h4>
              <span className="text-[11px] font-semibold text-sub">{item.date}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-sub">{item.content}</p>
          </article>
        ))}
      </div>
    </div>
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

type PaceStatus = 'safe' | 'steady' | 'fast';

type ForecastPoint = {
  label: string;
  date: string;
  actual?: number;
  trend?: number;
  range?: [number, number];
};

type GoalAnalysis = {
  now: Date;
  targetDate: Date;
  targetMonths: number;
  dday: number;
  achieveRate: number;
  actualMonthlyRate: number;
  requiredMonthlyRate: number | null;
  volatility: number;
  sampleMonths: number;
  etaMonths: number | null;
  etaDate: Date | null;
  delayMonths: number | null;
  paceStatus: PaceStatus;
  forecastData: ForecastPoint[];
  extraMonthlyDeposit: number;
};

function buildGoalAnalysis(goalConfig: GoalConfig, history: HistoryEntry[], currentAsset: number): GoalAnalysis {
  const now = new Date();
  const targetDate = new Date(`${goalConfig.targetDate}T00:00:00`);
  const targetMonths = Math.max(1, monthDiff(now, targetDate) || Math.ceil((targetDate.getTime() - now.getTime()) / (30.44 * 86400000)));
  const dday = Math.ceil((targetDate.getTime() - now.getTime()) / 86400000);
  const achieveRate = goalConfig.targetAmount > 0 ? Math.min((currentAsset / goalConfig.targetAmount) * 100, 100) : 0;
  const stats = monthlyReturnStats(history, currentAsset, now);
  const requiredMonthlyRate = calcRequiredMonthlyRate(currentAsset, goalConfig.monthlyContrib, goalConfig.targetAmount, targetMonths);
  const etaMonths = findEtaMonths(currentAsset, goalConfig.monthlyContrib, stats.monthlyRate, goalConfig.targetAmount);
  const etaDate = etaMonths === null ? null : addMonths(now, etaMonths);
  const delayMonths = etaMonths === null ? null : etaMonths - targetMonths;
  const tolerance = Math.max(0.002, Math.abs(requiredMonthlyRate ?? 0) * 0.12);
  const paceStatus: PaceStatus = requiredMonthlyRate === null || stats.monthlyRate >= requiredMonthlyRate + tolerance
    ? 'safe'
    : stats.monthlyRate >= requiredMonthlyRate - tolerance
      ? 'steady'
      : 'fast';
  const horizon = Math.min(Math.max(targetMonths + 3, 6), 96);
  const sortedHistory = [...history]
    .filter((item) => item.date && item.totalValue > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recentHistory = sortedHistory.slice(-12).map((item) => ({
    label: shortMonthLabel(new Date(`${item.date}T00:00:00`)),
    date: item.date,
    actual: item.totalValue,
  }));
  const forecast = Array.from({ length: horizon + 1 }, (_, index) => {
    const date = addMonths(now, index);
    const trend = projectValue(currentAsset, goalConfig.monthlyContrib, stats.monthlyRate, index);
    const cone = stats.volatility * 1.35 * Math.sqrt(index);
    const lower = Math.max(0, trend * (1 - cone));
    const upper = trend * (1 + cone);
    return {
      label: index === 0 ? '현재' : shortMonthLabel(date),
      date: date.toISOString().slice(0, 10),
      trend,
      range: [lower, upper] as [number, number],
      actual: index === 0 ? currentAsset : undefined,
    };
  });
  const extraMonthlyDeposit = calcRequiredMonthlyDeposit(currentAsset, goalConfig.monthlyContrib, stats.monthlyRate, goalConfig.targetAmount, targetMonths);
  return {
    now,
    targetDate,
    targetMonths,
    dday,
    achieveRate,
    actualMonthlyRate: stats.monthlyRate,
    requiredMonthlyRate,
    volatility: stats.volatility,
    sampleMonths: stats.sampleMonths,
    etaMonths,
    etaDate,
    delayMonths,
    paceStatus,
    forecastData: [...recentHistory, ...forecast],
    extraMonthlyDeposit,
  };
}

function GoalForecastChart({
  data, targetAmount,
}: {
  data: ForecastPoint[];
  targetAmount: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">시나리오별 예측 그래프</h3>
          <p className="mt-1 text-xs text-slate-400">과거 실제 기록 + 최근 페이스 연장선 + 변동성 예측 범위</p>
        </div>
        <div className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200">
          목표 {compactUsd(targetAmount)}
        </div>
      </div>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="goalCone" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="label" minTickGap={26} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={compactUsd} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
            <Tooltip
              formatter={(value, name) => {
                if (Array.isArray(value)) return [`${compactUsd(value[0])} ~ ${compactUsd(value[1])}`, '예측 범위'];
                const label = name === 'actual' ? '실제 자산' : '나의 추세';
                return [compactUsd(Number(value)), label];
              }}
              contentStyle={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 12, color: '#e2e8f0' }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <ReferenceLine y={targetAmount} stroke="#a78bfa" strokeDasharray="6 4" label={{ value: '목표', fill: '#c4b5fd', fontSize: 11, position: 'insideTopRight' }} />
            <Area type="monotone" dataKey="range" stroke="none" fill="url(#goalCone)" connectNulls />
            <Line type="monotone" dataKey="actual" stroke="#e2e8f0" strokeWidth={3} dot={{ r: 3, fill: '#e2e8f0' }} connectNulls />
            <Line type="monotone" dataKey="trend" stroke="#38bdf8" strokeWidth={3} strokeDasharray="7 6" dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        <span><b className="text-slate-100">━</b> 실제 자산 기록</span>
        <span><b className="text-sky-400">╌</b> 나의 실제 추세 연장선</span>
        <span><b className="text-sky-300">■</b> 변동성 예측 범위</span>
      </div>
    </div>
  );
}

function PaceMeter({ analysis }: { analysis: GoalAnalysis }) {
  const required = analysis.requiredMonthlyRate ?? 0;
  const actual = analysis.actualMonthlyRate;
  const maxRate = Math.max(Math.abs(required), Math.abs(actual), 0.01);
  const actualPos = Math.max(4, Math.min(96, ((actual + maxRate) / (maxRate * 2)) * 100));
  const requiredPos = Math.max(4, Math.min(96, ((required + maxRate) / (maxRate * 2)) * 100));
  const meta = {
    safe: {
      title: '안전 운행 구간',
      desc: '리스크를 낮추고 유지하세요',
      tone: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
      dot: 'bg-emerald-400',
    },
    steady: {
      title: '정속 주행 구간',
      desc: '현재 승률을 유지하세요',
      tone: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
      dot: 'bg-amber-400',
    },
    fast: {
      title: '과속 필요 구간',
      desc: '추가 시드 또는 전략 수정 필요',
      tone: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
      dot: 'bg-rose-400',
    },
  }[analysis.paceStatus];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">투자 온도계</h3>
          <p className="mt-1 text-xs text-slate-400">최근 실제 월 수익률과 목표 달성에 필요한 월 수익률 비교</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${meta.tone}`}>
          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.title}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-900 p-3">
          <div className="text-xs text-slate-400">최근 실제 월 수익률</div>
          <div className="mt-1 text-2xl font-extrabold text-sky-300">{(actual * 100).toFixed(2)}%</div>
        </div>
        <div className="rounded-xl bg-slate-900 p-3">
          <div className="text-xs text-slate-400">요구 월 수익률</div>
          <div className="mt-1 text-2xl font-extrabold text-violet-300">{analysis.requiredMonthlyRate === null ? '-' : `${(required * 100).toFixed(2)}%`}</div>
        </div>
      </div>
      <div className="relative mt-5 h-3 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400">
        <span className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-violet-100 shadow" style={{ left: `${requiredPos}%` }} title="요구 수익률" />
        <span className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-sky-300 shadow" style={{ left: `${actualPos}%` }} title="실제 수익률" />
      </div>
      <div className="mt-3 flex justify-between text-[11px] text-slate-500">
        <span>부족</span><span>요구선</span><span>여유</span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm font-semibold text-slate-200">
        {meta.desc}
      </div>
    </div>
  );
}

function ActionAdvice({ analysis, goalConfig, krw, rate }: { analysis: GoalAnalysis; goalConfig: GoalConfig; krw: boolean; rate: number }) {
  if (analysis.paceStatus !== 'fast') {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100">
        <h3 className="font-bold">행동 지침</h3>
        <p className="mt-2 text-sm text-emerald-100/80">
          현재 페이스는 목표 요구 속도와 같거나 더 빠릅니다. 신규 리스크를 과하게 늘리기보다 포지션 크기와 손절 기준을 유지하는 쪽이 유리합니다.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-100">
      <h3 className="font-bold">행동 지침 처방전</h3>
      <div className="mt-3 grid gap-3">
        <div className="rounded-xl border border-rose-300/20 bg-slate-950/60 p-3">
          <div className="text-xs font-bold text-rose-200">처방 1 · 추가 시드</div>
          <p className="mt-1 text-sm text-rose-50">
            현재 승률을 유지할 경우, 매월 <b>{money(analysis.extraMonthlyDeposit, krw, rate)}</b>의 추가 입금이 필요합니다.
          </p>
        </div>
        <div className="rounded-xl border border-rose-300/20 bg-slate-950/60 p-3">
          <div className="text-xs font-bold text-rose-200">처방 2 · 목표일 재조정</div>
          <p className="mt-1 text-sm text-rose-50">
            추가 입금 없이 현재 승률로 도달하려면, 목표 D-Day를 <b>{analysis.etaDate ? monthLabel(analysis.etaDate) : '산정 가능한 미래 시점'}</b>로 수정하는 것을 추천합니다.
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-rose-100/70">현재 월 적립액 {money(goalConfig.monthlyContrib, krw, rate)}은 계산에 이미 반영했습니다.</p>
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
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sky-400/10 text-2xl text-sky-300">◎</div>
          <h2 className="mt-3 text-lg font-bold">투자 목표 트래커</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            목표 금액과 기한을 설정하면<br />실제 기록 기반 ETA · 투자 온도계 · 행동 처방을 확인할 수 있습니다.
          </p>
          <button onClick={onEdit} className="mt-5 rounded-xl bg-sky-500 px-6 py-2.5 font-bold text-white hover:bg-sky-400">
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
  const analysis = useMemo(
    () => buildGoalAnalysis(goalConfig, history, currentAsset),
    [currentAsset, goalConfig, history]
  );
  const etaSummary = analysis.etaDate
    ? `${monthLabel(analysis.etaDate)} (${analysis.delayMonths === null ? '목표 비교 불가' : formatSignedMonths(analysis.delayMonths)})`
    : '현재 페이스로는 30년 내 도달이 어렵습니다';
  const ddayText = analysis.dday > 0 ? `D-${analysis.dday.toLocaleString()}` : analysis.dday === 0 ? 'D-Day' : `D+${Math.abs(analysis.dday).toLocaleString()}`;
  const statusCopy = {
    safe: '목표보다 빠른 페이스입니다',
    steady: '목표와 거의 같은 페이스입니다',
    fast: '목표보다 느린 페이스입니다',
  }[analysis.paceStatus];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-sm">
        <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,1),_rgba(2,6,23,1))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-300">Goal Navigation</div>
              <h2 className="mt-2 text-xl font-extrabold">투자 목표 트래커</h2>
              <p className="mt-1 text-sm text-slate-400">{goalConfig.purpose} · 목표 {money(goalConfig.targetAmount, krw, rate)} · {goalConfig.targetDate}</p>
            </div>
            <button onClick={onEdit} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-sky-400 hover:text-sky-200">수정</button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
              <div className="text-xs font-semibold text-sky-200">현재 페이스 유지 시 예상 도착일</div>
              <div className="mt-2 text-2xl font-extrabold text-white">{analysis.etaDate ? monthLabel(analysis.etaDate) : '도달 어려움'}</div>
              <div className="mt-1 text-sm font-semibold text-sky-100/80">{analysis.etaDate ? formatSignedMonths(analysis.delayMonths ?? 0) : statusCopy}</div>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-xs text-slate-400">달성률</div>
              <div className="mt-2 text-2xl font-extrabold text-white">{analysis.achieveRate.toFixed(1)}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-sky-400" style={{ width: `${analysis.achieveRate}%` }} />
              </div>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-xs text-slate-400">목표 D-Day</div>
              <div className="mt-2 text-2xl font-extrabold text-white">{ddayText}</div>
              <div className="mt-1 text-xs text-slate-500">{analysis.targetMonths}개월 남음</div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <div>
            <div className="text-xs text-slate-500">최근 실제 월평균 수익률</div>
            <div className="mt-1 text-lg font-bold text-sky-300">{(analysis.actualMonthlyRate * 100).toFixed(2)}%</div>
            <div className="text-[11px] text-slate-500">최근 {analysis.sampleMonths ? analysis.sampleMonths.toFixed(1) : '0'}개월 기록 기준</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">요구 월 수익률</div>
            <div className="mt-1 text-lg font-bold text-violet-300">{analysis.requiredMonthlyRate === null ? '-' : `${(analysis.requiredMonthlyRate * 100).toFixed(2)}%`}</div>
            <div className="text-[11px] text-slate-500">목표 기한 내 달성 기준</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">변동성</div>
            <div className="mt-1 text-lg font-bold text-slate-200">{(analysis.volatility * 100).toFixed(2)}%</div>
            <div className="text-[11px] text-slate-500">예측 범위 계산에 반영</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <GoalForecastChart data={analysis.forecastData} targetAmount={goalConfig.targetAmount} />
        <div className="space-y-4">
          <PaceMeter analysis={analysis} />
          <ActionAdvice analysis={analysis} goalConfig={goalConfig} krw={krw} rate={rate} />
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">ETA Summary</div>
            <p className="mt-2 font-semibold text-slate-100">현재 페이스 유지 시 예상 도착일: {etaSummary}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              계산은 최근 1~3개월 기록을 우선 사용하고, 기록이 부족하면 최근 기록 구간으로 보정합니다. 예측 범위는 과거 월별 변동성을 기반으로 넓어집니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

