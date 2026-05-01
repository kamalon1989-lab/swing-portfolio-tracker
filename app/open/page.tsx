'use client';

import { CashForm, HoldingForm, TradeForm, WatchForm } from './forms';
import { AssetsView, MobileTabs, PortfolioPdfReport, ShareView } from './panels';
import { JournalView, PortfolioView, WatchView } from './views';
import { usePortfolioApp } from './usePortfolioApp';

export default function OpenPage() {
  const app = usePortfolioApp();
  const {
    ready,
    user,
    demo,
    tab,
    setTab,
    setHoldings,
    watch,
    setWatch,
    journal,
    setJournal,
    history,
    cash,
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
  } = app;

  if (!ready) return <main className="min-h-screen grid place-items-center text-slate-500">불러오는 중...</main>;

  if (sharePayload) return <ShareView payload={sharePayload} />;

  const signedIn = demo || user;

  return (
    <>
    <main className="min-h-screen bg-bg text-text print:hidden">
      {toast && <div className="fixed right-5 top-5 z-50 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg">{toast.message}</div>}
      {demo && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">
          데모 모드입니다. 변경사항은 저장되지 않습니다.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <a href="/" className="font-bold">스윙 포트폴리오</a>
          {signedIn && (
            <nav className="hidden gap-1 rounded-lg bg-bg p-1 sm:flex">
              {([
                ['portfolio', '포트폴리오'],
                ['assets', '자산 분석'],
                ['watchlist', '관심 종목'],
                ['journal', '매매 일지'],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === key ? 'bg-card text-brand shadow-sm' : 'text-sub hover:text-text'}`}>
                  {label}
                </button>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-sub md:inline">{status}</span>
            {signedIn && (
              <>
                <button onClick={() => setKrw((v) => !v)} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${krw ? 'border-brand bg-brand/10 text-brand' : 'border-border text-sub'}`}>원화</button>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-sub">
                  {theme === 'dark' ? '라이트' : '다크'}
                </button>
                <button onClick={refreshPrices} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" disabled={loadingPrices}>
                  {loadingPrices ? '조회 중' : '시세 갱신'}
                </button>
              </>
            )}
            {user ? (
              <button onClick={signOutCurrent} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-sub">로그아웃</button>
            ) : !demo ? null : (
              <a href="/open" className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-sub">로그인</a>
            )}
          </div>
        </div>
      </header>

      {!signedIn ? (
        <section className="mx-auto grid min-h-[calc(100vh-57px)] max-w-md place-items-center px-6">
          <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="text-4xl">📊</div>
            <h1 className="mt-4 text-2xl font-bold">스윙 포트폴리오</h1>
            <p className="mt-2 text-sm leading-6 text-sub">Google 계정으로 로그인하면 기존 Firebase 데이터를 그대로 불러옵니다.</p>
            <button onClick={signInWithGoogle} className="mt-6 w-full rounded-xl bg-brand px-4 py-3 font-bold text-white">
              Google로 로그인
            </button>
            <a href="/open?demo=1" className="mt-3 inline-flex text-sm font-semibold text-brand">데모 먼저 보기</a>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-5">
          <MobileTabs tab={tab} setTab={setTab} />
          {tab === 'portfolio' && (
            <PortfolioView
              rows={rows}
              summary={summary}
              cash={cash}
              krw={krw}
              rate={rate}
              onEditCash={() => setShowCashForm(true)}
              onAdd={() => { setEditingHolding(null); setShowHoldingForm(true); }}
              onEdit={(item) => { setEditingHolding(item); setShowHoldingForm(true); }}
              onDelete={(ticker) => setHoldings((prev) => prev.filter((x) => x.ticker !== ticker))}
              onRecord={recordToday}
              onShare={makeShareUrl}
              onPdf={exportPdfReport}
              onExport={exportBackup}
              selectedTicker={selectedTicker}
              onSelectTicker={openTickerDetail}
              selectedNews={selectedTicker ? news[selectedTicker] ?? [] : []}
              selectedNewsState={selectedTicker ? newsState[selectedTicker] ?? 'idle' : 'idle'}
              theme={theme}
              earnings={earnings}
              loadingEarnings={loadingEarnings}
              onRefreshEarnings={refreshEarnings}
            />
          )}
          {tab === 'assets' && <AssetsView history={history} rows={rows} summary={summary} cash={cash} krw={krw} rate={rate} />}
          {tab === 'watchlist' && (
            <WatchView
              watch={watch}
              prices={prices}
              onAdd={() => { setEditingWatch(null); setShowWatchForm(true); }}
              onEdit={(item) => { setEditingWatch(item); setShowWatchForm(true); }}
              onDelete={(ticker) => setWatch((prev) => prev.filter((x) => x.ticker !== ticker))}
              onSelectTicker={openTickerDetail}
              selectedTicker={selectedTicker}
              selectedNews={selectedTicker ? news[selectedTicker] ?? [] : []}
              selectedNewsState={selectedTicker ? newsState[selectedTicker] ?? 'idle' : 'idle'}
              theme={theme}
              earnings={earnings}
              loadingEarnings={loadingEarnings}
              onRefreshEarnings={refreshEarnings}
              onExportTradingView={() => {
                const text = watch.map((item) => item.ticker).filter(Boolean).join(',');
                if (!text) {
                  notify('복사할 관심 종목이 없습니다');
                  return;
                }
                if (!navigator.clipboard) {
                  notify(text);
                  return;
                }
                navigator.clipboard.writeText(text).then(() => notify('TradingView 형식을 복사했습니다')).catch(() => notify(text));
              }}
            />
          )}
          {tab === 'journal' && (
            <JournalView
              journal={journal}
              onAdd={() => { setEditingTrade(null); setShowTradeForm(true); }}
              onEdit={(item) => { setEditingTrade(item); setShowTradeForm(true); }}
              onDelete={(id) => setJournal((prev) => prev.filter((x) => x.id !== id))}
            />
          )}
        </div>
      )}

      {showHoldingForm && <HoldingForm item={editingHolding} onClose={() => setShowHoldingForm(false)} onSave={saveHolding} />}
      {showWatchForm && <WatchForm item={editingWatch} onClose={() => setShowWatchForm(false)} onSave={saveWatch} />}
      {showTradeForm && <TradeForm item={editingTrade} onClose={() => setShowTradeForm(false)} onSave={saveTrade} />}
      {showCashForm && <CashForm cash={cash} onClose={() => setShowCashForm(false)} onSave={saveCash} />}
    </main>
    {pdfPayload && <PortfolioPdfReport payload={pdfPayload} />}
    </>
  );
}
