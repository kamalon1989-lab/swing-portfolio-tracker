import type { HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';

export type Tab = 'portfolio' | 'assets' | 'watchlist' | 'journal';
export type Price = { price: number; changePercent?: number; prevClose?: number; error?: string };
export type PriceMap = Record<string, Price>;
export type HistoryEntry = {
  date: string;
  totalValue: number;
  stockValue: number;
  cashValue: number;
  totalCost: number;
};
export type Toast = { id: number; message: string };
export type NewsItem = { id: number; datetime: number; headline: string; source: string; url: string };
export type NewsState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';
export type EarningsItem = {
  symbol: string;
  date: string;
  hour?: string;
  epsEstimate?: number;
  epsActual?: number;
  epsSurprise?: number;
  epsSurprisePercent?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  revenueSurprise?: number;
  revenueSurprisePercent?: number;
};
export type SharePayload = {
  date: string;
  pnl: number;
  rows: Array<{ t: string; n?: string; pnl: number; w: number }>;
};

export const K = {
  holdings: 'ptf_h2',
  history: 'ptf_hist',
  prices: 'ptf_px',
  cash: 'ptf_cash',
  journal: 'ptf_journal',
  watch: 'ptf_watch',
  krw: 'ptf_krw',
  theme: 'ptf_theme',
};

export const demoHoldings: HoldingItem[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corp', shares: 20, avgCost: 580, targetPrice: 900, stopLoss: 520, buyDate: '2025-11-10', note: 'AI 인프라 핵심' },
  { ticker: 'MSFT', name: 'Microsoft Corp', shares: 8, avgCost: 410, targetPrice: 520, stopLoss: 380, buyDate: '2026-01-15', note: '클라우드 + AI 플랫폼' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', shares: 12, avgCost: 165, targetPrice: 220, stopLoss: 150, buyDate: '2026-02-01' },
  { ticker: 'AMD', name: 'Advanced Micro Devices', shares: 25, avgCost: 155, targetPrice: 210, stopLoss: 135, buyDate: '2026-01-20' },
];

export const demoWatch: WatchItem[] = [
  { ticker: 'META', name: 'Meta Platforms', targetBuy: 480, note: 'AI 광고 효율 확인' },
  { ticker: 'PLTR', name: 'Palantir Technologies', targetBuy: 70, note: '조정 시 관심' },
  { ticker: 'SMCI', name: 'Super Micro Computer', targetBuy: 50 },
];

export const demoJournal: JournalItem[] = [
  { id: 'dj1', date: '2026-04-15', action: 'buy', ticker: 'NVDA', shares: 5, price: 870, fee: 0, note: '추세 재진입' },
  { id: 'dj2', date: '2026-04-10', action: 'sell', ticker: 'GOOGL', shares: 3, price: 198, fee: 0, note: '일부 익절' },
  { id: 'dj3', date: '2026-03-28', action: 'buy', ticker: 'AMD', shares: 10, price: 152, fee: 0, note: '지지선 반등' },
];

export const demoPrices: PriceMap = {
  NVDA: { price: 875.4, changePercent: 2.15, prevClose: 856.8 },
  MSFT: { price: 425.3, changePercent: 1.2, prevClose: 420.25 },
  GOOGL: { price: 178.9, changePercent: 0.65, prevClose: 177.74 },
  AMD: { price: 163.8, changePercent: 3.21, prevClose: 158.7 },
  META: { price: 512.6, changePercent: 1.85, prevClose: 503.25 },
  PLTR: { price: 82.1, changePercent: 2.1, prevClose: 80.41 },
  SMCI: { price: 45.8, changePercent: -1.2, prevClose: 46.36 },
};

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysSince(date?: string | null) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((todayStart.getTime() - start.getTime()) / 86400000));
}

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function money(n: number, krw: boolean, rate: number) {
  if (krw && rate) return `₩${Math.round(n * rate).toLocaleString('ko-KR')}`;
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function usd(n: number) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`;
}

export function colorClass(n: number) {
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-rose-600';
  return 'text-slate-500';
}

export function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeHistory(input: unknown): HistoryEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const row = item as Record<string, unknown>;
      const totalValue = Number(row.totalValue ?? row.totalVal ?? 0);
      const stockValue = Number(row.stockValue ?? row.stockVal ?? totalValue);
      const cashValue = Number(row.cashValue ?? row.cash ?? 0);
      return {
        date: String(row.date ?? ''),
        totalValue,
        stockValue,
        cashValue,
        totalCost: Number(row.totalCost ?? row.cost ?? 0),
      };
    })
    .filter((item) => item.date);
}

export function decodeShare(hash: string): SharePayload | null {
  try {
    const raw = hash.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) as SharePayload;
  } catch {
    return null;
  }
}
