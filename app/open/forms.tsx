'use client';

import { FormEvent, useState } from 'react';
import type { HoldingItem, JournalItem, WatchItem } from '@/lib/firebase';
import { today } from './model';

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
        <Field label="종목"><input className={inputClass()} value={form.ticker} disabled={!!item} onChange={(e) => setForm({ ...form, ticker: e.target.value })} /></Field>
        <Field label="종목명"><input className={inputClass()} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="수량"><input className={inputClass()} type="number" step="0.0001" value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) })} /></Field>
        <Field label="평단"><input className={inputClass()} type="number" step="0.01" value={form.avgCost || ''} onChange={(e) => setForm({ ...form, avgCost: Number(e.target.value) })} /></Field>
        <Field label="목표가"><input className={inputClass()} type="number" step="0.01" value={form.targetPrice || ''} onChange={(e) => setForm({ ...form, targetPrice: Number(e.target.value) })} /></Field>
        <Field label="손절가"><input className={inputClass()} type="number" step="0.01" value={form.stopLoss || ''} onChange={(e) => setForm({ ...form, stopLoss: Number(e.target.value) })} /></Field>
        <Field label="매수일"><input className={inputClass()} type="date" value={form.buyDate ?? ''} onChange={(e) => setForm({ ...form, buyDate: e.target.value })} /></Field>
        <Field label="메모"><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
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
        <Field label="종목"><input className={inputClass()} value={form.ticker} disabled={!!item} onChange={(e) => setForm({ ...form, ticker: e.target.value })} /></Field>
        <Field label="종목명"><input className={inputClass()} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="목표 진입가"><input className={inputClass()} type="number" step="0.01" value={form.targetBuy || ''} onChange={(e) => setForm({ ...form, targetBuy: Number(e.target.value) })} /></Field>
        <Field label="메모"><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
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
  const [sync, setSync] = useState(!item);
  function submit(e: FormEvent) {
    e.preventDefault();
    onSave(form, sync);
  }
  return (
    <Modal title={item ? '거래 수정' : '거래 추가'} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <Field label="날짜"><input className={inputClass()} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="구분"><select className={inputClass()} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as 'buy' | 'sell' })}><option value="buy">매수</option><option value="sell">매도</option></select></Field>
        <Field label="종목"><input className={inputClass()} value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} /></Field>
        <Field label="수량"><input className={inputClass()} type="number" step="0.0001" value={form.shares || ''} onChange={(e) => setForm({ ...form, shares: Number(e.target.value) })} /></Field>
        <Field label="단가"><input className={inputClass()} type="number" step="0.01" value={form.price || ''} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
        <Field label="수수료"><input className={inputClass()} type="number" step="0.01" value={form.fee || ''} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={sync} disabled={!!item} onChange={(e) => setSync(e.target.checked)} /> 보유 종목과 예수금에 반영</label>
        <Field label="메모"><input className={inputClass()} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-bold text-white sm:col-span-2">저장</button>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs font-semibold text-sub">{label}{children}</label>;
}
