import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  LogIn,
  Printer,
  ReceiptText,
  Replace,
  Wallet,
} from 'lucide-react';
import type { ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import {
  formatClock,
  formatDateTime,
  formatMoney,
  formatShiftRange,
  plural,
} from '../lib/format';
import { Modal } from './ui/Modal';

interface ShiftClosedDialogProps {
  shift: ShiftDetail | null;
  onClose: () => void;
  onViewHistory: () => void;
  onNewShift: () => void;
}

export const ShiftClosedDialog: React.FC<ShiftClosedDialogProps> = ({
  shift,
  onClose,
  onViewHistory,
  onNewShift,
}) => {
  const { settings, user, attendanceToday } = useApp();
  if (!shift) return null;

  const currency = settings?.currency || 'Bs';
  const closing = shift.closing;
  const difference = Number(closing?.difference ?? 0);
  const balanced = Math.abs(difference) < 0.01;
  const expected = closing?.expectedCash ?? null;
  const counted = closing?.countedCash ?? null;
  const isAdmin = user?.role === 'admin';

  return (
    <Modal
      open
      title="Caja cerrada correctamente"
      subtitle={`${formatShiftRange(shift)} · Turno #${shift.id}`}
      icon={<CheckCircle2 className="h-4 w-4" />}
      onClose={onClose}
      size="lg"
      bodyClassName="print-area"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onViewHistory}>
            <ReceiptText className="h-4 w-4" />
            Ver historial
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.print()}
            title="Imprimir comprobante"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button type="button" className="btn-primary" onClick={onNewShift}>
            <Wallet className="h-4 w-4" />
            Abrir nueva caja
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            balanced
              ? 'border-emerald-500/25 bg-emerald-500/[0.07]'
              : 'border-amber-500/30 bg-amber-500/[0.08]'
          }`}
        >
          {balanced ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          )}
          <div>
            <p className={`text-sm font-bold ${balanced ? 'text-emerald-300' : 'text-amber-300'}`}>
              {balanced ? 'La caja cuadra perfectamente' : 'Hay una diferencia de caja'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {balanced
                ? 'El efectivo contado coincide con lo registrado. El turno quedó bloqueado, auditado y tu salida quedó registrada.'
                : 'El cierre quedó registrado con la diferencia y las observaciones. Tu salida quedó registrada y el administrador podrá revisarlo.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="kpi">
            <p className="label mb-1">Ventas totales</p>
            <p className="num text-base font-bold text-white">
              {formatMoney(shift.totals.grossTotal, currency)}
            </p>
          </div>
          <div className="kpi">
            <p className="label mb-1">Efectivo esperado</p>
            <p className="num text-base font-bold text-sky-300">
              {isAdmin && expected !== null ? formatMoney(expected, currency) : '—'}
            </p>
          </div>
          <div className="kpi">
            <p className="label mb-1">Efectivo contado</p>
            <p className="num text-base font-bold text-emerald-300">
              {isAdmin && counted !== null ? formatMoney(counted, currency) : 'Registrado'}
            </p>
          </div>
          <div className="kpi">
            <p className="label mb-1">Diferencia</p>
            <p
              className={`num text-base font-bold ${
                balanced ? 'text-emerald-300' : difference > 0 ? 'text-amber-300' : 'text-rose-300'
              }`}
            >
              {isAdmin
                ? `${difference > 0 ? '+' : ''}${formatMoney(difference, currency)}`
                : 'Registrada'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#08111d] p-4">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Apertura</span>
                <span className="text-right text-slate-300">
                  {formatDateTime(shift.openedAt)} · {shift.openedByName}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Cierre</span>
                <span className="text-right text-slate-300">
                  {formatDateTime(shift.closedAt)} · {shift.closedByName}
                </span>
              </div>
              {attendanceToday ? (
                <div className="flex justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <LogIn className="h-3 w-3" />
                    Entrada / salida
                  </span>
                  <span className="num text-emerald-300">
                    {formatClock(attendanceToday.checkInAt)} →{' '}
                    {attendanceToday.checkOutAt
                      ? formatClock(attendanceToday.checkOutAt)
                      : formatClock(shift.closedAt)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Fondo inicial</span>
                <span className="num text-slate-300">{formatMoney(shift.initialCash, currency)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Billar</span>
                <span className="num text-slate-300">
                  {formatMoney(shift.totals.totalBilliard, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Productos</span>
                <span className="num text-slate-300">
                  {formatMoney(shift.totals.totalProducts, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Gastos</span>
                <span className="num text-rose-300">
                  {formatMoney(shift.totals.totalExpenses, currency)}
                </span>
              </div>
            </div>
          </div>

          {closing?.notes ? (
            <div className="mt-3 border-t border-slate-800 pt-3">
              <p className="label mb-1">Observaciones del cierre</p>
              <p className="text-xs leading-relaxed text-slate-300">{closing.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {plural(shift.totals.playsCount, 'partida', 'partidas')} ·{' '}
            {plural(shift.totals.salesCount, 'venta', 'ventas')} de barra
          </span>
          <span className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" />
            {formatMoney(shift.totals.totalQr, currency)} cobrados por QR
          </span>
          <span className="flex items-center gap-1.5">
            <Replace className="h-3.5 w-3.5" />
            Respaldo automático generado
          </span>
        </div>
      </div>
    </Modal>
  );
};
