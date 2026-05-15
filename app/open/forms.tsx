'use client';

import { FormEvent, useState } from 'react';
import type { HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';
import { today, usd, type GoalConfig, type HistoryEntry, type InvestStyle, type PaperAccount, type PaperTrade } from './model';

export function HoldingForm({
  item,
  onSave,
  onClose,
}: {
  item: HoldingItem | null;
  onSave: (item: HoldingItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<HoldingItem>(
    item ?? { ticker: '', name: '', shares: 0, avgCost: 0, targetPrice: 0, stopLoss: 0, note: '', buyDate: today() }
  );
  return (
    <Modal title={item ? '보유 종목 수정' : '보유 종목 추가'} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <Field label="티커" required><input className={`${inputClass()} uppercase`} value={form.ticker} disabled={!!item} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} /></Field>
        <Field label="종목명" optional><input className={inputClass()} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="수량" required><input className={inputClass()} type="number" step="0.0001" value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) })} /></Field>
        <Field label="평단" required><input className={inputClass()} type="number" step="0.01" value={form.avgCost || ''} onChange={(e) => setForm({ ...form, avgCost: Number(e.target.value) })} /></Field>
        <Field label="목표가" optional><input className={inputClass()} type="number" step="0.01" value={form.targetPrice || ''} onChange={(e) => setForm({ ...form, targetPrice: Number(e.target.value) })} /></Field>
        <Field label="손절가" optional><input className={inputClass()} type="number" step="0.01" value={form.stopLoss || ''} onChange={(e) => setForm({ ...form, stopLoss: Number(e.target.value) })} /></Field>
        <Field label="매수일" optional><input className={inputClass()} type="date" value={form.buyDate ?? ''} onChange={(e) => setForm({ ...form, buyDate: e.target.value })} /></Field>
        <Field label="메모" optional><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white sm:col-span-2">저장</button>
      </form>
    </Modal>
  );
}

export function WatchForm({
  item,
  onSave,
  onClose,
}: {
  item: WatchItem | null;
  onSave: (item: WatchItem) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<WatchItem>(item ?? { ticker: '', name: '', targetBuy: 0, note: '' });
  return (
    <Modal title={item ? '관심 종목 수정' : '관심 종목 추가'} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <Field label="티커" required><input className={`${inputClass()} uppercase`} value={form.ticker} disabled={!!item} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} /></Field>
        <Field label="종목명" optional><input className={inputClass()} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="목표 진입가" optional><input className={inputClass()} type="number" step="0.01" value={form.targetBuy || ''} onChange={(e) => setForm({ ...form, targetBuy: Number(e.target.value) })} /></Field>
        <Field label="메모" optional><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white sm:col-span-2">저장</button>
      </form>
    </Modal>
  );
}

export function TradeForm({
  item,
  onSave,
  onClose,
}: {
  item: JournalItem | null;
  onSave: (item: JournalItem, syncHolding: boolean) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<JournalItem>(item ?? { id: '', date: today(), action: 'buy', ticker: '', shares: 0, price: 0, fee: 0, note: '' });
  const initialFeePct = item && item.shares && item.price
    ? String(Number((((item.fee ?? 0) / (item.shares * item.price)) * 100).toFixed(4)))
    : '0.25';
  const [feePct, setFeePct] = useState(initialFeePct);
  const [sync, setSync] = useState(!item);
  const isCashFlow = form.action === 'deposit' || form.action === 'withdraw';
  const tradeAmount = (Number(form.shares) || 0) * (Number(form.price) || 0);
  const feeAmount = tradeAmount * ((Number(feePct) || 0) / 100);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (isCashFlow) {
      onSave({ ...form, ticker: 'CASH', shares: 1, fee: 0, strategy: form.action === 'deposit' ? '예수금 입금' : '예수금 출금' }, true);
      return;
    }
    onSave({ ...form, fee: feeAmount }, sync);
  }
  return (
    <Modal title={item ? '거래 수정' : '거래 추가'} onClose={onClose}>
      <form className="grid grid-cols-2 items-start gap-3" onSubmit={submit}>
        <Field label="날짜" required><input className={inputClass()} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="구분" required>
          <select className={inputClass()} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as JournalItem['action'] })}>
            <option value="buy">매수</option>
            <option value="sell">매도</option>
            <option value="deposit">예수금 입금</option>
            <option value="withdraw">예수금 출금</option>
          </select>
        </Field>
        {isCashFlow ? (
          <>
            <Field label="금액" required><input className={inputClass()} type="number" step="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
            <div className="col-span-2 rounded-xl border border-border bg-bg p-3 text-xs leading-5 text-sub">
              저장하면 예수금에 바로 반영됩니다. 입금은 예수금 증가, 출금은 예수금 감소로 기록됩니다.
            </div>
          </>
        ) : (
          <>
            <Field label="티커" required><input className={`${inputClass()} uppercase`} value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} /></Field>
            <Field label="수량" required><input className={inputClass()} type="number" step="0.0001" value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) })} /></Field>
            <Field label="단가" required><input className={inputClass()} type="number" step="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
            <Field label="수수료율 (%)" optional>
              <input className={inputClass()} type="number" step="0.01" min="0" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
              <div className="mt-1 text-xs text-sub">예상 수수료 {usd(feeAmount)}</div>
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={sync} disabled={!!item} onChange={(e) => setSync(e.target.checked)} /> 보유 종목과 예수금에 반영</label>
            <Field label="전략" optional>
              <input list="strategy-list" className={inputClass()} value={form.strategy ?? ''} placeholder="예: 브레이크아웃, 눌림목..." onChange={(e) => setForm({ ...form, strategy: e.target.value })} />
              <datalist id="strategy-list">
                {['브레이크아웃', '눌림목', '반등매수', '추세추종', '역추세', '실적플레이'].map(s => <option key={s} value={s} />)}
              </datalist>
            </Field>
          </>
        )}
        <Field label="메모" optional><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="sticky bottom-0 z-10 col-span-2 -mx-1 rounded-lg bg-brand px-4 py-3 font-bold text-white shadow-lg sm:static sm:mx-0 sm:py-2 sm:shadow-none">저장</button>
      </form>
    </Modal>
  );
}

