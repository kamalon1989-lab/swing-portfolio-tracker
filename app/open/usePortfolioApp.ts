'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import {
  getFirebaseAuth,
  getFirebaseDb,
  googleProvider,
  userPtfPath,
  type HoldingItem,
  type JournalItem,
  type LegacyPortfolio,
  type WatchItem,
} from '@/lib/firebase';
import {
  K,
  decodeShare,
  demoHoldings,
  demoJournal,
  demoPrices,
  demoWatch,
  normalizeHistory,
  normalizeTicker,
  readJson,
  today,
  uid,
  writeJson,
  type EarningsItem,
  type HistoryEntry,
  type NewsItem,
  type NewsState,
  type PriceMap,
  type SharePayload,
  type Tab,
  type Toast,
} from './model';

export function usePortfolioApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [tab, setTab] = useState<Tab>('portfolio');
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [journal, setJournal] = useState<JournalItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cash, setCash] = useState(0);
  const [prices, setPrices] = useState<PriceMap>({});
  const [krw, setKrw] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [rate, setRate] = useState(0);
  const [status, setStatus] = useState('대기 중');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [editingHolding, setEditingHolding] = useState<HoldingItem | null>(null);
  const [editingWatch, setEditingWatch] = useState<WatchItem | null>(null);
  const [editingTrade, setEditingTrade] = useState<JournalItem | null>(null);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [showWatchForm, setShowWatchForm] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [news, setNews] = useState<Record<string, NewsItem[]>>({});
  const [newsState, setNewsState] = useState<Record<string, NewsState>>({});
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [pdfPayload, setPdfPayload] = useState<SharePayload | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudLoaded = useRef(false);

  const notify = (message: string) => {
    const item = { id: Date.now(), message };
    setToast(item);
    window.setTimeout(() => setToast((current) => (current?.id === item.id ? null : current)), 2500);
  };

  useEffect(() => {
    if (window.location.hash.startsWith('#share=')) {
      setSharePayload(decodeShare(window.location.hash.slice(7)));
      setReady(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.has('demo');
    setDemo(isDemo);

    if (isDemo) {
      setHoldings(demoHoldings);
      setWatch(demoWatch);
      setJournal(demoJournal);
      setCash(8500);
      setPrices(demoPrices);
      setStatus('데모 가상 시세');
      setReady(true);
      cloudLoaded.current = true;
      return;
    }

    setHoldings(readJson<HoldingItem[]>(K.holdings, []));
    setWatch(readJson<WatchItem[]>(K.watch, []));
    setJournal(readJson<JournalItem[]>(K.journal, []));
    setHistory(readJson<HistoryEntry[]>(K.history, []));
    setCash(readJson<number>(K.cash, 0));
    setPrices(readJson<PriceMap>(K.prices, {}));
    setKrw(readJson<boolean>(K.krw, false));
    setTheme(readJson<'light' | 'dark'>(K.theme, 'light'));
    setReady(true);

    const unsub = onAuthStateChanged(getFirebaseAuth(), async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        cloudLoaded.current = true;
        return;
      }
      try {
        const snap = await get(ref(getFirebaseDb(), userPtfPath(nextUser.uid)));
        const data = snap.val() as LegacyPortfolio | null;
        if (data) {
          setHoldings(data.h ?? []);
          setWatch(data.w ?? []);
          setJournal(data.j ?? []);
          setHistory(normalizeHistory(data.hi));
          setCash(data.c ?? 0);
          writeJson(K.holdings, data.h ?? []);
          writeJson(K.watch, data.w ?? []);
          writeJson(K.journal, data.j ?? []);
          writeJson(K.history, data.hi ?? []);
          writeJson(K.cash, data.c ?? 0);
          notify('Firebase 데이터를 불러왔습니다');
        }
      } catch {
        notify('Firebase 데이터를 불러오지 못했습니다');
      } finally {
        cloudLoaded.current = true;
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (!demo) writeJson(K.theme, theme);
  }, [demo, ready, theme]);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((r) => r.json())
      .then((d) => setRate(d.rates.KRW || 0))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready || sharePayload) return;
    if (demo || user) refreshEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, demo, user, holdings.length, watch.length, sharePayload]);

  useEffect(() => {
    if (!ready || demo) return;
    writeJson(K.holdings, holdings);
    writeJson(K.watch, watch);
    writeJson(K.journal, journal);
    writeJson(K.history, history);
    writeJson(K.cash, cash);
    writeJson(K.prices, prices);
    writeJson(K.krw, krw);
  }, [ready, demo, holdings, watch, journal, history, cash, prices, krw]);

  useEffect(() => {
    if (!pdfPayload) return;
    const clear = () => setPdfPayload(null);
    window.addEventListener('afterprint', clear);
    return () => window.removeEventListener('afterprint', clear);
  }, [pdfPayload]);

  useEffect(() => {
    if (!user || demo || !cloudLoaded.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await set(ref(getFirebaseDb(), userPtfPath(user.uid)), {
          h: holdings,
          w: watch,
          j: journal,
          hi: history,
          c: cash,
        });
        setStatus('Firebase 동기화 완료');
      } catch {
        setStatus('Firebase 동기화 실패');
      }
    }, 1200);
  }, [user, demo, holdings, watch, journal, history, cash]);

  const rows = useMemo(() => {
    let totalValue = 0;
    const enriched = holdings.map((h) => {
      const price = prices[h.ticker]?.price ?? 0;
      const value = price * h.shares;
      const cost = h.avgCost * h.shares;
      totalValue += value;
      return {
        ...h,
        price,
        value,
        cost,
        pnl: value - cost,
        pnlPct: cost ? ((value - cost) / cost) * 100 : 0,
        dayPct: prices[h.ticker]?.changePercent ?? 0,
      };
    });
    return enriched
      .map((h) => ({ ...h, weight: totalValue ? (h.value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, prices]);

  const summary = useMemo(() => {
    const stockValue = rows.reduce((sum, item) => sum + item.value, 0);
    const totalCost = rows.reduce((sum, item) => sum + item.cost, 0);
    const dayPnl = rows.reduce((sum, item) => {
      const prev = prices[item.ticker]?.prevClose ?? item.price;
      return sum + (item.price - prev) * item.shares;
    }, 0);
    return {
      stockValue,
      totalCost,
      totalPnl: stockValue - totalCost,
      totalPnlPct: totalCost ? ((stockValue - totalCost) / totalCost) * 100 : 0,
      dayPnl,
      totalAsset: stockValue + cash,
    };
  }, [rows, cash, prices]);

  const portfolioSummaryPayload = useMemo<SharePayload>(() => ({
    date: today(),
    pnl: summary.totalPnlPct,
    rows: rows.map((r) => ({ t: r.ticker, n: r.name, pnl: r.pnlPct, w: r.weight })),
  }), [rows, summary.totalPnlPct]);

  async function refreshPrices() {
    if (demo) {
      setPrices(demoPrices);
      setStatus('데모 가상 시세');
      return;
    }
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      notify('시세 조회는 로그인 후 사용할 수 있습니다');
      return;
    }
    const tickers = Array.from(new Set([...holdings.map((h) => h.ticker), ...watch.map((w) => w.ticker)])).filter(Boolean);
    if (!tickers.length) return;
    setLoadingPrices(true);
    try {
      fetch('https://open.er-api.com/v6/latest/USD')
        .then((r) => r.json())
        .then((d) => setRate(d.rates.KRW || 0))
        .catch(() => undefined);
      const token = await current.getIdToken();
      const next: PriceMap = { ...prices };
      for (const ticker of tickers) {
        const res = await fetch(`/api/finnhub/quote?symbol=${encodeURIComponent(ticker)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.c) next[ticker] = { price: data.c, changePercent: data.dp ?? 0, prevClose: data.pc ?? data.c };
        }
      }
      setPrices(next);
      setStatus(`${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시세 갱신`);
    } catch {
      setStatus('시세 조회 실패');
    } finally {
      setLoadingPrices(false);
    }
  }

  async function fetchFinnhubJson(path: string, params: Record<string, string>) {
    const current = getFirebaseAuth().currentUser;
    if (!current) throw new Error('AUTH');
    const token = await current.getIdToken();
    const query = new URLSearchParams(params);
    const res = await fetch(`/api/finnhub/${path}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function refreshEarnings() {
    if (demo) {
      setEarnings([
        { symbol: 'GOOGL', date: '2026-04-25', hour: 'amc', epsEstimate: 2.12, epsActual: 2.28, revenueEstimate: 96500000000, revenueActual: 98200000000 },
        { symbol: 'AMD', date: '2026-05-06', hour: 'amc', epsEstimate: 0.94, revenueEstimate: 7400000000 },
        { symbol: 'NVDA', date: '2026-05-21', hour: 'amc', epsEstimate: 5.58, revenueEstimate: 44000000000 },
        { symbol: 'MSFT', date: '2026-05-28', hour: 'amc', epsEstimate: 3.24, revenueEstimate: 69000000000 },
      ]);
      return;
    }
    const tickers = Array.from(new Set([...holdings.map((h) => h.ticker), ...watch.map((w) => w.ticker)])).filter(Boolean);
    if (!tickers.length) return;
    setLoadingEarnings(true);
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    const to = new Date(now);
    to.setDate(now.getDate() + 21);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    try {
      const data = await fetchFinnhubJson('calendar/earnings', { from: fmt(from), to: fmt(to) });
      const rows = ((data?.earningsCalendar ?? []) as EarningsItem[])
        .filter((item) => tickers.includes(item.symbol))
        .sort((a, b) => a.date.localeCompare(b.date));
      setEarnings(rows);
      setStatus(`실적 일정 ${rows.length}건 갱신`);
    } catch {
      notify('실적 일정을 불러오지 못했습니다');
    } finally {
      setLoadingEarnings(false);
    }
  }

  async function openTickerDetail(ticker: string) {
    setSelectedTicker(ticker);
    if (demo) {
      setNews((prev) => ({
        ...prev,
        [ticker]: [
          { id: 1, datetime: Math.floor(Date.now() / 1000), source: 'Demo Wire', headline: `${ticker} 관련 AI 인프라 수요 기대 지속`, url: '#' },
          { id: 2, datetime: Math.floor(Date.now() / 1000) - 86400, source: 'Demo Market', headline: `${ticker} 다음 실적 발표 전 변동성 확대`, url: '#' },
        ],
      }));
      setNewsState((prev) => ({ ...prev, [ticker]: 'loaded' }));
      return;
    }
    if (news[ticker]) return;
    setNewsState((prev) => ({ ...prev, [ticker]: 'loading' }));
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 7);
    try {
      const data = await fetchFinnhubJson('company-news', {
        symbol: ticker,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const items = (Array.isArray(data) ? data : []).slice(0, 6) as NewsItem[];
      setNews((prev) => ({ ...prev, [ticker]: items }));
      setNewsState((prev) => ({ ...prev, [ticker]: items.length ? 'loaded' : 'empty' }));
    } catch {
      setNewsState((prev) => ({ ...prev, [ticker]: 'error' }));
      notify(`${ticker} 뉴스를 불러오지 못했습니다`);
    }
  }

  function saveHolding(item: HoldingItem) {
    const ticker = normalizeTicker(item.ticker);
    if (!ticker || !item.shares || !item.avgCost) {
      notify('티커, 수량, 평단가는 필수입니다');
      return;
    }
    setHoldings((prev) => {
      const entry = { ...item, ticker };
      const exists = prev.some((x) => x.ticker === ticker);
      if (editingHolding) return prev.map((x) => (x.ticker === editingHolding.ticker ? { ...x, ...entry, buyDate: entry.buyDate || x.buyDate } : x));
      if (exists) {
        notify('이미 보유 중인 티커입니다');
        return prev;
      }
      return [...prev, entry];
    });
    setShowHoldingForm(false);
    setEditingHolding(null);
  }

  function saveWatch(item: WatchItem) {
    const ticker = normalizeTicker(item.ticker);
    if (!ticker) {
      notify('티커를 입력해주세요');
      return;
    }
    setWatch((prev) => {
      const entry = { ...item, ticker };
      if (editingWatch) return prev.map((x) => (x.ticker === editingWatch.ticker ? entry : x));
      if (prev.some((x) => x.ticker === ticker)) {
        notify('이미 관심 티커에 있습니다');
        return prev;
      }
      return [...prev, entry];
    });
    setShowWatchForm(false);
    setEditingWatch(null);
  }

  function saveTrade(item: JournalItem, syncHolding: boolean) {
    const trade = { ...item, ticker: normalizeTicker(item.ticker), id: item.id || uid() };
    if (!trade.ticker || !trade.shares || !trade.price) {
      notify('티커, 수량, 단가는 필수입니다');
      return;
    }
    if (syncHolding && !editingTrade) {
      setCash((prev) => prev + (trade.action === 'buy' ? -1 : 1) * trade.shares * trade.price - (trade.fee || 0));
      setHoldings((prev) => {
        const idx = prev.findIndex((x) => x.ticker === trade.ticker);
        if (trade.action === 'buy') {
          if (idx >= 0) {
            return prev.map((x, i) => {
              if (i !== idx) return x;
              const totalShares = x.shares + trade.shares;
              return {
                ...x,
                shares: totalShares,
                avgCost: ((x.shares * x.avgCost) + (trade.shares * trade.price)) / totalShares,
                buyDate: x.buyDate || trade.date,
                lastBuyDate: trade.date,
              };
            });
          }
          return [...prev, { ticker: trade.ticker, shares: trade.shares, avgCost: trade.price, buyDate: trade.date, lastBuyDate: trade.date }];
        }
        if (idx < 0) return prev;
        return prev
          .map((x, i) => (i === idx ? { ...x, shares: x.shares - trade.shares } : x))
          .filter((x) => x.shares > 0);
      });
    }
    setJournal((prev) => (editingTrade ? prev.map((x) => (x.id === editingTrade.id ? trade : x)) : [...prev, trade]));
    setShowTradeForm(false);
    setEditingTrade(null);
  }

  function recordToday() {
    const entry: HistoryEntry = {
      date: today(),
      totalValue: summary.totalAsset,
      stockValue: summary.stockValue,
      cashValue: cash,
      totalCost: summary.totalCost,
    };
    setHistory((prev) => [entry, ...prev.filter((x) => x.date !== entry.date)].sort((a, b) => b.date.localeCompare(a.date)));
    notify('오늘 기록을 저장했습니다');
  }

  function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), h: holdings, w: watch, j: journal, hi: history, c: cash };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function makeShareUrl() {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(portfolioSummaryPayload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    const url = `${window.location.origin}/open#share=${encoded}`;
    if (!navigator.clipboard) {
      notify(url);
      return;
    }
    navigator.clipboard.writeText(url).then(() => notify('공유 링크를 복사했습니다')).catch(() => notify(url));
  }

  function exportPdfReport() {
    setPdfPayload(portfolioSummaryPayload);
    window.setTimeout(() => window.print(), 100);
  }

  function signInWithGoogle() {
    return signInWithPopup(getFirebaseAuth(), googleProvider).catch((e) => notify(e.message));
  }

  function signOutCurrent() {
    return signOut(getFirebaseAuth());
  }

  function saveCash(nextCash: number) {
    setCash(nextCash);
    setShowCashForm(false);
  }

  return {
    ready,
    user,
    demo,
    tab,
    setTab,
    holdings,
    setHoldings,
    watch,
    setWatch,
    journal,
    setJournal,
    history,
    cash,
    setCash,
    prices,
    krw,
    setKrw,
    theme,
    setTheme,
    rate,
    status,
    loadingPrices,
    toast,
    editingHolding,
    setEditingHolding,
    editingWatch,
    setEditingWatch,
    editingTrade,
    setEditingTrade,
    showHoldingForm,
    setShowHoldingForm,
    showWatchForm,
    setShowWatchForm,
    showTradeForm,
    setShowTradeForm,
    showCashForm,
    setShowCashForm,
    selectedTicker,
    news,
    newsState,
    earnings,
    loadingEarnings,
    sharePayload,
    pdfPayload,
    setPdfPayload,
    rows,
    summary,
    notify,
    refreshPrices,
    refreshEarnings,
    openTickerDetail,
    saveHolding,
    saveWatch,
    saveTrade,
    saveCash,
    recordToday,
    exportBackup,
    makeShareUrl,
    exportPdfReport,
    signInWithGoogle,
    signOutCurrent,
  };
}
