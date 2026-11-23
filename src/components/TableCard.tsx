import React from 'react';
import {
  ArrowRight,
  CupSoda,
  LogIn,
  LogOut,
  Play,
  ReceiptText,
  StickyNote,
  UserRound,
} from 'lucide-react';
import type { Table } from '../types';
import { calculateActiveSession, cn, effectiveBilliardAmount, formatClock, formatMoney, sumItems } from '../lib/format';
import { tableColorStyle } from '../lib/tableColors';

interface TableCardProps {
  table: Table;
  nowMs: number;
  currency: string;
  minimumCharge: number;
  busy?: boolean;
  onSelect: (table: Table) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  nowMs,
  currency,
  minimumCharge,
  busy = false,
  onSelect,
}) => {
  const session = table.activeSession;
  const calculation = session
    ? calculateActiveSession(session, minimumCharge, nowMs)
    : null;
  const itemsAmount = session ? sumItems(session.items) : 0;
  const billiardAmount = effectiveBilliardAmount(calculation?.cost ?? 0, session?.playerType);
  const total = billiardAmount + itemsAmount;
  const occupied = Boolean(session);
  const frozenMs = session?.checkoutStartedAt
    ? new Date(session.checkoutStartedAt).getTime()
    : Number.NaN;
  const displayNow = Number.isFinite(frozenMs) ? frozenMs : nowMs;
  const checkoutFrozen = Boolean(session?.checkoutStartedAt);

  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      disabled={busy}
      style={tableColorStyle(table.color)}
      className={cn(
        'group relative flex min-h-[144px] flex-col overflow-hidden rounded-2xl border p-3.5 pl-4 text-left transition',
        'table-border',
        occupied
          ? 'table-tint hover:shadow-[0_16px_40px_-28px_rgba(16,185,129,0.7)]'
          : 'bg-[#0b1422] hover:bg-[#0d1826]',
        busy && 'opacity-60'
      )}
    >
      <span className="table-accent absolute inset-x-0 top-0 h-1" />
      <span className="table-accent absolute inset-y-0 left-0 w-1 opacity-80" />

      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="table-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black">
            {table.number}
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Mesa {table.number}
            </p>
            <h3 className="truncate text-sm font-black text-white">{table.name}</h3>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
            occupied
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          )}
        >
          {occupied ? 'Ocupada' : 'Libre'}
        </span>
      </div>

      {occupied && calculation && session ? (
        <>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="num text-2xl font-black leading-none tracking-tight text-white">
                {calculation.timer}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-slate-500">
                <span className="flex items-center gap-1">
                  <UserRound className="h-3 w-3" />
                  Abrió {session.openedByName}
                </span>
                {session.playerType === 'staff' ? (
                  <span className="rounded border border-violet-500/25 bg-violet-500/10 px-1 py-px font-bold text-violet-300">
                    Encargados
                  </span>
                ) : null}
                {session.playerType === 'mixed' ? (
                  <span className="rounded border border-violet-500/25 bg-violet-500/10 px-1 py-px font-bold text-violet-300">
                    50% mesa
                  </span>
                ) : null}
                {checkoutFrozen ? (
                  <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1 py-px font-bold text-amber-300">
                    Tiempo detenido
                  </span>
                ) : null}
              </p>
            </div>
            <span className="num rounded-md border border-slate-800 bg-[#08111d]/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
              {formatMoney(session.ratePerHour, currency)}/h
            </span>
          </div>

          <div className="mt-2.5 grid w-full grid-cols-3 gap-2 rounded-lg border border-slate-800/80 bg-[#08111d]/70 px-2.5 py-2">
            <div>
              <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-500">
                <LogIn className="h-2.5 w-2.5 text-emerald-500/80" />
                Entrada
              </p>
              <p className="num mt-0.5 text-[11px] font-bold text-slate-200">
                {formatClock(session.startTime)}
              </p>
            </div>
            <div
              className="border-l border-slate-800/80 pl-2"
              title="Hora de salida y total al corte si cobras la mesa en este momento"
            >
              <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.13em] text-slate-500">
                <LogOut className="h-2.5 w-2.5 text-sky-400/80" />
                Salida
              </p>
              <p className="num mt-0.5 text-[11px] font-bold text-sky-200">
                {formatClock(new Date(displayNow))}
              </p>
            </div>
            <div
              className="border-l border-slate-800/80 pl-2"
              title="Acumulado hasta el momento; se confirma al cobrar"
            >
              <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-500">
                Total
              </p>
              <p className="num mt-0.5 truncate text-[12px] font-black text-emerald-300">
                {formatMoney(total, currency)}
              </p>
            </div>
          </div>

          <div className="mt-2 flex w-full items-center justify-between gap-2 text-[9px] text-slate-500">
            <span className="flex min-w-0 items-center gap-1.5">
              <CupSoda className="h-3 w-3 shrink-0 text-sky-400/80" />
              <span className="truncate">
                Billar{' '}
                <strong className="num font-semibold text-slate-300">
                  {formatMoney(billiardAmount, currency)}
                </strong>
                <span className="px-1 text-slate-700">·</span>
                Consumo{' '}
                <strong className="num font-semibold text-slate-300">
                  {formatMoney(itemsAmount, currency)}
                </strong>
              </span>
            </span>
            <span className="flex shrink-0 items-center font-bold text-emerald-400 transition group-hover:text-emerald-300">
              Abrir pedido
              <ArrowRight className="ml-0.5 h-3 w-3 transition group-hover:translate-x-0.5" />
            </span>
          </div>

          {session.notes?.trim() ? (
            <div className="mt-2 flex w-full items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5 text-left text-[9px] leading-relaxed text-amber-200/90">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
              <span className="line-clamp-2">{session.notes}</span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Lista para iniciar. Tarifa{' '}
            <span className="num text-slate-300">{formatMoney(table.ratePerHour, currency)}/h</span>
          </p>
          <div className="flex w-full items-center justify-between border-t border-slate-800/80 pt-2.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <Play className="h-3.5 w-3.5" />
              {busy ? 'Iniciando…' : 'Iniciar mesa'}
            </span>
            <ReceiptText className="h-4 w-4 text-slate-600 transition group-hover:text-slate-400" />
          </div>
        </div>
      )}
    </button>
  );
};