export function PaperAccountForm({
  item,
  onSave,
  onClose,
}: {
  item: PaperAccount | null;
  onSave: (item: PaperAccount) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PaperAccount>(
    item ?? { id: '', name: '', owner: '', initialCash: 100000, createdAt: today(), note: '' }
  );
  return (
    <Modal title={item ? '모의 계좌 수정' : '모의 계좌 추가'} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <Field label="계좌명" required><input className={inputClass()} value={form.name} placeholder="GPT 계좌" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="소유자" optional><input className={inputClass()} value={form.owner ?? ''} placeholder="나, GPT, 친구" onChange={(e) => setForm({ ...form, owner: e.target.value })} /></Field>
        <Field label="시작 현금" required><input className={inputClass()} type="number" step="0.01" value={form.initialCash || ''} onChange={(e) => setForm({ ...form, initialCash: Number(e.target.value) })} /></Field>
        <Field label="시작일" required><input className={inputClass()} type="date" value={form.createdAt} onChange={(e) => setForm({ ...form, createdAt: e.target.value })} /></Field>
        <Field label="메모" optional><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white sm:col-span-2">저장</button>
      </form>
    </Modal>
  );
}

export function PaperTradeForm({
  item,
  accountId,
  accounts,
  onSave,
  onClose,
}: {
  item: PaperTrade | null;
  accountId: string;
  accounts: PaperAccount[];
  onSave: (item: PaperTrade) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PaperTrade>(
    item ?? { id: '', accountId, date: today(), action: 'buy', ticker: '', shares: 0, price: 0, fee: 0, strategy: '', thesis: '', risk: '', scenario: '', review: '', note: '' }
  );
  const initialFeePct = item && item.shares && item.price
    ? String(Number((((item.fee ?? 0) / (item.shares * item.price)) * 100).toFixed(4)))
    : '0.25';
  const [feePct, setFeePct] = useState(initialFeePct);
  const tradeAmount = (Number(form.shares) || 0) * (Number(form.price) || 0);
  const feeAmount = tradeAmount * ((Number(feePct) || 0) / 100);
  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({ ...form, fee: feeAmount });
  }
  return (
    <Modal title={item ? '모의 거래 수정' : '모의 거래 추가'} onClose={onClose}>
      <form className="grid grid-cols-2 items-start gap-3" onSubmit={submit}>
        <Field label="계좌" required>
          <select className={inputClass()} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </Field>
        <Field label="날짜" required><input className={inputClass()} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="구분" required><select className={inputClass()} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as 'buy' | 'sell' })}><option value="buy">매수</option><option value="sell">매도</option></select></Field>
        <Field label="티커" required><input className={`${inputClass()} uppercase`} value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} /></Field>
        <Field label="수량" required><input className={inputClass()} type="number" step="0.0001" value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) })} /></Field>
        <Field label="단가" required><input className={inputClass()} type="number" step="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
        <Field label="수수료율 (%)" optional>
          <input className={inputClass()} type="number" step="0.01" min="0" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
          <div className="mt-1 text-xs text-sub">예상 수수료 {usd(feeAmount)}</div>
        </Field>
        <Field label="전략" optional><input className={inputClass()} value={form.strategy ?? ''} placeholder="눌림목, 돌파, 실적..." onChange={(e) => setForm({ ...form, strategy: e.target.value })} /></Field>
        <Field label="판단 근거" optional><input className={inputClass()} value={form.thesis ?? ''} placeholder="GPT 추천 이유 또는 내 판단" onChange={(e) => setForm({ ...form, thesis: e.target.value })} /></Field>
        <Field label="리스크" optional><input className={inputClass()} value={form.risk ?? ''} placeholder="손절 조건, 반대 시나리오" onChange={(e) => setForm({ ...form, risk: e.target.value })} /></Field>
        <Field label="예상 시나리오" optional><input className={inputClass()} value={form.scenario ?? ''} onChange={(e) => setForm({ ...form, scenario: e.target.value })} /></Field>
        <Field label="복기" optional><input className={inputClass()} value={form.review ?? ''} onChange={(e) => setForm({ ...form, review: e.target.value })} /></Field>
        <Field label="메모" optional><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="sticky bottom-0 z-10 col-span-2 -mx-1 rounded-lg bg-brand px-4 py-3 font-bold text-white shadow-lg sm:static sm:mx-0 sm:py-2 sm:shadow-none">저장</button>
      </form>
    </Modal>
  );
}

