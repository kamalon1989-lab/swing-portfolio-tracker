'use client';

import { useEffect, useState } from 'react';
import { CashForm, GoalForm, HistoryForm, HoldingForm, PaperAccountForm, PaperTradeForm, PositionSizingForm, RecordDateForm, TradeForm, WatchForm } from './forms';
import { AssetsView, MobileTabs, PortfolioPdfReport, ShareView } from './panels';
import { JournalView, PaperTradingView, PortfolioView, WatchView } from './views';
import { usePortfolioApp } from './usePortfolioApp';

function MarketSessionBadge() {
  const [session, setSession] = useState<{ label: string; color: string } | null>(null);
  useEffect(() => {
    function calc() {
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const day = et.getDay(); // 0=일, 6=토
      const t = et.getHours() * 60 + et.getMinutes();
      if (day === 0 || day === 6) return { label: '휴장', color: 'bg-slate-500/10 text-slate-500' };
      if (t >= 240  && t < 570)  return { label: '프리장', color: 'bg-amber-500/15 text-amber-500' };
      if (t >= 570  && t < 960)  return { label: '장중',   color: 'bg-emerald-500/15 text-emerald-500' };
      if (t >= 960  && t < 1200) return { label: '애프터', color: 'bg-sky-500/15 text-sky-500' };
      return { label: '휴장', color: 'bg-slate-500/10 text-slate-500' };
    }
    setSession(calc());
    const id = window.setInterval(() => setSession(calc()), 60000);
    return () => window.clearInterval(id);
  }, []);
  if (!session) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${session.color}`}>{session.label}</span>;
}

function MoreMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-sub hover:text-text">⋯</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-border bg-card shadow-lg">
            {items.map(({ label, onClick }) => (
              <button key={label} onClick={() => { onClick(); setOpen(false); }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-bg first:rounded-t-xl last:rounded-b-xl">
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function OpenPage() {
  const app = usePortfolioApp();
  const [showSizingForm, setShowSizingForm] = useState(false);
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
    saveTickerMemo,
    benchData,
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
    saveHistory,
    deleteHistory,
    exportBackup,
    makeShareUrl,
    exportPdfReport,
    signInWithGoogle,
    signOutCurrent,
    goalConfig,
    showGoalForm,
    setShowGoalForm,
    saveGoal,
    paperAccounts,
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
    importPaperTradingJson,
    cloneCurrentPortfolioToPaper,
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
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <a href="/" className="shrink-0 text-sm font-bold sm:text-base">스윙 포트폴리오</a>
          {signedIn && (
            <nav className="hidden gap-1 rounded-lg bg-bg p-1 sm:flex">
              {([
                ['portfolio', '포트폴리오'],
                ['assets', '자산 분석'],
                ['watchlist', '관심 종목'],
                ['journal', '매매 일지'],
                ['paper', '모의투자'],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === key ? 'bg-card text-brand shadow-sm' : 'text-sub hover:text-text'}`}>
                  {label}
                </button>
              ))}
            </nav>
          )}
          {signedIn && tab === 'portfolio' && (
            <div className="no-print hidden items-center gap-1 sm:flex">
              <div className="mx-1 h-4 w-px bg-border" />
              <button onClick={() => { setEditingHolding(null); setShowHoldingForm(true); }} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">종목 추가</button>
              <MoreMenu items={[
                { label: '포지션 계산', onClick: () => setShowSizingForm(true) },
                { label: '공유 링크', onClick: makeShareUrl },
                { label: 'PDF 내보내기', onClick: exportPdfReport },
                { label: 'AI JSON 저장', onClick: exportBackup },
              ]} />
            </div>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <span className="hidden text-xs text-sub lg:inline" title={status}>●</span>
            {signedIn && (
              <>
                <span className="hidden sm:inline-flex"><MarketSessionBadge /></span>
                <button onClick={() => setKrw((v) => !v)} className={`rounded-md border px-2 py-1.5 text-xs font-semibold sm:px-3 sm:text-sm ${krw ? 'border-brand bg-brand/10 text-brand' : 'border-border text-sub'}`}>원화</button>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold text-sub sm:px-3 sm:text-sm">
                  {theme === 'dark' ? '라이트' : '다크'}
                </button>
                <button
                  onClick={() => setUseExtendedHours((v) => !v)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-semibold sm:px-3 sm:text-sm ${useExtendedHours ? 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-300' : 'border-border text-sub'}`}
                  title="프리장/애프터장 가격 반영"
                >
                  <span className="sm:hidden">확장</span><span className="hidden sm:inline">확장장</span>
                </button>
                <button onClick={refreshPrices} className="rounded-md bg-brand px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-60 sm:px-3 sm:text-sm" disabled={loadingPrices}>
                  {loadingPrices ? '조회' : <><span className="sm:hidden">갱신</span><span className="hidden sm:inline">시세 갱신</span></>}
                </button>
              </>
            )}
            {user ? (
              <button onClick={signOutCurrent} className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold text-sub sm:px-3 sm:text-sm">로그아웃</button>
            ) : !demo ? null : (
              <a href="/open" className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold text-sub sm:px-3 sm:text-sm">로그인</a>
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
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:pb-5">
          <MobileTabs tab={tab} setTab={setTab} />
          {tab === 'portfolio' && (
            <PortfolioView
              rows={rows}
              summary={summary}
              cash={cash}
              krw={krw}
              rate={rate}
              onEditCash={() => setShowCashForm(true)}
              onEdit={(item) => { setEditingHolding(item); setShowHoldingForm(true); }}
              onDelete={(ticker) => setHoldings((prev) => prev.filter((x) => x.ticker !== ticker))}
              onRecord={() => setShowRecordForm(true)}
              selectedTicker={selectedTicker}
              onSelectTicker={openTickerDetail}
              theme={theme}
              earnings={earnings}
              loadingEarnings={loadingEarnings}
              onRefreshEarnings={refreshEarnings}
              tickerMemos={tickerMemos}
              onSaveMemo={saveTickerMemo}
            />
          )}
          {tab === 'assets' && (
            <AssetsView
              history={history}
              rows={rows}
              summary={summary}
              cash={cash}
              krw={krw}
              rate={rate}
              onEditHistory={(entry) => { setEditingHistory(entry); setShowHistoryForm(true); }}
              onDeleteHistory={deleteHistory}
              benchData={benchData}
              goalConfig={goalConfig}
              onEditGoal={() => setShowGoalForm(true)}
            />
          )}
          {tab === 'watchlist' && (
            <WatchView
              watch={watch}
              prices={prices}
              onAdd={() => { setEditingWatch(null); setShowWatchForm(true); }}
              onEdit={(item) => { setEditingWatch(item); setShowWatchForm(true); }}
              onDelete={(ticker) => setWatch((prev) => prev.filter((x) => x.ticker !== ticker))}
              onSelectTicker={openTickerDetail}
              selectedTicker={selectedTicker}
              theme={theme}
              earnings={earnings}
              loadingEarnings={loadingEarnings}
              onRefreshEarnings={refreshEarnings}
              tickerMemos={tickerMemos}
              onSaveMemo={saveTickerMemo}
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
          {tab === 'paper' && (
            <PaperTradingView
              accounts={paperAccounts}
              snapshots={paperSnapshots}
              selectedAccountId={selectedPaperAccountId}
              onSelectAccount={setSelectedPaperAccountId}
              onAddAccount={() => { setEditingPaperAccount(null); setShowPaperAccountForm(true); }}
              onEditAccount={(item) => { setEditingPaperAccount(item); setShowPaperAccountForm(true); }}
              onDeleteAccount={deletePaperAccount}
              onAddTrade={() => { setEditingPaperTrade(null); setShowPaperTradeForm(true); }}
              onEditTrade={(item) => { setEditingPaperTrade(item); setShowPaperTradeForm(true); }}
              onDeleteTrade={deletePaperTrade}
              onExport={exportPaperTrading}
              onImport={importPaperTrading}
              onImportText={importPaperTradingJson}
              onClonePortfolio={cloneCurrentPortfolioToPaper}
            />
          )}
        </div>
      )}

      {showSizingForm && <PositionSizingForm totalAsset={summary.totalAsset} onClose={() => setShowSizingForm(false)} />}
      {showHoldingForm && <HoldingForm item={editingHolding} onClose={() => setShowHoldingForm(false)} onSave={saveHolding} />}
      {showWatchForm && <WatchForm item={editingWatch} onClose={() => setShowWatchForm(false)} onSave={saveWatch} />}
      {showTradeForm && <TradeForm item={editingTrade} onClose={() => setShowTradeForm(false)} onSave={saveTrade} />}
      {showPaperAccountForm && <PaperAccountForm item={editingPaperAccount} onClose={() => setShowPaperAccountForm(false)} onSave={savePaperAccount} />}
      {showPaperTradeForm && <PaperTradeForm item={editingPaperTrade} accountId={selectedPaperAccountId || paperAccounts[0]?.id || ''} accounts={paperAccounts} onClose={() => setShowPaperTradeForm(false)} onSave={savePaperTrade} />}
      {showCashForm && <CashForm cash={cash} onClose={() => setShowCashForm(false)} onSave={saveCash} />}
      {showRecordForm && <RecordDateForm onClose={() => setShowRecordForm(false)} onSave={recordToday} />}
      {showHistoryForm && editingHistory && <HistoryForm entry={editingHistory} onClose={() => { setShowHistoryForm(false); setEditingHistory(null); }} onSave={saveHistory} />}
      {showGoalForm && <GoalForm initial={goalConfig} currentAsset={summary.totalAsset} krw={krw} rate={rate} onClose={() => setShowGoalForm(false)} onSave={saveGoal} />}
    </main>
    {pdfPayload && <PortfolioPdfReport payload={pdfPayload} />}
    </>
  );
}
