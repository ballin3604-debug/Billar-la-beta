import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Ban,
  Banknote,
  CircleDollarSign,
  Clock3,
  CupSoda,
  FileSpreadsheet,
  History,
  LockKeyhole,
  LogIn,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TableProperties,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react';
import type { ExpenseCategory, PaymentMethod, ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  cn,
  durationLabel,
  expenseCategoryLabel,
  formatClock,
  formatDateTime,
  formatMoney,
  formatShiftRange,
  paymentLabel,
  plural,
  transferCashEffectLabel,
  transferDirectionLabel,
} from '../lib/format';
import { useNow } from '../lib/useNow';
import { StatCard } from './ui/StatCard';
import { EmptyState } from './ui/EmptyState';
import { ExpenseModal } from './ExpenseModal';
import { ExpenseReportModal } from './ExpenseReport';
import { CloseShiftModal } from './CloseShiftModal';
import { ShiftReportModal } from './ShiftReport';
import { BarSaleModal } from './BarSaleModal';
import { CustomerTabsModal } from './CustomerTabsModal';
import { TransferModal } from './TransferModal';
import { ReasonDialog } from './ui/ReasonDialog';
import { cn as cnClass } from '../lib/format';

type MovementTab = 'partidas' | 'ventas' | 'gastos' | 'traspasos' | 'qr';
type VoidKind = 'play' | 'sale' | 'expense' | 'transfer';

interface VoidTarget {
  kind: VoidKind;
  id: number;
  label: string;
  amount: number;
}

const paymentChip = (method: PaymentMethod | string) => {
  const tone =
    method === 'qr'
      ? 'border-sky-500/25 bg-sky-500/10 text-sky-300'
      : method === 'mixto'
      ? 'border-violet-500/25 bg-violet-500/10 text-violet-300'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  return (
    <span className={cnClass('inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold', tone)}>
      {paymentLabel(method)}
    </span>
  );
};

const statusBadge = (
  status: 'active' | 'voided',
  activeLabel = 'Vigente',
  voidedLabel = 'Anulada'
) =>
  status === 'voided' ? (
    <span className="inline-flex rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
      {voidedLabel}
    </span>
  ) : (
    <span className="inline-flex rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
      {activeLabel}
    </span>
  );

interface CashViewProps {
  onShiftClosed: (shift: ShiftDetail) => void;
}

