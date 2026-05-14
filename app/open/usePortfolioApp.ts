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
  earningsSymbolMatches,
  normalizeHistory,
  normalizeTicker,
  readJson,
  today,
  uid,
  writeJson,
  type EarningsItem,
  type GoalConfig,
  type HistoryEntry,
  type PaperAccount,
  type PaperTrade,
  type Price,
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
  const [useExtendedHours, setUseExtendedHours] = useState(true);
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
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingHistory, setEditingHistory] = useState<HistoryEntry | null>(null);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [pdfPayload, setPdfPayload] = useState<SharePayload | null>(null);
  const [tickerMemos, setTickerMemos] = useState<Record<string, string>>({});
  const [benchData, setBenchData] = useState<{ date: string; price: number }[]>([]);
  const [goalConfig, setGoalConfig] = useState<GoalConfig | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [paperAccounts, setPaperAccounts] = useState<PaperAccount[]>([]);
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);
  const [selectedPaperAccountId, setSelectedPaperAccountId] = useState('');
  const [editingPaperAccount, setEditingPaperAccount] = useState<PaperAccount | null>(null);
  const [editingPaperTrade, setEditingPaperTrade] = useState<PaperTrade | null>(null);
  const [showPaperAccountForm, setShowPaperAccountForm] = useState(false);
  const [showPaperTradeForm, setShowPaperTradeForm] = useState(false);
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

    const localHoldings = readJson<HoldingItem[]>(K.holdings, []);
    const localWatch = readJson<WatchItem[]>(K.watch, []);
    const localMemos = readJson<Record<string, string>>(K.memos, {});
    const localGoal = readJson<GoalConfig | null>(K.goal, null);
    // holding.note / watch.note → tickerMemos 흡수 (tickerMemos에 값이 없는 경우만)
    const seedMemos = { ...localMemos };
    localHoldings.forEach((h) => { if (h.note && !seedMemos[h.ticker]) seedMemos[h.ticker] = h.note; });
    localWatch.forEach((w) => { if (w.note && !seedMemos[w.ticker]) seedMemos[w.ticker] = w.note; });
    setHoldings(localHoldings);
    setWatch(localWatch);
    setJournal(readJson<JournalItem[]>(K.journal, []));
    setHistory(readJson<HistoryEntry[]>(K.history, []));
    const localPaperAccounts = readJson<PaperAccount[]>(K.paperAccounts, []);
    const localPaperTrades = readJson<PaperTrade[]>(K.paperTrades, []);
    setPaperAccounts(localPaperAccounts);
    setPaperTrades(localPaperTrades);
    setSelectedPaperAccountId(localPaperAccounts[0]?.id ?? '');
    setCash(readJson<number>(K.cash, 0));
    setPrices(readJson<PriceMap>(K.prices, {}));
    setKrw(readJson<boolean>(K.krw, false));
    setTheme(readJson<'light' | 'dark'>(K.theme, 'light'));
    setUseExtendedHours(readJson<boolean>(K.extendedHours, true));
    setTickerMemos(seedMemos);
    setGoalConfig(localGoal);
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
          const loadedHoldings = data.h ?? [];
          const loadedWatch = data.w ?? [];
          setHoldings(loadedHoldings);
          setWatch(loadedWatch);
          setJournal(data.j ?? []);
          setHistory(normalizeHistory(data.hi));
          const loadedPaperAccounts = data.pa ?? [];
          const loadedPaperTrades = data.pt ?? [];
          setPaperAccounts(loadedPaperAccounts);
          setPaperTrades(loadedPaperTrades);
          setSelectedPaperAccountId((current) => current || loadedPaperAccounts[0]?.id || '');
          setCash(data.c ?? 0);
          setUseExtendedHours(data.xh ?? readJson<boolean>(K.extendedHours, true));
          const loadedGoal = data.g ?? localGoal ?? null;
          setGoalConfig(loadedGoal);
          // holding.note / watch.note → tickerMemos 흡수 (tickerMemos에 값이 없는 경우만)
          const mergedMemos: Record<string, string> = { ...(data.m ?? {}) };
          loadedHoldings.forEach((h) => { if (h.note && !mergedMemos[h.ticker]) mergedMemos[h.ticker] = h.note; });
          loadedWatch.forEach((w) => { if (w.note && !mergedMemos[w.ticker]) mergedMemos[w.ticker] = w.note; });
          setTickerMemos(mergedMemos);
          writeJson(K.holdings, loadedHoldings);
          writeJson(K.watch, data.w ?? []);
          writeJson(K.journal, data.j ?? []);
          writeJson(K.history, data.hi ?? []);
          writeJson(K.paperAccounts, loadedPaperAccounts);
          writeJson(K.paperTrades, loadedPaperTrades);
          writeJson(K.cash, data.c ?? 0);
          writeJson(K.memos, mergedMemos);
          writeJson(K.extendedHours, data.xh ?? readJson<boolean>(K.extendedHours, true));
          writeJson(K.goal, loadedGoal);
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
    if (!ready || sharePayload || demo) return;
    if (history.length >= 2) refreshBenchmark();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, history.length, sharePayload, tab]);

  useEffect(() => {
    if (!ready || demo) return;
    writeJson(K.holdings, holdings);
    writeJson(K.watch, watch);
    writeJson(K.journal, journal);
    writeJson(K.history, history);
    writeJson(K.paperAccounts, paperAccounts);
    writeJson(K.paperTrades, paperTrades);
    writeJson(K.cash, cash);
    writeJson(K.prices, prices);
    writeJson(K.krw, krw);
    writeJson(K.extendedHours, useExtendedHours);
    writeJson(K.memos, tickerMemos);
    writeJson(K.goal, goalConfig);
  }, [ready, demo, holdings, watch, journal, history, paperAccounts, paperTrades, cash, prices, krw, useExtendedHours, tickerMemos, goalConfig]);

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
          pa: paperAccounts,
          pt: paperTrades,
          c: cash,
          m: tickerMemos,
          xh: useExtendedHours,
          g: goalConfig,
        });
        setStatus('Firebase 동기화 완료');
      } catch {
        setStatus('Firebase 동기화 실패');
      }
    }, 1200);
  }, [user, demo, holdings, watch, journal, history, paperAccounts, paperTrades, cash, tickerMemos, useExtendedHours, goalConfig]);

  const rows = useMemo(() => {
    let totalValue = 0;
    const enriched = holdings.map((h) => {
      const quote = prices[h.ticker];
      const price = quote?.price ?? 0;
      const value = price * h.shares;
      const cost = h.avgCost * h.shares;
      totalValue += value;
      return {
        ...h,
        price,
        priceSession: quote?.session,
        priceSource: quote?.source,
        regularPrice: quote?.regularPrice,
        extendedPrice: quote?.extendedPrice,
        regularChangePercent: quote?.regularChangePercent,
        extendedChangePercent: quote?.extendedChangePercent,
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

  const paperSnapshots = useMemo(() => {
    return paperAccounts.map((account) => buildPaperSnapshot(account, paperTrades.filter((trade) => trade.accountId === account.id), prices));
  }, [paperAccounts, paperTrades, prices]);

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
    const paperTickers = paperTrades.map((trade) => trade.ticker);
    const tickers = Array.from(new Set([...holdings.map((h) => h.ticker), ...watch.map((w) => w.ticker), ...paperTickers])).filter(Boolean);
    if (!tickers.length) return;
    setLoadingPrices(true);
    try {
      fetch('https://open.er-api.com/v6/latest/USD')
        .then((r) => r.json())
        .then((d) => setRate(d.rates.KRW || 0))
        .catch(() => undefined);
      const token = await current.getIdToken();
      const next: PriceMap = { ...prices };
      const yahooQuotes = await fetch(`/api/market/quote?symbols=${encodeURIComponent(tickers.join(','))}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.ok ? res.json() : null)
        .catch(() => null);
      const yahooMap = new Map<string, unknown>(
        ((yahooQuotes?.quotes ?? []) as Array<{ symbol?: string }>)
          .filter((item) => item.symbol)
          .map((item) => [String(item.symbol).toUpperCase(), item])
      );
      const missing: string[] = [];
      for (const ticker of tickers) {
        const parsed = parseYahooQuote(yahooMap.get(ticker), useExtendedHours);
        if (parsed) next[ticker] = parsed;
        else missing.push(ticker);
      }
      if (missing.length) {
        const fallbackResults = await Promise.all(
          missing.map((ticker) =>
            fetch(`/api/finnhub/quote?symbol=${encodeURIComponent(ticker)}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((res) => res.ok ? res.json() : null)
              .catch(() => null)
              .then((data) => ({ ticker, data }))
          )
        );
        for (const { ticker, data } of fallbackResults) {
          if (data?.c) next[ticker] = { price: data.c, changePercent: data.dp ?? 0, regularChangePercent: data.dp ?? 0, prevClose: data.pc ?? data.c, session: 'regular', source: 'finnhub' };
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

  function parseYahooQuote(raw: unknown, allowExtendedHours: boolean): Price | null {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const regular = numberValue(item.regularMarketPrice);
    const prevClose = numberValue(item.regularMarketPreviousClose) ?? regular;
    const marketState = String(item.marketState ?? '').toUpperCase();
    const pre = numberValue(item.preMarketPrice);
    const post = numberValue(item.postMarketPrice);
    const regularPct = numberValue(item.regularMarketChangePercent);
    if (!regular && !pre && !post) return null;
    const baseRegularPct = regular ? regularPct ?? percentFromPrev(regular, prevClose) : undefined;
    const extendedBasePrice = regular ?? prevClose;

    if (allowExtendedHours && (marketState === 'PRE' || marketState === 'PREPRE') && pre) {
      const extendedPct = percentFromPrev(pre, extendedBasePrice);
      return { price: pre, changePercent: extendedPct, regularChangePercent: baseRegularPct, extendedChangePercent: extendedPct, prevClose: prevClose ?? pre, session: 'pre', source: 'yahoo', regularPrice: regular ?? undefined, extendedPrice: pre };
    }
    if (allowExtendedHours && (marketState === 'POST' || marketState === 'POSTPOST') && post) {
      const extendedPct = percentFromPrev(post, extendedBasePrice);
      return { price: post, changePercent: extendedPct, regularChangePercent: baseRegularPct, extendedChangePercent: extendedPct, prevClose: prevClose ?? post, session: 'post', source: 'yahoo', regularPrice: regular ?? undefined, extendedPrice: post };
    }
    const price = regular ?? pre ?? post!;
    const changePercent = regularPct ?? percentFromPrev(price, prevClose);
    return { price, changePercent, regularChangePercent: changePercent, prevClose: prevClose ?? price, session: marketState === 'REGULAR' ? 'regular' : 'closed', source: 'yahoo', regularPrice: regular ?? undefined };
  }

  function numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function percentFromPrev(price: number, prev?: number | null) {
    return prev ? ((price - prev) / prev) * 100 : 0;
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
      const responses = await Promise.all(
        tickers.flatMap((ticker) => earningsLookupSymbols(ticker).map((symbol) => (
          fetchFinnhubJson('calendar/earnings', { from: fmt(from), to: fmt(to), symbol }).catch(() => null)
        )))
      );
      const rows = responses
        .flatMap((data) => ((data?.earningsCalendar ?? []) as EarningsItem[]))
        .filter((item) => tickers.some((ticker) => earningsSymbolMatches(ticker, item.symbol)))
        .filter((item, index, list) => list.findIndex((x) => x.symbol === item.symbol && x.date === item.date) === index)
        .sort((a, b) => a.date.localeCompare(b.date));
      setEarnings(rows);
      setStatus(`실적 일정 ${rows.length}건 갱신`);
    } catch {
      notify('실적 일정을 불러오지 못했습니다');
    } finally {
      setLoadingEarnings(false);
    }
  }

  function openTickerDetail(ticker: string) {
    setSelectedTicker(ticker);
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
    // 종목 폼의 note도 tickerMemos에 동기화
    if (item.note !== undefined) {
      setTickerMemos((prev) => ({ ...prev, [ticker]: item.note ?? prev[ticker] ?? '' }));
    }
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
        notify('이미 관심 종목에 있습니다');
        return prev;
      }
      return [...prev, entry];
    });
    // 관심 종목 note → tickerMemos 동기화
    if (item.note !== undefined) {
      setTickerMemos((prev) => ({ ...prev, [ticker]: item.note ?? prev[ticker] ?? '' }));
    }
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

  function recordToday(date: string) {
    const entry: HistoryEntry = {
      date,
      totalValue: summary.totalAsset,
      stockValue: summary.stockValue,
      cashValue: cash,
      totalCost: summary.totalCost,
    };
    setHistory((prev) => [entry, ...prev.filter((x) => x.date !== entry.date)].sort((a, b) => b.date.localeCompare(a.date)));
    setShowRecordForm(false);
    notify('자산 기록을 저장했습니다');
  }

  function saveHistory(entry: HistoryEntry) {
    setHistory((prev) => [entry, ...prev.filter((x) => x.date !== entry.date)].sort((a, b) => b.date.localeCompare(a.date)));
    setShowHistoryForm(false);
    setEditingHistory(null);
    notify('자산 기록을 수정했습니다');
  }

  function deleteHistory(date: string) {
    setHistory((prev) => prev.filter((x) => x.date !== date));
    notify('자산 기록을 삭제했습니다');
  }

  function exportBackup() {
    try {
      const payload = buildAiExportPayload();
      validateAiExport(payload);
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio_ai_export_${fileTimestamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('AI 포트폴리오 JSON을 저장했습니다');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export error';
      notify(message);
      console.error(error);
    }
  }

  function buildAiExportPayload() {
    const exportedAt = new Date().toISOString();
    const maxDrawdownValue = rows.reduce((sum, row) => {
      if (!row.price || !row.stopLoss || row.price <= row.stopLoss) return sum;
      return sum + (row.price - row.stopLoss) * row.shares;
    }, 0);
    const stockValue = roundNumber(summary.stockValue);
    const totalAsset = roundNumber(summary.totalAsset);
    const exportedHoldings = rows.map((row) => {
      const price = roundNumber(row.price);
      const shares = roundNumber(row.shares, 4);
      const avgCost = roundNumber(row.avgCost);
      const cost = roundNumber(shares * avgCost);
      const value = roundNumber(shares * price);
      const pnl = roundNumber(value - cost);
      const rr = row.price && row.targetPrice && row.stopLoss && row.price > row.stopLoss && row.targetPrice > row.price
        ? roundNumber((row.targetPrice - row.price) / (row.price - row.stopLoss), 2)
        : null;
      return {
        ticker: row.ticker,
        name: row.name ?? '',
        shares,
        avgCost,
        cost,
        price,
        regularPrice: row.regularPrice ? roundNumber(row.regularPrice) : price,
        extendedPrice: row.extendedPrice ? roundNumber(row.extendedPrice) : null,
        priceSession: row.priceSession ?? null,
        priceSource: row.priceSource ?? null,
        value,
        pnl,
        pnlPct: cost ? roundNumber((pnl / cost) * 100) : 0,
        dayPct: roundNumber(row.dayPct),
        weightStock: stockValue ? roundNumber((value / stockValue) * 100) : 0,
        weightTotal: totalAsset ? roundNumber((value / totalAsset) * 100) : 0,
        buyDate: row.buyDate ?? null,
        lastBuyDate: row.lastBuyDate ?? row.buyDate ?? null,
        stopLoss: row.stopLoss ? roundNumber(row.stopLoss) : null,
        targetPrice: row.targetPrice ? roundNumber(row.targetPrice) : null,
        rr,
        note: tickerMemos[row.ticker] ?? row.note ?? '',
      };
    });
    const exportedTrades = journal.map((trade) => {
      const shares = roundNumber(trade.shares, 4);
      const price = roundNumber(trade.price);
      return {
        id: trade.id,
        date: trade.date,
        side: trade.action.toUpperCase(),
        ticker: trade.ticker,
        shares,
        price,
        amount: roundNumber(shares * price),
        fee: roundNumber(trade.fee ?? 0),
        strategy: trade.strategy || '-',
        memo: trade.note ?? '',
      };
    });
    const exportedWatchlist = watch.map((item) => {
      const quote = prices[item.ticker];
      const currentPrice = quote?.price ? roundNumber(quote.price) : null;
      const targetEntry = item.targetBuy ? roundNumber(item.targetBuy) : null;
      const distancePct = currentPrice && targetEntry
        ? roundNumber(Math.max(0, ((currentPrice - targetEntry) / currentPrice) * 100))
        : null;
      return {
        ticker: item.ticker,
        name: item.name ?? '',
        currentPrice,
        targetEntry,
        distancePct,
        dayPct: quote?.changePercent === undefined ? null : roundNumber(quote.changePercent),
        memo: tickerMemos[item.ticker] ?? item.note ?? '',
      };
    });

    return {
      schemaVersion: '2.0',
      exportPurpose: 'ai_portfolio_analysis',
      summary: {
        exportedAt,
        stockValue,
        cash: roundNumber(cash),
        totalAsset,
        totalCost: roundNumber(summary.totalCost),
        totalPnl: roundNumber(summary.totalPnl),
        totalPnlPct: roundNumber(summary.totalPnlPct),
        todayPnl: roundNumber(summary.dayPnl),
        maxDrawdown: roundNumber(-maxDrawdownValue),
        maxDrawdownPct: totalAsset ? roundNumber((maxDrawdownValue / totalAsset) * 100) : 0,
      },
      holdings: exportedHoldings,
      trades: exportedTrades,
      watchlist: exportedWatchlist,
      history,
    };
  }

  function validateAiExport(data: ReturnType<typeof buildAiExportPayload>) {
    const required = ['ticker', 'shares', 'avgCost', 'price', 'value', 'pnl', 'pnlPct', 'weightStock', 'weightTotal'] as const;
    const holdingsSum = roundNumber(data.holdings.reduce((sum, item) => sum + item.value, 0));
    if (!withinTolerance(holdingsSum, data.summary.stockValue, 1)) {
      throw new Error('Export error: holdings value sum does not match stockValue');
    }
    if (!withinTolerance(data.summary.stockValue + data.summary.cash, data.summary.totalAsset, 1)) {
      throw new Error('Export error: totalAsset does not match stockValue + cash');
    }
    for (const holding of data.holdings) {
      for (const key of required) {
        const value = holding[key];
        if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) {
          throw new Error(`Export error: missing ${key} for ${holding.ticker}`);
        }
      }
      if (holding.shares <= 0 || holding.price <= 0) {
        throw new Error(`Export error: missing live price or shares for ${holding.ticker}`);
      }
      const expectedValue = roundNumber(holding.shares * holding.price);
      if (!withinTolerance(expectedValue, holding.value, Math.max(1, Math.abs(holding.value) * 0.005))) {
        throw new Error(`Export error: invalid value for ${holding.ticker}`);
      }
      const expectedCost = roundNumber(holding.shares * holding.avgCost);
      const expectedPnl = roundNumber(holding.value - expectedCost);
      if (!withinTolerance(expectedPnl, holding.pnl, Math.max(1, Math.abs(holding.pnl) * 0.005))) {
        throw new Error(`Export error: invalid pnl for ${holding.ticker}`);
      }
    }
  }

  function withinTolerance(expected: number, actual: number, tolerance: number) {
    return Math.abs(expected - actual) <= tolerance;
  }

  function roundNumber(value: number, digits = 2) {
    if (!Number.isFinite(value)) return 0;
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
  }

  function fileTimestamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
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

  function earningsLookupSymbols(ticker: string) {
    if (ticker === 'GOOGL') return ['GOOGL', 'GOOG'];
    if (ticker === 'GOOG') return ['GOOG', 'GOOGL'];
    return [ticker];
  }

  function saveTickerMemo(ticker: string, text: string) {
    setTickerMemos((prev) => ({ ...prev, [ticker]: text }));
    // 보유 종목 note 동기화
    setHoldings((prev) => prev.map((h) => h.ticker === ticker ? { ...h, note: text } : h));
    // 관심 종목 note 동기화
    setWatch((prev) => prev.map((w) => w.ticker === ticker ? { ...w, note: text } : w));
  }

  function saveGoal(config: GoalConfig) {
    setGoalConfig(config);
    writeJson(K.goal, config);
    setShowGoalForm(false);
    notify('투자 목표를 저장했습니다');
  }

  function savePaperAccount(item: PaperAccount) {
    const name = item.name.trim();
    if (!name || !item.initialCash) {
      notify('계좌명과 시작 현금은 필수입니다');
      return;
    }
    const account = { ...item, id: item.id || uid(), name, createdAt: item.createdAt || today() };
    setPaperAccounts((prev) => {
      const next = editingPaperAccount ? prev.map((x) => (x.id === editingPaperAccount.id ? account : x)) : [...prev, account];
      if (!selectedPaperAccountId) setSelectedPaperAccountId(account.id);
      return next;
    });
    setEditingPaperAccount(null);
    setShowPaperAccountForm(false);
  }

  function deletePaperAccount(id: string) {
    setPaperAccounts((prev) => prev.filter((item) => item.id !== id));
    setPaperTrades((prev) => prev.filter((item) => item.accountId !== id));
    setSelectedPaperAccountId((current) => current === id ? paperAccounts.find((item) => item.id !== id)?.id ?? '' : current);
  }

  function savePaperTrade(item: PaperTrade) {
    const trade = { ...item, ticker: normalizeTicker(item.ticker), id: item.id || uid() };
    if (!trade.accountId || !trade.ticker || !trade.shares || !trade.price) {
      notify('계좌, 티커, 수량, 단가는 필수입니다');
      return;
    }
    setPaperTrades((prev) => (editingPaperTrade ? prev.map((x) => (x.id === editingPaperTrade.id ? trade : x)) : [trade, ...prev]));
    setSelectedPaperAccountId(trade.accountId);
    setEditingPaperTrade(null);
    setShowPaperTradeForm(false);
  }

  function deletePaperTrade(id: string) {
    setPaperTrades((prev) => prev.filter((item) => item.id !== id));
  }

  function exportPaperTrading() {
    const payload = {
      schemaVersion: '1.0',
      exportPurpose: 'paper_trading',
      exportedAt: new Date().toISOString(),
      accounts: paperAccounts,
      trades: paperTrades,
      snapshots: paperSnapshots,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper_trading_export_${fileTimestamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('모의투자 JSON을 저장했습니다');
  }

  async function importPaperTrading(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { accounts?: PaperAccount[]; trades?: PaperTrade[] };
      if (!Array.isArray(data.accounts) || !Array.isArray(data.trades)) throw new Error('모의투자 JSON 형식이 아닙니다');
      setPaperAccounts(data.accounts);
      setPaperTrades(data.trades);
      setSelectedPaperAccountId(data.accounts[0]?.id ?? '');
      notify('모의투자 데이터를 불러왔습니다');
    } catch (error) {
      notify(error instanceof Error ? error.message : '모의투자 가져오기에 실패했습니다');
    }
  }

  function cloneCurrentPortfolioToPaper() {
    if (!rows.length) {
      notify('복사할 보유 티커가 없습니다');
      return;
    }
    const accountId = uid();
    const account: PaperAccount = {
      id: accountId,
      name: `현재 포트폴리오 복사 ${today()}`,
      owner: 'me',
      initialCash: roundNumber(summary.totalCost + cash),
      createdAt: today(),
      note: '실계좌 현재 보유 상태를 모의투자 시작점으로 복사',
    };
    const trades: PaperTrade[] = rows.map((row) => ({
      id: uid(),
      accountId,
      date: row.buyDate ?? row.lastBuyDate ?? today(),
      action: 'buy',
      ticker: row.ticker,
      shares: row.shares,
      price: row.avgCost,
      fee: 0,
      strategy: 'current-portfolio-import',
      thesis: '실계좌 현재 보유 상태에서 생성',
      note: row.note ?? tickerMemos[row.ticker] ?? '',
    }));
    setPaperAccounts((prev) => [...prev, account]);
    setPaperTrades((prev) => [...trades, ...prev]);
    setSelectedPaperAccountId(accountId);
    setTab('paper');
    notify('현재 포트폴리오를 모의계좌로 복사했습니다');
  }

  function buildPaperSnapshot(account: PaperAccount, tradesForAccount: PaperTrade[], quoteMap: PriceMap) {
    const positions: Record<string, { ticker: string; shares: number; cost: number }> = {};
    let cash = account.initialCash;
    let realizedPnl = 0;
    const sorted = [...tradesForAccount].sort((a, b) => a.date.localeCompare(b.date));
    for (const trade of sorted) {
      const fee = trade.fee ?? 0;
      const amount = trade.shares * trade.price;
      if (trade.action === 'buy') {
        cash -= amount + fee;
        const current = positions[trade.ticker] ?? { ticker: trade.ticker, shares: 0, cost: 0 };
        current.shares += trade.shares;
        current.cost += amount;
        positions[trade.ticker] = current;
      } else {
        cash += amount - fee;
        const current = positions[trade.ticker];
        const avgCost = current?.shares ? current.cost / current.shares : trade.price;
        realizedPnl += (trade.price - avgCost) * trade.shares - fee;
        if (current) {
          current.shares -= trade.shares;
          current.cost = Math.max(0, current.cost - avgCost * trade.shares);
          if (current.shares <= 0.000001) delete positions[trade.ticker];
        }
      }
    }
    const rawHoldings = Object.values(positions).map((position) => {
      const quote = quoteMap[position.ticker];
      const avgCost = position.shares ? position.cost / position.shares : 0;
      const price = quote?.price ?? avgCost;
      const value = price * position.shares;
      const pnl = value - position.cost;
      return {
        ticker: position.ticker,
        shares: position.shares,
        avgCost,
        price,
        value,
        cost: position.cost,
        pnl,
        pnlPct: position.cost ? (pnl / position.cost) * 100 : 0,
        dayPct: quote?.changePercent ?? 0,
        priceSession: quote?.session,
        priceSource: quote?.source,
      };
    }).sort((a, b) => b.value - a.value);
    const stockValue = rawHoldings.reduce((sum, item) => sum + item.value, 0);
    const totalAsset = cash + stockValue;
    const holdingsWithWeight = rawHoldings.map((item) => ({
      ...item,
      weight: stockValue ? (item.value / stockValue) * 100 : 0,
      totalWeight: totalAsset ? (item.value / totalAsset) * 100 : 0,
    }));
    const totalCost = holdingsWithWeight.reduce((sum, item) => sum + item.cost, 0);
    const unrealizedPnl = holdingsWithWeight.reduce((sum, item) => sum + item.pnl, 0);
    return {
      account,
      holdings: holdingsWithWeight,
      trades: [...tradesForAccount].sort((a, b) => b.date.localeCompare(a.date)),
      summary: {
        cash,
        stockValue,
        totalAsset,
        totalCost,
        unrealizedPnl,
        realizedPnl,
        totalPnl: realizedPnl + unrealizedPnl,
        totalPnlPct: account.initialCash ? ((totalAsset - account.initialCash) / account.initialCash) * 100 : 0,
        tradeCount: tradesForAccount.length,
      },
    };
  }

  async function refreshBenchmark() {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return;
    const from = Math.floor(new Date(sorted[0].date + 'T00:00:00').getTime() / 1000);
    const to = Math.floor(Date.now() / 1000);
    try {
      // Yahoo Finance 프록시 사용 (API 키 불필요, Finnhub 레이트 리밋 무관)
      const res = await fetch(`/api/spy-history?from=${from}&to=${to}`);
      if (!res.ok) return;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) return;
      const timestamps: number[] = result.timestamp ?? [];
      const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
      const candles = timestamps
        .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), price: closes[i] }))
        .filter((c) => typeof c.price === 'number' && !isNaN(c.price));
      setBenchData(candles);
    } catch {
      // 벤치마크 조회 실패는 무시
    }
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
    useExtendedHours,
    setUseExtendedHours,
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
    showRecordForm,
    setShowRecordForm,
    editingHistory,
    setEditingHistory,
    showHistoryForm,
    setShowHistoryForm,
    selectedTicker,
    earnings,
    loadingEarnings,
    sharePayload,
    tickerMemos,
    benchData,
    saveTickerMemo,
    refreshBenchmark,
    goalConfig,
    showGoalForm,
    setShowGoalForm,
    saveGoal,
    paperAccounts,
    paperTrades,
    paperSnapshots,
    selectedPaperAccountId,
    setSelectedPaperAccountId,
    editingPaperAccount,
    setEditingPaperAccount,
    editingPaperTrade,
    setEditingPaperTrade,
    showPaperAccountForm,
    setShowPaperAccountForm,
    showPaperTradeForm,
    setShowPaperTradeForm,
    savePaperAccount,
    deletePaperAccount,
    savePaperTrade,
    deletePaperTrade,
    exportPaperTrading,
    importPaperTrading,
    cloneCurrentPortfolioToPaper,
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
    saveHistory,
    deleteHistory,
    exportBackup,
    makeShareUrl,
    exportPdfReport,
    signInWithGoogle,
    signOutCurrent,
  };
}
