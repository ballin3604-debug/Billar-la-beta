import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  LogIn,
  LogOut,
  LockKeyhole,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { formatClock, formatMoney } from '../lib/format';
import { useNow } from '../lib/useNow';
import { Modal } from './ui/Modal';

interface CloseShiftModalProps {
  open: boolean;
  onClose: () => void;
  onShiftClosed: (shift: ShiftDetail) => void;
}

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  open,
  onClose,
  onShiftClosed,
}) => {
  const {
    currentShift,
    settings,
    user,
    tables,
    attendanceToday,
    clockOffset,
    applyMutation,
  } = useApp();
  const now = useNow(clockOffset);
  const currency = settings?.currency || 'Bs';
  const [detailDenominations, setDetailDenominations] = useState(true);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [countedInput, setCountedInput] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openTables = tables.filter((table) => table.status === 'occupied');

  useEffect(() => {
    if (open) {
      setDetailDenominations(true);
      setCounts({});
      setCountedInput('');
      setNotes('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const denominationTotal = useMemo(
    () =>
      round2(
        DENOMINATIONS.reduce((sum, denomination) => {
          const count = Number(counts[String(denomination)] || 0);
          return sum + (Number.isFinite(count) ? count : 0) * denomination;
        }, 0)
      ),
    [counts]
  );

  const countedCash = detailDenominations
    ? denominationTotal
    : round2(Number(countedInput.replace(',', '.')) || 0);
  const expectedCash = currentShift?.totals.expectedCash;
  const difference =
    expectedCash !== undefined && expectedCash !== null
      ? round2(countedCash - Number(expectedCash))
      : null;
  const isAdmin = user?.role === 'admin';

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (openTables.length > 0) {
      return setError('Hay mesas abiertas. Cóbralas o anúlalas antes de cerrar la caja.');
    }
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return setError('El efectivo contado no es válido.');
    }
    if (difference !== null && Math.abs(difference) > 0.009 && notes.trim().length < 3) {
      return setError('Explica la diferencia de caja en las observaciones antes de cerrar.');
    }

    setBusy(true);
    try {
      const denominations = detailDenominations
        ? Object.fromEntries(
            DENOMINATIONS.map((denomination) => [
              String(denomination),
              Number(counts[String(denomination)] || 0),
            ])
          )
        : {};
      const response = await api.closeShift({
        countedCash,
        notes: notes.trim(),
        denominations,
      });
      applyMutation(response);
      if (response.closedShift) {
        onShiftClosed(response.closedShift);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cerrar la caja.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Cerrar caja del turno"
      subtitle="Conteo final de efectivo y bloqueo del turno."
      icon={<LockKeyhole className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Seguir operando
          </button>
          <button
            type="button"
            className="btn-amber"
            onClick={submit}
            disabled={busy || openTables.length > 0}
          >
            {busy ? 'Cerrando…' : 'Cerrar caja y guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-[11px] text-sky-200/90">
              <LogIn className="h-3.5 w-3.5" />
              Entrada
            </span>
            <span className="num text-sm font-bold text-sky-200">
              {attendanceToday ? formatClock(attendanceToday.checkInAt) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-[11px] text-emerald-200/90">
              <LogOut className="h-3.5 w-3.5" />
              Salida
            </span>
            <span className="num text-sm font-bold text-emerald-300">
              {formatClock(new Date(now))}
            </span>
          </div>
        </div>

        {openTables.length > 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-3.5 py-3 text-xs text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Todavía hay mesas abiertas</p>
              <p className="mt-0.5 leading-relaxed text-rose-300/80">
                {openTables.map((table) => table.name).join(', ')}. Cóbralas o anúlalas antes de
                cerrar la caja.
              </p>
            </div>
          </div>
        ) : null}

        {isAdmin && expectedCash !== undefined ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="kpi">
              <p className="label mb-1">Esperado en caja</p>
              <p className="num text-base font-bold text-sky-300">
                {formatMoney(expectedCash, currency)}
              </p>
            </div>
            <div className="kpi">
              <p className="label mb-1">Contado</p>
              <p className="num text-base font-bold text-emerald-300">
                {formatMoney(countedCash, currency)}
              </p>
            </div>
            <div className="kpi">
              <p className="label mb-1">Diferencia</p>
              <p
                className={`num text-base font-bold ${
                  difference === null || Math.abs(difference) < 0.01
                    ? 'text-emerald-300'
                    : difference > 0
                    ? 'text-amber-300'
                    : 'text-rose-300'
                }`}
              >
                {difference === null
                  ? '—'
                  : `${difference > 0 ? '+' : ''}${formatMoney(difference, currency)}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-sky-200/90">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Arqueo ciego:</strong> el sistema no muestra el efectivo esperado. Cuenta
              toda la gaveta con calma e ingresa el total. La diferencia se registrará al cerrar.
            </span>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="label mb-0">Efectivo contado</p>
            <button
              type="button"
              className="text-[10px] font-semibold text-sky-400 hover:text-sky-300"
              onClick={() => {
                setDetailDenominations((previous) => {
                  if (previous) setCountedInput(String(denominationTotal));
                  return !previous;
                });
                setError(null);
              }}
            >
              {detailDenominations ? 'Ingresar total directamente' : 'Detallar billetes y monedas'}
            </button>
          </div>

          {detailDenominations ? (
            <div className="rounded-xl border border-slate-800 bg-[#08111d] p-3">
              <p className="mb-2 text-[10px] text-slate-500">
                Escribe cuántos billetes o monedas de cada valor hay en la gaveta.
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                {DENOMINATIONS.map((denomination) => (
                  <label key={denomination} className="flex items-center gap-2">
                    <span className="num w-14 shrink-0 text-right text-[10px] font-semibold text-slate-400">
                      {denomination} {currency}
                    </span>
                    <input
                      className="input-compact num text-center"
                      inputMode="numeric"
                      placeholder="0"
                      value={counts[String(denomination)] || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!/^\d{0,4}$/.test(value)) return;
                        setCounts((previous) => ({ ...previous, [String(denomination)]: value }));
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2.5">
                <span className="text-[11px] text-slate-500">Total contado</span>
                <span className="num text-lg font-black text-emerald-300">
                  {formatMoney(denominationTotal, currency)}
                </span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="input num pl-9 text-lg font-bold"
                inputMode="decimal"
                placeholder="Total contado"
                value={countedInput}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*[.,]?\d{0,2}$/.test(value)) setCountedInput(value);
                }}
              />
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="closing-notes">
            Observaciones{' '}
            {difference !== null && Math.abs(difference) > 0.009 ? (
              <span className="text-rose-400">* obligatorio por la diferencia</span>
            ) : (
              <span className="font-normal text-slate-600">(opcional)</span>
            )}
          </label>
          <textarea
            id="closing-notes"
            className="input min-h-20 resize-none"
            maxLength={500}
            placeholder="Explica faltantes, sobrantes, propinas, retiros o cualquier novedad del turno…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <div className="mt-1 flex justify-end text-[10px] text-slate-600">{notes.length}/500</div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[10px] leading-relaxed text-amber-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Al cerrar, el turno queda bloqueado. No se podrá agregar, cobrar ni anular nada de este
            turno. Se creará un respaldo automático y se registrará tu salida con la hora del arqueo.
          </div>
        )}
      </div>
    </Modal>
  );
};
