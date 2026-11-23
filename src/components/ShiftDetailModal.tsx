import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  ClipboardList,
  Clock3,
  Eye,
  FileSpreadsheet,
  History,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  TableProperties,
  TrendingDown,
} from 'lucide-react';
import type { AuditEntry, ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  actionLabel,
  cn,
  durationLabel,
  expenseCategoryLabel,
  formatClock,
  formatDateShort,
  formatDateTime,
  formatMoney,
  formatShiftRange,
  paymentLabel,
  plural,
  roleLabel,
  transferCashEffectLabel,
  transferDirectionLabel,
} from '../lib/format';
import { Modal } from './ui/Modal';
import { EmptyState } from './ui/EmptyState';

interface ShiftDetailModalProps {
  shiftId: number | null;
  onClose: () => void;
  onPrint: (shift: ShiftDetail) => void;
  onPrintExpenses: (shift: ShiftDetail) => void;
}

type DetailTab = 'resumen' | 'partidas' | 'barra' | 'gastos' | 'traspasos' | 'auditoria';

const attendanceDuration = (checkInAt: string, checkOutAt: string) => {
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  return durationLabel(Math.round((end - start) / 60000));
};

const statusBadge = (status: 'open' | 'closed') =>
  status === 'open' ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
      <span className="h-1 w-1 rounded-full bg-emerald-400" />
      Abierto
    </span>
  ) : (
    <span className="inline-flex rounded-md border border-slate-700 bg-slate-800/50 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
      Cerrado
    </span>
  );

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  shiftId,
  onClose,
  onPrint,
  onPrintExpenses,
}) => {
  const { settings, user } = useApp();
  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [tableDetailId, setTableDetailId] = useState<number | null>(null);
  const currency = settings?.currency || 'Bs';
  const isAdmin = user?.role === 'admin';
  const cashTransfers = shift?.cashTransfers ?? [];

  const load = useCallback(async () => {
    if (!shiftId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.shift(shiftId);
      setShift(response.shift);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el turno.');
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    if (!shiftId) {
      setShift(null);
      return;
    }
    setTab('resumen');
    load();
  }, [load, shiftId]);

  const tabs: Array<{ id: DetailTab; label: string; count?: number; adminOnly?: boolean }> = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'partidas', label: 'Partidas', count: shift?.tablePlays.length },
    { id: 'barra', label: 'Barra', count: shift?.sales.length },
    { id: 'gastos', label: 'Gastos', count: shift?.expenses.length },
    { id: 'traspasos', label: 'Traspasos', count: cashTransfers.length },
    { id: 'auditoria', label: 'Auditoría', count: shift?.audit?.length, adminOnly: true },
  ];

  const difference = shift?.closing?.difference ?? null;
  const hasDifference = difference !== null && Math.abs(Number(difference)) > 0.009;
  const transfersNet =
    Number(shift?.totals.cashTransfersIn ?? 0) - Number(shift?.totals.cashTransfersOut ?? 0);

  const tableDetail = useMemo(() => {
    if (!shift || tableDetailId === null) return null;
    const tableRow = shift.tableSummary.find((row) => row.tableId === tableDetailId);
    const plays = shift.tablePlays.filter((play) => play.tableId === tableDetailId);
    const openSessions = (shift.openSessions ?? []).filter((session) => session.tableId === tableDetailId);
    const itemsMap = new Map<string, { name: string; quantity: number; amount: number }>();
    const add = (name: string, quantity: number, amount: number) => {
      const current = itemsMap.get(name) || { name, quantity: 0, amount: 0 };
      current.quantity += Number(quantity || 0);
      current.amount += Number(amount || 0);
      itemsMap.set(name, current);
    };
    plays.forEach((play) => play.items.forEach((item) => add(item.name, item.quantity, Number(item.price) * Number(item.quantity))));
    openSessions.forEach((session) => session.items.forEach((item) => add(item.name, item.quantity, Number(item.price) * Number(item.quantity))));
    const items = [...itemsMap.values()].sort((a, b) => b.amount - a.amount);
    return {
      tableName: tableRow?.tableName || plays[0]?.tableName || openSessions[0]?.tableName || 'Mesa',
      plays,
      openSessions,
      items,
      total: items.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [shift, tableDetailId]);

  return (
    <Modal
      open={Boolean(shiftId)}
      title={shift ? `Turno #${shift.id} · ${formatShiftRange(shift)}` : 'Detalle del turno'}
      subtitle={shift ? `${shift.openedByName}${shift.closedByName ? ` → ${shift.closedByName}` : ''}` : 'Cargando información…'}
      icon={<History className="h-4 w-4" />}
      onClose={onClose}
      size="2xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!shift}
            onClick={() => {
              if (shift) onPrintExpenses(shift);
            }}
          >
            <FileSpreadsheet className="h-4 w-4 text-rose-400" />
            Planilla de gastos
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!shift}
            onClick={() => {
              if (shift) onPrint(shift);
            }}
          >
            <Printer className="h-4 w-4" />
            Imprimir planilla
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <p className="text-xs">Cargando detalle del turno…</p>
        </div>
      ) : error ? (
        <EmptyState
          title="No se pudo cargar el turno"
          description={error}
          icon={<AlertTriangle className="h-6 w-6" />}
          action={
            <button type="button" className="btn-secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          }
        />
      ) : shift ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#08111d] px-3.5 py-3">
            <div className="flex items-center gap-2">
              {statusBadge(shift.status)}
              <span className="text-[10px] text-slate-500">
                Apertura {formatDateTime(shift.openedAt)}
                {shift.closedAt ? ` · Cierre ${formatDateTime(shift.closedAt)}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <ClipboardList className="h-3.5 w-3.5" />
              {shift.totals.playsCount} partidas · {shift.totals.salesCount} ventas ·{' '}
              {shift.totals.expensesCount} gastos
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <div className="kpi">
              <p className="label mb-1">Total V.P. + T.B. + C.</p>
              <p className="num text-base font-bold text-emerald-300">
                {formatMoney(
                  shift.totals.totalWithChange ??
                    Number(shift.initialCash || 0) + Number(shift.totals.grossTotal || 0),
                  currency
                )}
              </p>
              <p className="mt-0.5 text-[9px] text-slate-500">
                Venta de Productos + Tiempo Billar + Cambio
              </p>
            </div>
            <div className="kpi">
              <p className="label mb-1">Tiempo Billar</p>
              <p className="num text-base font-bold text-sky-300">
                {formatMoney(shift.totals.totalBilliard, currency)}
              </p>
            </div>
            <div className="kpi">
              <p className="label mb-1">Venta de Productos</p>
              <p className="num text-base font-bold text-violet-300">
                {formatMoney(shift.totals.totalProducts, currency)}
              </p>
            </div>
            <div className="kpi">
              <p className="label mb-1">QR</p>
              <p className="num text-base font-bold text-sky-300">
                {formatMoney(shift.totals.totalQr, currency)}
              </p>
            </div>
            <div className="kpi">
              <p className="label mb-1">Saldo en contra (−) o a favor (+)</p>
              <p
                className={cn(
                  'num text-base font-bold',
                  difference === null
                    ? 'text-slate-500'
                    : hasDifference
                    ? Number(difference) > 0
                      ? 'text-amber-300'
                      : 'text-rose-300'
                    : 'text-emerald-300'
                )}
              >
                {difference === null
                  ? shift.status === 'open'
                    ? 'En curso'
                    : '—'
                  : `${Number(difference) > 0 ? '+' : Number(difference) < 0 ? '−' : ''}${formatMoney(
                      Math.abs(Number(difference)),
                      currency
                    )}`}
              </p>
            </div>
          </div>
          {Number(shift.totals.pendingTotal || 0) > 0 ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-200/90">
              Incluye {formatMoney(shift.totals.pendingTotal, currency)} de consumo por cobrar en{' '}
              {plural(
                Number(shift.totals.openSessionsCount || 0) + Number(shift.totals.openTabsCount || 0),
                'mesa o cliente abierto',
                'mesas o clientes abiertos'
              )}
              . Ese monto todavía no está en caja.
            </p>
          ) : null}

          <div className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-slate-800 pb-2">
            {tabs
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn('chip shrink-0 text-[10px]', tab === item.id && 'chip-active')}
                >
                  {item.label}
                  {item.count !== undefined ? (
                    <span className="rounded bg-slate-800 px-1 py-0.5 text-[8px] text-slate-400">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              ))}
          </div>

          {tab === 'resumen' ? (
            <div className="space-y-4">
              {shift.status === 'closed' ? (
                <div
                  className={cn(
                    'rounded-xl border p-3.5',
                    hasDifference
                      ? 'border-amber-500/25 bg-amber-500/[0.06]'
                      : 'border-emerald-500/20 bg-emerald-500/[0.05]'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-white">
                        {hasDifference ? 'Cierre con diferencia' : 'Caja cerrada y cuadrada'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Cerrado por {shift.closedByName} · {formatDateTime(shift.closedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px]">
                      <div className="text-right">
                        <p className="text-slate-500">Esperado</p>
                        <p className="num font-bold text-slate-300">
                          {formatMoney(shift.closing?.expectedCash ?? shift.totals.expectedCash, currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500">Contado</p>
                        <p className="num font-bold text-slate-300">
                          {formatMoney(shift.closing?.countedCash, currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500">Diferencia</p>
                        <p
                          className={cn(
                            'num font-bold',
                            hasDifference
                              ? Number(difference) > 0
                                ? 'text-amber-300'
                                : 'text-rose-300'
                              : 'text-emerald-300'
                          )}
                        >
                          {difference !== null
                            ? `${Number(difference) > 0 ? '+' : ''}${formatMoney(difference, currency)}`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {shift.closing?.notes ? (
                    <p className="mt-2 border-t border-slate-800/80 pt-2 text-[11px] leading-relaxed text-slate-400">
                      {shift.closing.notes}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3.5 py-2.5 text-[11px] text-emerald-200/90">
                  Turno en curso. La caja todavía no tiene un cierre definitivo.
                </div>
              )}

              {shift.outOfRange ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div>
                      <p className="text-xs font-bold text-amber-200">
                        Movimientos de otras fechas no incluidos
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-amber-200/80">
                        El turno corresponde solo al {formatDateShort(shift.dateStart)}. Estos
                        movimientos no se suman a los totales de la planilla:
                      </p>
                      <ul className="mt-1.5 space-y-0.5 text-[10px] text-amber-100/90">
                        {shift.outOfRange.dates.map((item) => (
                          <li key={item.date}>
                            {formatDateShort(item.date)} ·{' '}
                            {plural(item.count, 'movimiento', 'movimientos')} ·{' '}
                            <span className="num font-bold">{formatMoney(item.total, currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-800 bg-[#08111d]">
                <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Entrada y salida del personal
                  </p>
                </div>
                {shift.attendance.length === 0 ? (
                  <p className="px-3.5 py-5 text-center text-[11px] text-slate-500">
                    Sin registros de entrada y salida para este turno.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead className="table-head">
                      <tr>
                        <th>Personal</th>
                        <th>Fecha</th>
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th>Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.attendance.map((entry) => (
                        <tr key={entry.id}>
                          <td className="font-medium text-slate-200">{entry.userName}</td>
                          <td className="text-slate-400">{formatDateShort(entry.date)}</td>
                          <td className="num text-sky-300">{formatClock(entry.checkInAt)}</td>
                          <td
                            className={cn(
                              'num',
                              entry.checkOutAt ? 'text-sky-300' : 'text-amber-300'
                            )}
                          >
                            {entry.checkOutAt ? formatClock(entry.checkOutAt) : 'Sin salida'}
                          </td>
                          <td className="num">
                            {entry.checkOutAt
                              ? attendanceDuration(entry.checkInAt, entry.checkOutAt)
                              : 'En curso'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {Number(shift.totals.pendingTotal || 0) > 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#08111d]">
                  <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5">
                    <Clock3 className="h-4 w-4 text-slate-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Mesas y clientes abiertos
                    </p>
                    <span className="ml-auto text-[10px] font-bold text-amber-300">
                      {formatMoney(shift.totals.pendingTotal, currency)} por cobrar
                    </span>
                  </div>
                  <table className="data-table">
                    <thead className="table-head">
                      <tr>
                        <th>Mesa / cliente</th>
                        <th>Entrada</th>
                        <th>Duración</th>
                        <th className="text-right">Tiempo Billar</th>
                        <th className="text-right">Venta de Productos</th>
                        <th className="text-right">Total</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(shift.openSessions ?? []).map((session) => (
                        <tr key={`session-${session.id}`}>
                          <td className="font-medium text-slate-200">
                            {session.tableName}
                            {session.outsideShiftDate ? (
                              <span className="ml-1 text-[9px] text-slate-500">(otra fecha)</span>
                            ) : null}
                          </td>
                          <td className="num text-[10px] text-slate-400">
                            {formatDateTime(session.startTime)}
                          </td>
                          <td className="num">{session.timer}</td>
                          <td className="num text-right">{formatMoney(session.billiardAmount, currency)}</td>
                          <td className="num text-right">{formatMoney(session.productsAmount, currency)}</td>
                          <td className="num text-right font-bold text-slate-200">
                            {formatMoney(session.totalAmount, currency)}
                          </td>
                          <td className="max-w-[180px] truncate text-slate-400">{session.notes || '—'}</td>
                        </tr>
                      ))}
                      {(shift.openCustomerTabs ?? []).map((tab) => (
                        <tr key={`tab-${tab.id}`}>
                          <td className="font-medium text-slate-200">
                            Cliente: {tab.customerName}
                            {tab.outsideShiftDate ? (
                              <span className="ml-1 text-[9px] text-slate-500">(otra fecha)</span>
                            ) : null}
                          </td>
                          <td className="num text-[10px] text-slate-400">
                            {formatDateTime(tab.createdAt)}
                          </td>
                          <td className="text-slate-500">—</td>
                          <td className="num text-right">{formatMoney(0, currency)}</td>
                          <td className="num text-right">{formatMoney(tab.itemsAmount, currency)}</td>
                          <td className="num text-right font-bold text-slate-200">
                            {formatMoney(tab.itemsAmount, currency)}
                          </td>
                          <td className="max-w-[180px] truncate text-slate-400">
                            {tab.items.map((item) => `${item.quantity}× ${item.name}`).join(', ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-[#08111d]">
                  <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5">
                    <TableProperties className="h-4 w-4 text-slate-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tiempo Billar y Venta de Productos por mesa
                    </p>
                  </div>
                  {shift.tableSummary.length === 0 ? (
                    <p className="px-3.5 py-5 text-center text-[11px] text-slate-500">Sin movimientos.</p>
                  ) : (
                    <table className="data-table">
                      <thead className="table-head">
                        <tr>
                          <th>Mesa</th>
                          <th className="text-center">Partidas</th>
                          <th className="text-right">Tiempo Billar</th>
                          <th className="text-right">Venta de Productos</th>
                          <th className="text-right">Total</th>
                          <th className="text-right">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shift.tableSummary.map((row) => (
                          <tr key={row.tableId}>
                            <td className="font-medium text-slate-200">{row.tableName}</td>
                            <td className="num text-center">
                              {row.playsCount}
                              {Number(row.openCount || 0) > 0 ? (
                                <span className="ml-1 text-[9px] text-slate-500">
                                  +{row.openCount}
                                </span>
                              ) : null}
                            </td>
                            <td className="num text-right">{formatMoney(row.billiard, currency)}</td>
                            <td className="num text-right">{formatMoney(row.products, currency)}</td>
                            <td className="num text-right font-bold text-slate-200">
                              {formatMoney(row.total, currency)}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300"
                                title={`Ver detalle de ${row.tableName}`}
                                onClick={() => setTableDetailId(row.tableId)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(() => {
                          const quick = shift.quickSalesSummary;
                          const quickCount = quick?.count ?? shift.sales.filter((sale) => sale.status === 'active').length;
                          const quickOpen = quick?.openCount ?? (shift.openCustomerTabs?.length ?? 0);
                          const quickProducts =
                            quick?.products ??
                            shift.sales.filter((sale) => sale.status === 'active').reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0) +
                              (shift.openCustomerTabs ?? []).reduce((sum, tab) => sum + Number(tab.itemsAmount || 0), 0);
                          if (quickCount === 0 && quickOpen === 0 && quickProducts <= 0) return null;
                          return (
                            <tr className="bg-slate-900/40">
                              <td className="font-medium text-slate-200">Ventas Directas / Clientes</td>
                              <td className="num text-center">
                                {quickCount}
                                {quickOpen > 0 ? <span className="ml-1 text-[9px] text-slate-500">+{quickOpen}</span> : null}
                              </td>
                              <td className="num text-right">{formatMoney(0, currency)}</td>
                              <td className="num text-right">{formatMoney(quickProducts, currency)}</td>
                              <td className="num text-right font-bold text-slate-200">{formatMoney(quickProducts, currency)}</td>
                              <td className="text-right text-[10px] text-slate-500">—</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#08111d]">
                  <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5">
                    <ShoppingBag className="h-4 w-4 text-slate-500" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Venta de Productos
                    </p>
                  </div>
                  {shift.productSummary.length === 0 ? (
                    <p className="px-3.5 py-5 text-center text-[11px] text-slate-500">Sin productos.</p>
                  ) : (
                    <table className="data-table">
                      <thead className="table-head">
                        <tr>
                          <th>Producto</th>
                          <th className="text-right">P. Unit.</th>
                          <th className="text-center">Cant.</th>
                          <th className="text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shift.productSummary.map((row) => {
                          const unitPrice = Number(row.unitPrice || 0) || (Number(row.quantity) > 0 ? Number(row.amount) / Number(row.quantity) : 0);
                          return (
                            <tr key={row.name}>
                              <td className="text-slate-200">{row.name}</td>
                              <td className="num text-right text-slate-400">{formatMoney(unitPrice, currency)}</td>
                              <td className="num text-center">{row.quantity}</td>
                              <td className="num text-right">{formatMoney(row.amount, currency)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-700 bg-slate-900/40">
                          <td className="font-bold text-slate-300">Total</td>
                          <td />
                          <td className="num text-center font-bold text-slate-200">
                            {shift.productSummary.reduce((sum, row) => sum + Number(row.quantity || 0), 0)}
                          </td>
                          <td className="num text-right font-bold text-slate-200">
                            {formatMoney(shift.productSummary.reduce((sum, row) => sum + Number(row.amount || 0), 0), currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#08111d] p-3.5">
                <div className="grid gap-3 text-[11px] sm:grid-cols-4">
                  <div>
                    <p className="label mb-1">Cambio</p>
                    <p className="num text-sm font-bold text-slate-200">
                      {formatMoney(shift.initialCash, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="label mb-1">Gastos de Caja</p>
                    <p className="num text-sm font-bold text-rose-300">
                      {formatMoney(shift.totals.totalExpenses, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="label mb-1">QR</p>
                    <p className="num text-sm font-bold text-sky-300">
                      {plural(shift.qrPayments.length, 'movimiento', 'movimientos')}
                    </p>
                  </div>
                  <div>
                    <p className="label mb-1">Traspasos (neto en caja)</p>
                    <p
                      className={cn(
                        'num text-sm font-bold',
                        transfersNet < 0 ? 'text-amber-300' : 'text-emerald-300'
                      )}
                    >
                      {transfersNet > 0 ? '+' : ''}
                      {formatMoney(transfersNet, currency)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {plural(shift.totals.transfersCount ?? 0, 'traspaso', 'traspasos')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'partidas' ? (
            shift.tablePlays.length === 0 ? (
              <EmptyState title="Sin partidas" icon={<TableProperties className="h-6 w-6" />} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="data-table min-w-[720px]">
                  <thead className="table-head">
                    <tr>
                      <th>Mesa</th>
                      <th>Entrada → salida</th>
                      <th>Duración</th>
                      <th>Tiempo Billar</th>
                      <th>Venta de Productos</th>
                      <th>Total</th>
                      <th>Pago</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shift.tablePlays.map((play) => (
                      <tr key={play.id} className={play.status === 'voided' ? 'opacity-55' : ''}>
                        <td className="font-medium text-slate-200">{play.tableName}</td>
                        <td className="num text-[10px] text-slate-400">
                          {formatClock(play.startTime)} → {formatClock(play.endTime)}
                        </td>
                        <td className="num">{durationLabel(play.durationMinutes)}</td>
                        <td className="num">{formatMoney(play.billiardAmount, currency)}</td>
                        <td className="num">{formatMoney(play.productsAmount, currency)}</td>
                        <td className="num font-bold text-slate-200">
                          {formatMoney(play.totalAmount, currency)}
                        </td>
                        <td>{paymentLabel(play.paymentMethod)}</td>
                        <td>
                          {play.status === 'voided' ? (
                            <span className="text-[9px] font-bold text-rose-300">
                              Anulada{play.voidReason ? `: ${play.voidReason}` : ''}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-300">Cobrada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'barra' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#08111d]">
                <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5">
                  <ReceiptText className="h-4 w-4 text-slate-500" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Venta de Productos (barra)
                  </p>
                </div>
                {shift.sales.length === 0 ? (
                  <p className="px-3.5 py-5 text-center text-[11px] text-slate-500">
                    Sin venta de productos en barra.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead className="table-head">
                      <tr>
                        <th>Hora / cajero</th>
                        <th>Detalle</th>
                        <th>Total</th>
                        <th>Pago</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.sales.map((sale) => (
                        <tr key={sale.id} className={sale.status === 'voided' ? 'opacity-55' : ''}>
                          <td>
                            <p className="num text-slate-200">{formatClock(sale.createdAt)}</p>
                            <p className="text-[10px] text-slate-500">{sale.createdByName}</p>
                          </td>
                          <td className="max-w-[260px] text-slate-300">
                            {sale.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                          </td>
                          <td className="num font-bold text-slate-200">
                            {formatMoney(sale.totalAmount, currency)}
                          </td>
                          <td>{paymentLabel(sale.paymentMethod)}</td>
                          <td>
                            {sale.status === 'voided' ? (
                              <span className="text-[9px] font-bold text-rose-300">
                                Anulada{sale.voidReason ? `: ${sale.voidReason}` : ''}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-300">Activa</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#08111d]">
                <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5">
                  <ShieldCheck className="h-4 w-4 text-slate-500" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    QR
                  </p>
                </div>
                {shift.qrPayments.length === 0 ? (
                  <p className="px-3.5 py-5 text-center text-[11px] text-slate-500">Sin pagos QR.</p>
                ) : (
                  <table className="data-table">
                    <thead className="table-head">
                      <tr>
                        <th>Hora</th>
                        <th>Origen</th>
                        <th>Detalle</th>
                        <th>Referencia</th>
                        <th className="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.qrPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="num">{formatClock(payment.timestamp)}</td>
                          <td>{payment.source === 'mesa' ? 'Mesa' : 'Barra'}</td>
                          <td className="max-w-[220px] truncate text-slate-300">{payment.description}</td>
                          <td className="text-slate-500">{payment.reference || '—'}</td>
                          <td className="num text-right font-bold text-sky-300">
                            {formatMoney(payment.amount, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'gastos' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#08111d] px-3.5 py-2.5">
                <p className="text-[10px] text-slate-500">
                  Gastos con detalle de los productos comprados.
                </p>
                <button
                  type="button"
                  className="btn-ghost border border-slate-800 px-2 py-1 text-[10px]"
                  onClick={() => onPrintExpenses(shift)}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Planilla de gastos
                </button>
              </div>
              {shift.expenses.length === 0 ? (
                <EmptyState title="Sin gastos" icon={<TrendingDown className="h-6 w-6" />} />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="data-table min-w-[520px]">
                    <thead className="table-head">
                      <tr>
                        <th>Hora / cajero</th>
                        <th>Concepto y productos</th>
                        <th>Categoría</th>
                        <th>Monto</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shift.expenses.map((expense) => (
                        <tr key={expense.id} className={expense.status === 'voided' ? 'opacity-55' : ''}>
                          <td>
                            <p className="num text-slate-200">{formatClock(expense.createdAt)}</p>
                            <p className="text-[10px] text-slate-500">{expense.createdByName}</p>
                          </td>
                          <td>
                            <p className="text-slate-200">{expense.concept}</p>
                            {expense.items.length > 0 ? (
                              <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                                {expense.items
                                  .map((item) => `${item.quantity}× ${item.name}`)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </td>
                          <td>{expenseCategoryLabel(expense.category)}</td>
                          <td className="num font-bold text-rose-300">
                            {formatMoney(expense.amount, currency)}
                          </td>
                          <td>
                            {expense.status === 'voided' ? (
                              <span className="text-[9px] font-bold text-rose-300">
                                Anulado{expense.voidReason ? `: ${expense.voidReason}` : ''}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-300">Activo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'traspasos' ? (
            cashTransfers.length === 0 ? (
              <EmptyState
                title="Sin traspasos QR ↔ efectivo"
                description="Los intercambios de efectivo por QR registrados en este turno aparecerán aquí."
                icon={<ArrowLeftRight className="h-6 w-6" />}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="data-table min-w-[720px]">
                  <thead className="table-head">
                    <tr>
                      <th>Hora / registró</th>
                      <th>Movimiento</th>
                      <th>Concepto</th>
                      <th>Referencia</th>
                      <th>Efecto en caja</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTransfers.map((transfer) => {
                      const cashOut = transfer.direction === 'qr_to_cash';
                      return (
                        <tr
                          key={transfer.id}
                          className={transfer.status === 'voided' ? 'opacity-55' : ''}
                        >
                          <td>
                            <p className="num text-slate-200">{formatClock(transfer.createdAt)}</p>
                            <p className="text-[10px] text-slate-500">{transfer.createdByName}</p>
                          </td>
                          <td>
                            <span
                              className={cn(
                                'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                                cashOut
                                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                              )}
                            >
                              {transferDirectionLabel(transfer.direction)}
                            </span>
                          </td>
                          <td className="max-w-[200px] text-slate-300">{transfer.concept}</td>
                          <td className="max-w-[140px] truncate text-slate-500">
                            {transfer.reference || '—'}
                          </td>
                          <td
                            className={cn(
                              'num font-bold',
                              cashOut ? 'text-amber-300' : 'text-emerald-300'
                            )}
                          >
                            {cashOut ? '−' : '+'}
                            {formatMoney(transfer.amount, currency)}
                            <span className="ml-1 text-[9px] font-normal text-slate-500">
                              {transferCashEffectLabel(transfer.direction)}
                            </span>
                          </td>
                          <td>
                            {transfer.status === 'voided' ? (
                              <span className="text-[9px] font-bold text-rose-300">
                                Anulado{transfer.voidReason ? `: ${transfer.voidReason}` : ''}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-300">Vigente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'auditoria' && isAdmin ? (
            shift.audit && shift.audit.length > 0 ? (
              <div className="space-y-1.5">
                {shift.audit.map((entry: AuditEntry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                        <p className="text-[11px] font-semibold text-slate-200">
                          {actionLabel(entry.action)}
                        </p>
                        <span className="text-[9px] text-slate-500">{entry.userName}</span>
                      </div>
                      <span className="num text-[9px] text-slate-500">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    {entry.details ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[9px] text-slate-500 hover:text-slate-300">
                          Ver datos
                        </summary>
                        <pre className="scroll-thin mt-1 max-h-28 overflow-auto rounded-md bg-[#070d16] p-2 text-[9px] leading-relaxed text-slate-400">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin registros de auditoría"
                description="Las acciones del turno aparecerán aquí."
                icon={<ShieldCheck className="h-6 w-6" />}
              />
            )
          ) : null}
        </div>
      ) : null}

      <Modal
        open={Boolean(tableDetail)}
        title={tableDetail ? `Detalle · ${tableDetail.tableName}` : 'Detalle de mesa'}
        subtitle={tableDetail ? 'Productos consumidos en esta mesa durante el turno' : undefined}
        icon={<Eye className="h-4 w-4" />}
        onClose={() => setTableDetailId(null)}
        size="lg"
        footer={
          <button type="button" className="btn-secondary" onClick={() => setTableDetailId(null)}>
            Cerrar
          </button>
        }
      >
        {tableDetail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="kpi">
                <p className="label mb-1">Partidas</p>
                <p className="num text-sm font-bold text-slate-200">
                  {tableDetail.plays.length}
                  {tableDetail.openSessions.length > 0 ? ` + ${tableDetail.openSessions.length} abierta(s)` : ''}
                </p>
              </div>
              <div className="kpi">
                <p className="label mb-1">Ítems</p>
                <p className="num text-sm font-bold text-slate-200">
                  {tableDetail.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                </p>
              </div>
              <div className="kpi">
                <p className="label mb-1">Consumo</p>
                <p className="num text-sm font-bold text-emerald-300">{formatMoney(tableDetail.total, currency)}</p>
              </div>
            </div>

            {tableDetail.items.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-[#08111d] px-3.5 py-5 text-center text-[11px] text-slate-500">
                Esta mesa no tiene productos consumidos.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="data-table">
                  <thead className="table-head">
                    <tr>
                      <th>Producto</th>
                      <th className="text-right">P. Unit.</th>
                      <th className="text-center">Cant.</th>
                      <th className="text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableDetail.items.map((item) => {
                      const unit = Number(item.quantity) > 0 ? Number(item.amount) / Number(item.quantity) : 0;
                      return (
                        <tr key={item.name}>
                          <td className="text-slate-200">{item.name}</td>
                          <td className="num text-right text-slate-400">{formatMoney(unit, currency)}</td>
                          <td className="num text-center">{item.quantity}</td>
                          <td className="num text-right font-bold text-slate-200">{formatMoney(item.amount, currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-900/40">
                      <td className="font-bold text-slate-300">Total</td>
                      <td />
                      <td className="num text-center font-bold text-slate-200">
                        {tableDetail.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                      </td>
                      <td className="num text-right font-bold text-slate-200">
                        {formatMoney(tableDetail.total, currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </Modal>
  );
};