export function PositionSizingForm({ totalAsset, onClose }: { totalAsset: number; onClose: () => void }) {
  const [showGuide, setShowGuide] = useState(false);
  const [accountSize, setAccountSize] = useState(totalAsset > 0 ? totalAsset.toFixed(2) : '');
  const [riskPct, setRiskPct] = useState('1');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');

  const account = Number(accountSize) || 0;
  const risk = Number(riskPct) || 0;
  const p = Number(price) || 0;
  const sl = Number(stopLoss) || 0;
  const riskAmount = account * (risk / 100);
  const priceDiff = p - sl;
  const shares = priceDiff > 0 ? Math.floor(riskAmount / priceDiff) : 0;
  const positionValue = shares * p;
  const positionPct = account > 0 ? (positionValue / account) * 100 : 0;

  return (
    <Modal title="포지션 사이징 계산기" onClose={onClose}>
      {/* 사용 방법 토글 */}
      <div className="mb-3">
        <button type="button" onClick={() => setShowGuide((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
          <span>{showGuide ? '▾' : '▸'}</span> 사용 방법
        </button>
        {showGuide && (
          <div className="mt-2 rounded-xl border border-border bg-bg p-3 text-xs leading-5 text-sub">
            <div className="mb-2 font-semibold text-text">📐 포지션 사이징이란?</div>
            <div>한 번의 거래에서 감당할 손실을 계좌의 일정 비율로 제한하여 <b className="text-text">적정 매수 수량</b>을 계산하는 방법입니다.</div>
            <div className="mt-3 space-y-1.5">
              <div><b className="text-brand">① 총 자산</b> — 포트폴리오 전체 금액 (자동 입력)</div>
              <div><b className="text-brand">② 리스크 비율</b> — 이 거래에서 잃어도 되는 최대 비율<br /><span className="text-slate-400">예: 1% → 총 자산의 1%까지 손실 허용</span></div>
              <div><b className="text-brand">③ 매수 가격 / 손절 가격</b> — 진입가와 손절가 입력</div>
            </div>
            <div className="mt-3 rounded-lg bg-card px-3 py-2 font-semibold text-text">
              수량 = 리스크 금액 ÷ (매수가 − 손절가)
            </div>
            <div className="mt-2 text-slate-400">예: 총 자산 $30,000 · 리스크 1% · 매수 $200 · 손절 $190<br />→ 리스크 금액 $300 ÷ $10 = <b className="text-brand">30주</b></div>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="총 자산 ($)"><input className={inputClass()} type="number" step="0.01" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} /></Field>
        <Field label="리스크 비율 (%)"><input className={inputClass()} type="number" step="0.1" min="0.1" max="100" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} /></Field>
        <Field label="매수 가격 ($)"><input className={inputClass()} type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="손절 가격 ($)"><input className={inputClass()} type="number" step="0.01" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} /></Field>
      </div>
      <div className={`mt-4 rounded-xl border border-border bg-bg p-4 ${shares > 0 ? '' : 'opacity-40'}`}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-xs font-semibold text-sub">리스크 금액</div><div className="mt-1 font-bold text-rose-600">${riskAmount.toFixed(0)}</div></div>
          <div><div className="text-xs font-semibold text-sub">매수 수량</div><div className="mt-1 text-xl font-extrabold text-brand">{shares > 0 ? `${shares}주` : '-'}</div></div>
          <div><div className="text-xs font-semibold text-sub">포지션 금액</div><div className="mt-1 font-bold">{shares > 0 ? `$${positionValue.toFixed(0)}` : '-'}</div></div>
          <div><div className="text-xs font-semibold text-sub">포지션 비중</div><div className="mt-1 font-bold">{shares > 0 ? `${positionPct.toFixed(1)}%` : '-'}</div></div>
        </div>
      </div>
      <button onClick={onClose} className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-bold">닫기</button>
    </Modal>
  );
}

export function RecordDateForm({ onSave, onClose }: { onSave: (date: string) => void; onClose: () => void }) {
  const [date, setDate] = useState(today());
  return (
    <Modal title="자산 기록 날짜 선택" onClose={onClose}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave(date); }}>
        <Field label="기록 날짜" required>
          <input className={inputClass()} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white">기록 저장</button>
      </form>
    </Modal>
  );
}

