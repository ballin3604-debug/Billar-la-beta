import React from 'react';
import {
  ArrowRight,
  CupSoda,
  LogIn,
  LogOut,
  Play,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import type { Table } from '../types';
import { calculateSession, cn, formatClock, formatMoney, sumItems } from '../lib/format';

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
    ? calculateSession(session.startTime, session.ratePerHour, minimumCharge, nowMs)
    : null;
  const itemsAmount = session ? sumItems(session.items) : 0;
  const total = (calculation?.cost ?? 0) + itemsAmount;
  const occupied = Boolean(session);

  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      disabled={busy}
      className={cn(
        'group relative flex min-h-[144px] flex-col overflow-hidden rounded-2xl border p-3.5 text-left transition',
        occupied
          ? 'border-slate-700/80 bg-gradient-to-br from-[#101d2b] to-[#0b1422] hover:border-emerald-500/50 hover:shadow-[0_16px_40px_-28px_rgba(16,185,129,0.7)]'
          : 'border-slate-800 bg-[#0b1422] hover:border-emerald-500/40 hover:bg-[#0d1826]',
        busy && 'opacity-60'
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-0.5',
          occupied ? 'bg-gradient-to-r from-rose-400 via-rose-500/60 to-transparent' : 'bg-gradient-to-r from-emerald-400 via-emerald-500/50 to-transparent'
        )}
      />

      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Mesa {table.number}
          </p>
          <h3 className="truncate text-sm font-black text-white">{table.name}</h3>
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
              <p className="mt-1 flex items-center gap-1 text-[9px] text-slate-500">
                <UserRound className="h-3 w-3" />
                Abrió {session.openedByName}
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
                {formatClock(new Date(nowMs))}
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
                  {formatMoney(calculation.cost, currency)}
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
