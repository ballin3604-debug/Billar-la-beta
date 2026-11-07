import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  TableProperties,
} from 'lucide-react';
import type { ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import { formatClock, formatDateTime, plural } from '../lib/format';
import { CloseShiftModal } from './CloseShiftModal';

interface CashierCloseViewProps {
  onShiftClosed: (shift: ShiftDetail) => void;
}

export const CashierCloseView: React.FC<CashierCloseViewProps> = ({ onShiftClosed }) => {
  const { currentShift, tables, attendanceToday, setTab } = useApp();
  const [closeOpen, setCloseOpen] = useState(false);

  if (!currentShift) return null;

  const openTables = tables.filter((table) => table.status === 'occupied');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            Cierre de caja
          </h1>
          <span className="rounded-md border border-slate-800 bg-[#0b1422] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Turno #{currentShift.id}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Cuenta el efectivo de la gaveta y registra tu salida. El sistema no muestra el efectivo
          esperado.
        </p>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Arqueo ciego</h2>
              <p className="text-[10px] text-slate-500">
                Al confirmar, el turno queda bloqueado y se registra tu hora de salida.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="kpi">
              <p className="label mb-1">Apertura</p>
              <p className="num text-sm font-bold text-white">
                {formatDateTime(currentShift.openedAt)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">{currentShift.openedByName}</p>
            </div>
            <div className="kpi">
              <p className="label mb-1">Tu entrada</p>
              <p className="num text-sm font-bold text-sky-300">
                {attendanceToday ? formatClock(attendanceToday.checkInAt) : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">Salida al confirmar el arqueo</p>
            </div>
          </div>

          <div
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[11px] leading-relaxed ${
              openTables.length > 0
                ? 'border-rose-500/30 bg-rose-500/[0.07] text-rose-200'
                : 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200/90'
            }`}
          >
            {openTables.length > 0 ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <TableProperties className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {openTables.length > 0
                  ? `${plural(openTables.length, 'mesa abierta', 'mesas abiertas')}`
                  : 'No hay mesas abiertas'}
              </p>
              <p className="mt-0.5">
                {openTables.length > 0
                  ? `${openTables.map((table) => table.name).join(', ')}. Cóbralas antes de cerrar.`
                  : 'Puedes cerrar la caja cuando termines de contar el efectivo.'}
              </p>
              {openTables.length > 0 ? (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 hover:text-rose-200"
                  onClick={() => setTab('mesas')}
                >
                  Ir al panel de mesas
                  <TableProperties className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-sky-200/90">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Arqueo ciego:</strong> no verás ventas, efectivo esperado ni diferencias.
              Cuenta toda la gaveta con calma e ingresa el total.
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#08111d] px-3.5 py-2.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Turno abierto desde {formatClock(currentShift.openedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <LogIn className="h-3.5 w-3.5 text-sky-500/70" />
              {attendanceToday ? `Entrada ${formatClock(attendanceToday.checkInAt)}` : 'Entrada sin registro'}
            </span>
          </div>

          <button
            type="button"
            className="btn-amber w-full"
            onClick={() => setCloseOpen(true)}
            disabled={openTables.length > 0}
          >
            <LockKeyhole className="h-4 w-4" />
            Cerrar caja y registrar salida
          </button>
          {openTables.length > 0 ? (
            <p className="text-center text-[10px] text-rose-300/80">
              Cobra las mesas abiertas para habilitar el cierre.
            </p>
          ) : null}
        </div>
      </section>

      <CloseShiftModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onShiftClosed={onShiftClosed}
      />
    </div>
  );
};