export function HistoryForm({ entry, onSave, onClose }: { entry: HistoryEntry; onSave: (entry: HistoryEntry) => void; onClose: () => void }) {
  const [form, setForm] = useState<HistoryEntry>(entry);
  return (
    <Modal title="자산 기록 수정" onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <Field label="날짜" required><input className={inputClass()} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="총 자산" required><input className={inputClass()} type="number" step="0.01" value={form.totalValue || ''} onChange={(e) => setForm({ ...form, totalValue: Number(e.target.value) })} /></Field>
        <Field label="주식 평가금액" required><input className={inputClass()} type="number" step="0.01" value={form.stockValue || ''} onChange={(e) => setForm({ ...form, stockValue: Number(e.target.value) })} /></Field>
        <Field label="예수금" required><input className={inputClass()} type="number" step="0.01" value={form.cashValue || ''} onChange={(e) => setForm({ ...form, cashValue: Number(e.target.value) })} /></Field>
        <Field label="매수 금액" required><input className={inputClass()} type="number" step="0.01" value={form.totalCost || ''} onChange={(e) => setForm({ ...form, totalCost: Number(e.target.value) })} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white sm:col-span-2">저장</button>
      </form>
    </Modal>
  );
}

export function CashForm({
  cash,
  onSave,
  onClose,
}: {
  cash: number;
  onSave: (cash: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(String(cash || ''));
  return (
    <Modal title="예수금 수정" onClose={onClose}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave(Number(value) || 0); }}>
        <Field label="예수금" required><input className={inputClass()} type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white">저장</button>
      </form>
    </Modal>
  );
}

