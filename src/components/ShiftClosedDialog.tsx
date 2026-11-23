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

  const isAdmin = user?.role === 'admin';
  const currency = settings?.currency || 'Bs';

  if (!isAdmin) {
    const ownAttendance =
      shift.attendance.find((entry) => entry.userId === user?.id) ?? attendanceToday;
    const checkIn = ownAttendance?.checkInAt ?? null;
    const checkOut = ownAttendance?.checkOutAt ?? shift.closedAt;

    return (
      <Modal
        open
        title="Caja cerrada correctamente"
        subtitle={`Turno #${shift.id} · ${formatDateTime(shift.closedAt)}`}
        icon={<CheckCircle2 className="h-4 w-4" />}
        onClose={onClose}
        size="md"
        footer={
          <button type="button" className="btn-primary" onClick={onClose}>
            Volver a mesas
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-emerald-300">Tu salida quedó registrada</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                El turno quedó bloqueado. El administrador revisará el arqueo y los movimientos.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#08111d] p-4">
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <LogIn className="h-3 w-3" />
                  Entrada
                </span>
                <span className="num text-slate-300">
                  {checkIn ? formatClock(checkIn) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Salida</span>
                <span className="num text-emerald-300">
                  {checkOut ? formatClock(checkOut) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Turno</span>
                <span className="num text-slate-300">#{shift.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-3 w-3" />
                  Cierre
                </span>
                <span className="num text-slate-300">{formatDateTime(shift.closedAt)}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-slate-500">
            Abre el próximo turno con tu PIN cuando estés listo.
          </p>
        </div>
      </Modal>
    );
  }

  const closing = shift.closing;
  const difference = Number(closing?.difference ?? 0);
  const balanced = Math.abs(difference) < 0.01;
  const expected = closing?.expectedCash ?? null;
  const counted = closing?.countedCash ?? null;

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

        <div className="rounded-xl border border-slate-800 bg-[#08111d] p-4">
          <div className="mb-3 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
            <div>Apertura: <span className="text-slate-300">{formatDateTime(shift.openedAt)} · {shift.openedByName}</span></div>
            <div>Cierre: <span className="text-slate-300">{formatDateTime(shift.closedAt)} · {shift.closedByName}</span></div>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between gap-3"><span className="text-slate-400">V. Productos</span><span className="num font-semibold text-slate-200">{formatMoney(shift.totals.totalProducts, currency)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-400">Tiempo Billar</span><span className="num font-semibold text-slate-200">{formatMoney(shift.totals.totalBilliard, currency)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-400">Cambio</span><span className="num font-semibold text-slate-200">{formatMoney(shift.initialCash, currency)}</span></div>
            <div className="flex justify-between gap-3 border-t border-slate-800 pt-1.5 font-bold"><span className="text-slate-200">Total V.P. + T.B. + C.</span><span className="num text-emerald-300">{formatMoney(shift.totals.totalWithChange ?? (Number(shift.initialCash || 0) + Number(shift.totals.grossTotal || 0)), currency)}</span></div>
            {Number(shift.totals.pendingTotal || 0) > 0 ? <div className="flex justify-between gap-3 text-[10px] text-amber-300/90"><span>Consumo por cobrar (aún no entra a caja)</span><span className="num">−{formatMoney(shift.totals.pendingTotal || 0, currency)}</span></div> : null}
            <div className="flex justify-between gap-3"><span className="text-slate-400">QR</span><span className="num font-semibold text-sky-300">−{formatMoney(shift.totals.totalQr, currency)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-400">Gastos de Caja</span><span className="num font-semibold text-rose-300">−{formatMoney(shift.totals.totalExpenses, currency)}</span></div>
            {Number(shift.totals.cashTransfersIn || 0) > 0 ? <div className="flex justify-between gap-3 text-[10px]"><span className="text-slate-400">Traspasos que entran a caja</span><span className="num font-semibold text-emerald-300">+{formatMoney(shift.totals.cashTransfersIn || 0, currency)}</span></div> : null}
            {Number(shift.totals.cashTransfersOut || 0) > 0 ? <div className="flex justify-between gap-3 text-[10px]"><span className="text-slate-400">Traspasos que salen de caja</span><span className="num font-semibold text-amber-300">−{formatMoney(shift.totals.cashTransfersOut || 0, currency)}</span></div> : null}
            <div className="flex justify-between gap-3 border-t border-slate-800 pt-1.5 font-bold"><span className="text-slate-200">Total Efectivo Esperado</span><span className="num text-sky-300">{isAdmin && expected !== null ? formatMoney(expected, currency) : '—'}</span></div>
            <div className="flex justify-between gap-3 font-bold"><span className="text-slate-200">Saldo en contra (−) o a favor (+)</span><span className={`num ${balanced ? 'text-emerald-300' : difference > 0 ? 'text-amber-300' : 'text-rose-300'}`}>{isAdmin ? `${difference > 0 ? '+' : ''}${formatMoney(difference, currency)}` : 'Registrada'}</span></div>
            <div className="flex justify-between gap-3 border-t border-slate-800 pt-1.5 font-bold"><span className="text-slate-200">Total Efectivo en Caja</span><span className="num text-emerald-300">{isAdmin && counted !== null ? formatMoney(counted, currency) : 'Registrado'}</span></div>
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
            {plural(shift.totals.salesCount, 'venta de productos', 'ventas de productos')}
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
