import React from 'react';
import { ArrowRight, Clock3, CupSoda, Play, ReceiptText, Users } from 'lucide-react';
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
  const itemsCount = session
    ? session.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    : 0;
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
                <Clock3 className="h-3 w-3" />
                Entrada {formatClock(session.startTime)} · {session.openedByName}
              </p>
            </div>
            <div className="text-right">
              <p className="num text-sm font-bold text-emerald-300">
                {formatMoney(calculation.cost, currency)}
              </p>
              <p className="text-[9px] text-slate-500">billar aprox.</p>
            </div>
          </div>

          <div className="mt-2.5 flex w-full items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[10px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <CupSoda className="h-3.5 w-3.5 text-sky-400/80" />
              Consumo{' '}
              <strong className="num text-slate-200">{formatMoney(itemsAmount, currency)}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <Users className="h-3.5 w-3.5" />
              {itemsCount} ítem{itemsCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-2 flex w-full items-center justify-end text-[10px] font-bold text-emerald-400 transition group-hover:text-emerald-300">
            Abrir pedido
            <ArrowRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
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