export function GoalForm({
  initial,
  currentAsset,
  krw,
  rate,
  onClose,
  onSave,
}: {
  initial: GoalConfig | null;
  currentAsset: number;
  krw: boolean;
  rate: number;
  onClose: () => void;
  onSave: (config: GoalConfig) => void;
}) {
  const [step, setStep] = useState(0);
  const [targetAmountStr, setTargetAmountStr] = useState(String(initial?.targetAmount || ''));
  const [targetDate, setTargetDate] = useState(initial?.targetDate || '');
  const [purpose, setPurpose] = useState(initial?.purpose || '종잣돈');
  const [customPurpose, setCustomPurpose] = useState('');
  const [monthlyContribStr, setMonthlyContribStr] = useState(String(initial?.monthlyContrib || ''));
  const [style, setStyle] = useState<InvestStyle>(initial?.style || '중립형');
  const [customRateStr, setCustomRateStr] = useState(String(initial?.customRate || '10'));

  const purposes = ['집 구매', '유학', '은퇴', '종잣돈', '기타'];
  const styles: InvestStyle[] = ['공격형', '중립형', '보수형', '자유형'];
  const styleInfo: Record<InvestStyle, { rate: string; desc: string }> = {
    '공격형': { rate: '연 18% 기준', desc: '높은 수익을 추구하며 변동성을 감수합니다.' },
    '중립형': { rate: '연 12% 기준', desc: '수익과 안정을 균형있게 추구합니다.' },
    '보수형': { rate: '연 7% 기준', desc: '안정성을 우선시하며 보수적으로 운용합니다.' },
    '자유형': { rate: '직접 설정', desc: '연수익률을 직접 입력해 예측합니다.' },
  };

  function handleSave() {
    const targetAmount = parseFloat(targetAmountStr) || 0;
    if (!targetAmount || !targetDate) return;
    onSave({
      targetAmount,
      targetDate,
      purpose: purpose === '기타' ? (customPurpose || '기타') : purpose,
      monthlyContrib: parseFloat(monthlyContribStr) || 0,
      style,
      customRate: style === '자유형' ? (parseFloat(customRateStr) || 10) : undefined,
    });
  }

  return (
    <Modal title={`투자 목표 설정 (${step + 1}/3)`} onClose={onClose}>
      {/* Progress bar */}
      <div className="mb-5 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-brand' : 'bg-border'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-3">
          <p className="text-xs font-semibold text-sub">① 나의 목표</p>
          <Field label="목표 금액 ($)" required>
            <input className={inputClass()} type="number" step="1000" placeholder="예: 100000"
              value={targetAmountStr} onChange={(e) => setTargetAmountStr(e.target.value)} autoFocus />
          </Field>
          <Field label="목표 달성 기한" required>
            <input className={inputClass()} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="목표 용도" required>
            <div className="mt-1 flex flex-wrap gap-2">
              {purposes.map((p) => (
                <button key={p} type="button" onClick={() => setPurpose(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${purpose === p ? 'border-brand bg-brand/10 text-brand' : 'border-border text-sub hover:border-brand/40'}`}>
                  {p}
                </button>
              ))}
            </div>
            {purpose === '기타' && (
              <input className={`${inputClass()} mt-2`} placeholder="목표 용도를 입력하세요"
                value={customPurpose} onChange={(e) => setCustomPurpose(e.target.value)} />
            )}
          </Field>
          <button type="button" disabled={!targetAmountStr || !targetDate}
            onClick={() => setStep(1)}
            className="mt-1 rounded-lg bg-brand px-4 py-2 font-bold text-white disabled:opacity-40">
            다음 단계 →
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3">
          <p className="text-xs font-semibold text-sub">② 현재 상황</p>
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-xs text-sub">현재 투자 자산 (자동 연동)</div>
            <div className="mt-1 text-xl font-extrabold text-brand">
              ${currentAsset.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            {krw && rate > 0 && (
              <div className="text-xs text-sub">≈ ₩{Math.round(currentAsset * rate).toLocaleString('ko-KR')}</div>
            )}
          </div>
          <Field label="월 적립액 ($)" optional>
            <input className={inputClass()} type="number" step="100" placeholder="예: 500 (없으면 0)"
              value={monthlyContribStr} onChange={(e) => setMonthlyContribStr(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(0)}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-bold text-sub">← 이전</button>
            <button type="button" onClick={() => setStep(2)}
              className="flex-1 rounded-lg bg-brand py-2 text-sm font-bold text-white">다음 단계 →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          <p className="text-xs font-semibold text-sub">③ 투자 스타일</p>
          <div className="grid grid-cols-2 gap-2">
            {styles.map((s) => (
              <button key={s} type="button" onClick={() => setStyle(s)}
                className={`rounded-xl border p-3 text-left transition-all ${style === s ? 'border-brand bg-brand/10' : 'border-border hover:border-brand/40'}`}>
                <div className={`text-sm font-bold ${style === s ? 'text-brand' : 'text-text'}`}>{s}</div>
                <div className="mt-0.5 text-[11px] text-sub">{styleInfo[s].rate}</div>
              </button>
            ))}
          </div>
          {style === '자유형' && (
            <Field label="중립 연수익률 (%)" required>
              <input className={inputClass()} type="number" step="1" min="1" max="200"
                value={customRateStr} onChange={(e) => setCustomRateStr(e.target.value)} />
            </Field>
          )}
          <p className="rounded-lg bg-bg px-3 py-2 text-xs text-sub">{styleInfo[style].desc}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-bold text-sub">← 이전</button>
            <button type="button" onClick={handleSave}
              className="flex-1 rounded-lg bg-brand py-2 text-sm font-bold text-white">목표 저장 ✓</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-md border border-border px-2 py-1 text-sm text-sub">닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function inputClass() {
  return 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand';
}

function Field({ label, children, required, optional }: { label: string; children: React.ReactNode; required?: boolean; optional?: boolean }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-sub">
      <span className="flex items-center gap-1">
        {label}
        {required && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600">필수</span>}
        {optional && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">선택</span>}
      </span>
      {children}
    </label>
  );
}