export const CashView: React.FC<CashViewProps> = ({ onShiftClosed }) => {
  const {
    currentShift,
    settings,
    user,
    tables,
    attendanceToday,
    clockOffset,
    runAction,
    refresh,
    setTab,
  } = useApp();
  const now = useNow(clockOffset);
  const [movementTab, setMovementTab] = useState<MovementTab>('partidas');
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseReportOpen, setExpenseReportOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  const [customerTabsOpen, setCustomerTabsOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<VoidTarget | null>(null);
  const [voidBusy, setVoidBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openTables = useMemo(
    () => tables.filter((table) => table.status === 'occupied'),
    [tables]
  );

  if (user?.role !== 'admin') return null;
  if (!currentShift) return null;

  const shift = currentShift;
  const currency = settings?.currency || 'Bs';
  const isAdmin = user?.role === 'admin';
  const expected = shift.totals.expectedCash;
  const cashCollected = shift.totals.cashCollected;
  const shiftMinutes = Math.max(
    0,
    Math.floor((now - new Date(shift.openedAt).getTime()) / 60000)
  );
  const activePlays = shift.tablePlays.filter((play) => play.status === 'active');
  const activeSales = shift.sales.filter((sale) => sale.status === 'active');
  const activeExpenses = shift.expenses.filter((expense) => expense.status === 'active');

  const tabs: Array<{ id: MovementTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'partidas', label: 'Partidas', count: shift.tablePlays.length, icon: <TableProperties className="h-3.5 w-3.5" /> },
    { id: 'ventas', label: 'Venta de Productos', count: shift.sales.length, icon: <ShoppingBag className="h-3.5 w-3.5" /> },
    { id: 'gastos', label: 'Gastos de Caja', count: shift.expenses.length, icon: <TrendingDown className="h-3.5 w-3.5" /> },
    { id: 'traspasos', label: 'Traspasos', count: (shift.cashTransfers ?? []).length, icon: <ArrowLeftRight className="h-3.5 w-3.5" /> },
    { id: 'qr', label: 'QR', count: shift.qrPayments.length, icon: <QrCode className="h-3.5 w-3.5" /> },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh(false);
    } finally {
      setRefreshing(false);
    }
  };

  const confirmVoid = async (reason: string) => {
    if (!voidTarget) return;
    setVoidBusy(true);
    try {
      const response =
        voidTarget.kind === 'play'
          ? await runAction(() => api.voidPlay(voidTarget.id, reason))
          : voidTarget.kind === 'sale'
          ? await runAction(() => api.voidSale(voidTarget.id, reason))
          : voidTarget.kind === 'expense'
          ? await runAction(() => api.voidExpense(voidTarget.id, reason))
          : await runAction(() => api.voidTransfer(voidTarget.id, reason));
      if (response) setVoidTarget(null);
    } finally {
      setVoidBusy(false);
    }
  };

  const voidTitle =
    voidTarget?.kind === 'play'
      ? 'Anular partida'
      : voidTarget?.kind === 'sale'
      ? 'Anular venta de barra'
      : voidTarget?.kind === 'expense'
      ? 'Anular gasto'
      : 'Anular traspaso';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Caja del turno</h1>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
              Abierta
            </span>
            <span className="rounded-md border border-slate-800 bg-[#0b1422] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Turno #{shift.id}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTime(shift.openedAt)} · {durationLabel(shiftMinutes)}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
              Abrió {shift.openedByName}
            </span>
            {attendanceToday ? (
              <span className="flex items-center gap-1.5">
                <LogIn className="h-3.5 w-3.5 text-sky-500/70" />
                Entrada {formatClock(attendanceToday.checkInAt)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost border border-slate-800 px-2.5"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" className="btn-secondary" onClick={() => setReportOpen(true)}>
            <Printer className="h-4 w-4" />
            Planilla
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setExpenseReportOpen(true)}
          >
            <FileSpreadsheet className="h-4 w-4 text-rose-400" />
            Planilla de gastos
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCustomerTabsOpen(true)}>
            <Users className="h-4 w-4 text-violet-400" />
            Ventas por cliente
          </button>
          <button type="button" className="btn-secondary" onClick={() => setBarOpen(true)}>
            <CupSoda className="h-4 w-4 text-sky-400" />
            Venta rápida
          </button>
          <button type="button" className="btn-secondary" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 text-violet-400" />
            Traspaso QR ↔ efectivo
          </button>
          <button type="button" className="btn-secondary" onClick={() => setExpenseOpen(true)}>
            <ReceiptText className="h-4 w-4 text-amber-400" />
            Gasto
          </button>
          <button
            type="button"
            className="btn-amber"
            onClick={() => setCloseOpen(true)}
          >
            <LockKeyhole className="h-4 w-4" />
            Cerrar caja
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total V.P. + T.B. + C."
          value={formatMoney(
            shift.totals.totalWithChange ??
              Number(shift.initialCash || 0) + Number(shift.totals.grossTotal || 0),
            currency
          )}
          hint="Venta de Productos + Tiempo Billar + Cambio"
          icon={<Banknote className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Tiempo Billar"
          value={formatMoney(shift.totals.totalBilliard, currency)}
          hint={`${plural(shift.totals.playsCount, 'partida cobrada', 'partidas cobradas')}${
            Number(shift.totals.openSessionsCount || 0) > 0
              ? ` + ${plural(shift.totals.openSessionsCount || 0, 'mesa abierta', 'mesas abiertas')}`
              : ''
          }`}
          icon={<Clock3 className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Venta de Productos"
          value={formatMoney(shift.totals.totalProducts, currency)}
          hint={`Mesa ${formatMoney(shift.totals.tableProducts, currency)} · Barra ${formatMoney(
            shift.totals.barSales,
            currency
          )}`}
          icon={<ShoppingBag className="h-4 w-4" />}
          tone="violet"
        />
        <StatCard
          label="QR"
          value={formatMoney(shift.totals.totalQr, currency)}
          hint={`Neto con traspasos: ${formatMoney(shift.totals.totalQrNet ?? shift.totals.totalQr, currency)}`}
          icon={<QrCode className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Gastos de Caja"
          value={formatMoney(shift.totals.totalExpenses, currency)}
          hint={plural(shift.totals.expensesCount, 'gasto vigente', 'gastos vigentes')}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="rose"
        />
        {isAdmin && expected !== undefined ? (
          <StatCard
            label="Total Efectivo esperado"
            value={formatMoney(expected, currency)}
            hint={`Cambio ${formatMoney(shift.initialCash, currency)} + cobros − gastos ± traspasos`}
            icon={<CircleDollarSign className="h-4 w-4" />}
            tone="amber"
          />
        ) : (
          <StatCard
            label="Cambio"
            value={formatMoney(shift.initialCash, currency)}
            hint="Arqueo ciego: el esperado se revela al cerrar"
            icon={<Wallet className="h-4 w-4" />}
            tone="slate"
          />
        )}
      </div>

      {Number(shift.totals.pendingTotal || 0) > 0 ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-200/90">
          Los totales incluyen{' '}
          <strong>{formatMoney(shift.totals.pendingTotal, currency)}</strong> de consumo por cobrar
          en{' '}
          {plural(
            Number(shift.totals.openSessionsCount || 0) + Number(shift.totals.openTabsCount || 0),
            'mesa o cliente abierto',
            'mesas o clientes abiertos'
          )}
          . Ese monto todavía no está en caja, por eso no suma al efectivo esperado.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-white">Movimientos del turno</h2>
              <p className="text-[10px] text-slate-500">
                Solo el administrador puede anular; siempre con motivo registrado.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMovementTab(item.id)}
                  className={cn('chip text-[10px]', movementTab === item.id && 'chip-active')}
                >
                  {item.icon}
                  {item.label}
                  <span className="rounded bg-slate-800 px-1 py-0.5 text-[8px] text-slate-400">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="scroll-thin overflow-x-auto">
            {movementTab === 'partidas' ? (
              shift.tablePlays.length === 0 ? (
                <EmptyState
                  title="Aún no hay partidas"
                  description="Las mesas cobradas y las anuladas aparecerán aquí."
                  icon={<TableProperties className="h-6 w-6" />}
                  className="m-4"
                />
              ) : (
                <table className="data-table min-w-[760px]">
                  <thead className="table-head">
                    <tr>
                      <th>Mesa / hora</th>
                      <th>Duración</th>
                      <th>Tiempo Billar</th>
                      <th>Venta de Productos</th>
                      <th>Total</th>
                      <th>Pago</th>
                      <th>Estado</th>
                      <th className="text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shift.tablePlays].reverse().map((play) => (
                      <tr key={play.id} className={play.status === 'voided' ? 'opacity-55' : ''}>
                        <td>
                          <p className="font-semibold text-slate-200">
                            {play.tableName}
                            {play.itemNumber > 1 ? ` #${play.itemNumber}` : ''}
                          </p>
                          <p className="num text-[10px] text-slate-500">
                            {formatClock(play.startTime)} → {formatClock(play.endTime)}
                          </p>
                        </td>
                        <td className="num">{durationLabel(play.durationMinutes)}</td>
                        <td className="num">{formatMoney(play.billiardAmount, currency)}</td>
                        <td className="num">{formatMoney(play.productsAmount, currency)}</td>
                        <td className="num font-bold text-slate-100">
                          {formatMoney(play.totalAmount, currency)}
                        </td>
                        <td>{paymentChip(play.paymentMethod)}</td>
                        <td>
                          {statusBadge(play.status, 'Cobrada')}
                          {play.status === 'voided' && play.voidReason ? (
                            <p className="mt-1 max-w-[120px] truncate text-[9px] text-rose-300/70" title={play.voidReason}>
                              {play.voidReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="text-right">
                          {isAdmin && play.status === 'active' ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                              title="Anular partida"
                              onClick={() =>
                                setVoidTarget({
                                  kind: 'play',
                                  id: play.id,
                                  label: `${play.tableName} · ${formatMoney(play.totalAmount, currency)}`,
                                  amount: play.totalAmount,
                                })
                              }
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-700">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : null}

            {movementTab === 'ventas' ? (
              shift.sales.length === 0 ? (
                <EmptyState
                  title="Sin venta de productos en barra"
                  description="Usa “Venta rápida” para registrar productos sin mesa."
                  icon={<ShoppingBag className="h-6 w-6" />}
                  className="m-4"
                />
              ) : (
                <table className="data-table min-w-[720px]">
                  <thead className="table-head">
                    <tr>
                      <th>Hora / cajero</th>
                      <th>Detalle</th>
                      <th>Total</th>
                      <th>Pago</th>
                      <th>Estado</th>
                      <th className="text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shift.sales].reverse().map((sale) => (
                      <tr key={sale.id} className={sale.status === 'voided' ? 'opacity-55' : ''}>
                        <td>
                          <p className="num text-slate-200">{formatClock(sale.createdAt)}</p>
                          <p className="text-[10px] text-slate-500">{sale.createdByName}</p>
                        </td>
                        <td className="max-w-[280px] text-slate-300">
                          {sale.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                        </td>
                        <td className="num font-bold text-slate-100">
                          {formatMoney(sale.totalAmount, currency)}
                        </td>
                        <td>{paymentChip(sale.paymentMethod)}</td>
                        <td>
                          {statusBadge(sale.status)}
                          {sale.status === 'voided' && sale.voidReason ? (
                            <p className="mt-1 max-w-[120px] truncate text-[9px] text-rose-300/70" title={sale.voidReason}>
                              {sale.voidReason}
                            </p>
                          ) : null}
                        </td>
                        <td className="text-right">
                          {isAdmin && sale.status === 'active' ? (
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                              title="Anular venta"
                              onClick={() =>
                                setVoidTarget({
                                  kind: 'sale',
                                  id: sale.id,
                                  label: `Venta de ${formatMoney(sale.totalAmount, currency)}`,
                                  amount: sale.totalAmount,
                                })
                              }
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-700">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : null}

            {movementTab === 'gastos' ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3.5 py-2.5">
                  <p className="text-[10px] text-slate-500">
                    Detalle de gastos y productos comprados del turno.
                  </p>
                  <button
                    type="button"
                    className="btn-ghost border border-slate-800 px-2 py-1 text-[10px]"
                    onClick={() => setExpenseReportOpen(true)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Planilla de gastos
                  </button>
                </div>
                {shift.expenses.length === 0 ? (
                  <EmptyState
                    title="Sin gastos registrados"
                    description="Los gastos de caja reducen el efectivo esperado del turno."
                    icon={<TrendingDown className="h-6 w-6" />}
                    className="m-4"
                  />
                ) : (
                  <table className="data-table min-w-[620px]">
                    <thead className="table-head">
                      <tr>
                        <th>Hora / cajero</th>
                        <th>Concepto y productos</th>
                        <th>Categoría</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th className="text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...shift.expenses].reverse().map((expense) => (
                        <tr key={expense.id} className={expense.status === 'voided' ? 'opacity-55' : ''}>
                          <td>
                            <p className="num text-slate-200">{formatClock(expense.createdAt)}</p>
                            <p className="text-[10px] text-slate-500">{expense.createdByName}</p>
                          </td>
                          <td>
                            <p className="font-medium text-slate-200">{expense.concept}</p>
                            {expense.items.length > 0 ? (
                              <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">
                                {expense.items
                                  .map((item) => `${item.quantity}× ${item.name}`)
                                  .join(' · ')}
                              </p>
                            ) : null}
                          </td>
                          <td className="text-slate-400">
                            {expenseCategoryLabel(expense.category as ExpenseCategory)}
                          </td>
                          <td className="num font-bold text-rose-300">
                            {formatMoney(expense.amount, currency)}
                          </td>
                          <td>
                            {expense.status === 'voided' ? statusBadge('voided') : statusBadge('active', 'Vigente')}
                            {expense.status === 'voided' && expense.voidReason ? (
                              <p className="mt-1 max-w-[120px] truncate text-[9px] text-rose-300/70" title={expense.voidReason}>
                                {expense.voidReason}
                              </p>
                            ) : null}
                          </td>
                          <td className="text-right">
                            {isAdmin && expense.status === 'active' ? (
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                                title="Anular gasto"
                                onClick={() =>
                                  setVoidTarget({
                                    kind: 'expense',
                                    id: expense.id,
                                    label: `Gasto: ${expense.concept}`,
                                    amount: expense.amount,
                                  })
                                }
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-700">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}

            {movementTab === 'traspasos' ? (
              (shift.cashTransfers ?? []).length === 0 ? (
                <EmptyState
                  title="Sin traspasos QR ↔ efectivo"
                  description="Registra los intercambios de efectivo por QR y de QR por efectivo del turno."
                  icon={<ArrowLeftRight className="h-6 w-6" />}
                  className="m-4"
                  action={
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setTransferOpen(true)}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Registrar traspaso
                    </button>
                  }
                />
              ) : (
                <table className="data-table min-w-[760px]">
                  <thead className="table-head">
                    <tr>
                      <th>Hora / registró</th>
                      <th>Movimiento</th>
                      <th>Concepto</th>
                      <th>Referencia</th>
                      <th>Efecto en caja</th>
                      <th>Estado</th>
                      <th className="text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shift.cashTransfers].reverse().map((transfer) => {
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
                            {statusBadge(transfer.status, 'Vigente', 'Anulado')}
                            {transfer.status === 'voided' && transfer.voidReason ? (
                              <p
                                className="mt-1 max-w-[120px] truncate text-[9px] text-rose-300/70"
                                title={transfer.voidReason}
                              >
                                {transfer.voidReason}
                              </p>
                            ) : null}
                          </td>
                          <td className="text-right">
                            {isAdmin && transfer.status === 'active' ? (
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 text-slate-500 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                                title="Anular traspaso"
                                onClick={() =>
                                  setVoidTarget({
                                    kind: 'transfer',
                                    id: transfer.id,
                                    label: `Traspaso: ${transfer.concept}`,
                                    amount: transfer.amount,
                                  })
                                }
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-700">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : null}

            {movementTab === 'qr' ? (
              shift.qrPayments.length === 0 ? (
                <EmptyState
                  title="Sin pagos por QR"
                  description="Los cobros con QR de mesas y barra aparecerán aquí."
                  icon={<QrCode className="h-6 w-6" />}
                  className="m-4"
                />
              ) : (
                <table className="data-table min-w-[560px]">
                  <thead className="table-head">
                    <tr>
                      <th>Hora</th>
                      <th>Origen</th>
                      <th>Detalle</th>
                      <th>Referencia</th>
                      <th>Registró</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...shift.qrPayments].reverse().map((payment) => (
                      <tr key={payment.id}>
                        <td className="num text-slate-300">{formatClock(payment.timestamp)}</td>
                        <td>
                          <span
                            className={cn(
                              'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                              payment.source === 'mesa'
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                : 'border-sky-500/25 bg-sky-500/10 text-sky-300'
                            )}
                          >
                            {payment.source === 'mesa' ? 'Mesa' : 'Barra'}
                          </span>
                        </td>
                        <td className="max-w-[220px] truncate text-slate-300">{payment.description}</td>
                        <td className="max-w-[120px] truncate text-slate-500">
                          {payment.reference || '—'}
                        </td>
                        <td className="text-slate-400">{payment.userName}</td>
                        <td className="num text-right font-bold text-sky-300">
                          {formatMoney(payment.amount, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] text-slate-500">
            <span>
              {plural(activePlays.length, 'partida cobrada', 'partidas cobradas')} ·{' '}
              {plural(activeSales.length, 'venta vigente', 'ventas vigentes')} ·{' '}
              {plural(activeExpenses.length, 'gasto vigente', 'gastos vigentes')} ·{' '}
              {plural((shift.cashTransfers ?? []).length, 'traspaso', 'traspasos')}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
              Anulaciones y cambios quedan en auditoría
            </span>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-[7.75rem] xl:self-start">
          <div className="panel overflow-hidden">
            <div className="border-b border-slate-800/80 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
                  <LockKeyhole className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Cierre de caja</h2>
                  <p className="text-[10px] text-slate-500">Arqueo y bloqueo del turno</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-4 py-4">
              {openTables.length > 0 ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-rose-200">
                  <p className="font-bold">
                    {plural(openTables.length, 'mesa abierta', 'mesas abiertas')}
                  </p>
                  <p className="mt-0.5 text-rose-300/80">
                    {openTables.map((table) => table.name).join(', ')}. Cóbralas o anúlalas antes
                    de cerrar.
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 hover:text-rose-200"
                    onClick={() => setTab('mesas')}
                  >
                    Ir al panel de mesas
                    <History className="h-3 w-3 rotate-180" />
                  </button>
                </div>
              ) : null}

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cambio</span>
                  <span className="num text-slate-300">{formatMoney(shift.initialCash, currency)}</span>
                </div>
                {isAdmin && cashCollected !== undefined ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Efectivo cobrado</span>
                    <span className="num text-slate-300">{formatMoney(cashCollected, currency)}</span>
                  </div>
                ) : null}
                {Number(shift.totals.pendingTotal || 0) > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Consumo por cobrar</span>
                    <span className="num text-amber-300">
                      {formatMoney(shift.totals.pendingTotal, currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500">Gastos de Caja</span>
                  <span className="num text-rose-300">−{formatMoney(shift.totals.totalExpenses, currency)}</span>
                </div>
                {(shift.totals.transfersCount ?? 0) > 0 ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Traspasos a caja</span>
                      <span className="num text-emerald-300">
                        +{formatMoney(shift.totals.cashTransfersIn ?? 0, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Traspasos desde caja</span>
                      <span className="num text-amber-300">
                        −{formatMoney(shift.totals.cashTransfersOut ?? 0, currency)}
                      </span>
                    </div>
                  </>
                ) : null}
                {isAdmin && expected !== undefined ? (
                  <div className="flex items-end justify-between border-t border-slate-800 pt-2">
                    <span className="text-xs font-bold text-slate-200">Total Efectivo esperado</span>
                    <span className="num text-lg font-black text-emerald-300">
                      {formatMoney(expected, currency)}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-[#08111d] px-2.5 py-2 text-[10px] leading-relaxed text-slate-500">
                    <ShieldCheck className="mr-1 inline h-3 w-3 text-sky-400/80" />
                    Arqueo ciego: el esperado se calcula al cerrar y lo revisa el administrador.
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-amber w-full"
                onClick={() => setCloseOpen(true)}
                disabled={openTables.length > 0}
              >
                <LockKeyhole className="h-4 w-4" />
                Cerrar caja
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setReportOpen(true)}
              >
                <Printer className="h-4 w-4" />
                Imprimir planilla
              </button>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-white">
                  Tiempo Billar y Venta de Productos por mesa
                </h2>
              </div>
              <span className="num text-[10px] text-slate-500">
                {formatMoney(shift.totals.totalBilliard + shift.totals.tableProducts, currency)}
              </span>
            </div>

            {shift.tableSummary.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-500">
                No hay movimientos de mesas.
              </p>
            ) : (
              <div className="scroll-thin max-h-72 overflow-y-auto">
                <table className="data-table">
                  <thead className="table-head">
                    <tr>
                      <th>Mesa</th>
                      <th className="text-center">Partidas</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shift.tableSummary.map((row) => (
                      <tr key={row.tableId}>
                        <td className="font-medium text-slate-200">{row.tableName}</td>
                        <td className="num text-center">
                          {row.playsCount}
                          {Number(row.openCount || 0) > 0 ? (
                            <span className="ml-1 text-[9px] text-slate-500">+{row.openCount}</span>
                          ) : null}
                        </td>
                        <td className="num text-right font-semibold text-slate-200">
                          {formatMoney(row.total, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800/70 bg-[#08111d]/60 px-3.5 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
              Control del turno
            </p>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Turno abierto {formatShiftRange(shift)}. Los turnos cerrados no se pueden editar y
              cada anulación conserva responsable, hora y motivo.
            </p>
          </div>
        </aside>
      </div>

      <ExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />
      <BarSaleModal open={barOpen} onClose={() => setBarOpen(false)} />
      <CustomerTabsModal open={customerTabsOpen} onClose={() => setCustomerTabsOpen(false)} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
      <CloseShiftModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onShiftClosed={onShiftClosed}
      />
      <ShiftReportModal open={reportOpen} shift={shift} onClose={() => setReportOpen(false)} />
      <ExpenseReportModal
        open={expenseReportOpen}
        shift={shift}
        onClose={() => setExpenseReportOpen(false)}
      />
      <ReasonDialog
        open={Boolean(voidTarget)}
        title={voidTitle}
        description={
          voidTarget ? (
            <span>
              Se anulará <strong className="text-slate-200">{voidTarget.label}</strong> por{' '}
              {formatMoney(voidTarget.amount, currency)}.{' '}
              {voidTarget.kind === 'transfer'
                ? 'El traspaso dejará de ajustar el efectivo esperado del cierre, pero quedará registrado en la auditoría.'
                : 'La venta dejará de contar en los totales, pero quedará registrada en la auditoría.'}
            </span>
          ) : null
        }
        confirmLabel="Anular movimiento"
        placeholder="Explica el motivo de la anulación…"
        busy={voidBusy}
        onCancel={() => setVoidTarget(null)}
        onConfirm={confirmVoid}
      />
    </div>
  );
};
