import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Clock3,
  CupSoda,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  TableProperties,
  Users,
  Wallet,
} from 'lucide-react';
import type { Table, TablePlayerType } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { calculateActiveSession, cn, effectiveBilliardAmount, formatClock, formatMoney, plural, tablePlayerTypeLabel } from '../lib/format';
import { tableColorStyle } from '../lib/tableColors';
import { useNow } from '../lib/useNow';
import { StatCard } from './ui/StatCard';
import { TableCard } from './TableCard';
import { OrderPanel } from './OrderPanel';
import { CheckoutModal } from './CheckoutModal';
import { BarSaleModal } from './BarSaleModal';
import { CustomerTabsModal } from './CustomerTabsModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { EmptyState } from './ui/EmptyState';

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const TablesView: React.FC = () => {
  const {
    tables,
    settings,
    currentShift,
    clockOffset,
    runAction,
    refresh,
    user,
  } = useApp();
  const now = useNow(clockOffset);
  const isAdmin = user?.role === 'admin';
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checkoutId, setCheckoutId] = useState<number | null>(null);
  const [barOpen, setBarOpen] = useState(false);
  const [customerTabsOpen, setCustomerTabsOpen] = useState(false);
  const [pendingTable, setPendingTable] = useState<Table | null>(null);
  const [startPlayerType, setStartPlayerType] = useState<TablePlayerType>('normal');
  const [startBusy, setStartBusy] = useState<number | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currency = settings?.currency || 'Bs';
  const minimumCharge = Number(settings?.minimumPlayCharge || 0);
  const activeTables = useMemo(() => tables.filter((table) => table.active), [tables]);
  const occupiedTables = activeTables.filter((table) => table.status === 'occupied');

  const selectedTable = selectedId
    ? tables.find((table) => table.id === selectedId) ?? null
    : null;
  const checkoutTable = checkoutId
    ? tables.find((table) => table.id === checkoutId) ?? null
    : null;

  const inProgress = round2(
    activeTables.reduce((sum, table) => {
      if (!table.activeSession) return sum;
      const calc = calculateActiveSession(table.activeSession, minimumCharge, now);
      const billiard = effectiveBilliardAmount(calc.cost, table.activeSession.playerType);
      return (
        sum +
        billiard +
        table.activeSession.items.reduce(
          (itemSum, item) => itemSum + Number(item.price) * Number(item.quantity),
          0
        )
      );
    }, 0)
  );

  const startTable = async (table: Table) => {
    if (startBusy) return;
    setStartBusy(table.id);
    try {
      const response = await runAction(() => api.startTable(table.id, startPlayerType));
      if (response) {
        setPendingTable(null);
        setStartPlayerType('normal');
        setSelectedId(table.id);
      }
    } finally {
      setStartBusy(null);
    }
  };

  const handleTableSelect = (table: Table) => {
    if (table.status === 'occupied') {
      setSelectedId(table.id);
    } else {
      setStartPlayerType('normal');
      setPendingTable(table);
    }
  };

  const openCheckout = async (table: Table) => {
    if (checkoutBusy || !table.activeSession) return;
    setCheckoutBusy(true);
    try {
      const response = await runAction(() => api.startCheckout(table.id));
      if (response) setCheckoutId(table.id);
    } finally {
      setCheckoutBusy(false);
    }
  };

  const closeCheckout = async () => {
    if (!checkoutTable) {
      setCheckoutId(null);
      return;
    }
    const tableId = checkoutTable.id;
    setCheckoutBusy(true);
    try {
      await runAction(() => api.cancelCheckout(tableId));
    } finally {
      setCheckoutBusy(false);
      setCheckoutId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh(false);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Panel de mesas</h1>
            <span className="hidden rounded-md border border-slate-800 bg-[#0b1422] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:inline">
              Turno #{currentShift?.id}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Toca una mesa libre para iniciar el cronómetro; te pediremos confirmación. Las mesas
            ocupadas abren el pedido directamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost border border-slate-800 px-2.5"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar datos"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCustomerTabsOpen(true)}>
            <Users className="h-4 w-4 text-violet-400" />
            Ventas por cliente
          </button>
          <button type="button" className="btn-secondary" onClick={() => setBarOpen(true)}>
            <CupSoda className="h-4 w-4 text-sky-400" />
            Venta rápida
          </button>
        </div>
      </div>

      <div className={cn('grid grid-cols-2 gap-2.5', isAdmin && 'lg:grid-cols-4')}>
        <StatCard
          label="Mesas libres"
          value={activeTables.length - occupiedTables.length}
          hint={`${activeTables.length} mesas activas`}
          icon={<LayoutGrid className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Mesas ocupadas"
          value={occupiedTables.length}
          hint={
            occupiedTables.length > 0
              ? occupiedTables.map((table) => table.name).slice(0, 3).join(', ')
              : 'Todas disponibles'
          }
          icon={<TableProperties className="h-4 w-4" />}
          tone="rose"
        />
        {isAdmin ? (
          <>
            <StatCard
              label="En mesas ahora"
              value={formatMoney(inProgress, currency)}
              hint="Billar + consumo en curso"
              icon={<Clock3 className="h-4 w-4" />}
              tone="sky"
            />
            <StatCard
              label="Ventas del turno"
              value={formatMoney(currentShift?.totals.grossTotal, currency)}
              hint={`QR ${formatMoney(currentShift?.totals.totalQr, currency)}`}
              icon={<Wallet className="h-4 w-4" />}
              tone="amber"
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          {activeTables.length === 0 ? (
            <EmptyState
              title="No hay mesas activas"
              description="El administrador puede crear mesas desde Ajustes → Mesas."
              icon={<LayoutGrid className="h-7 w-7" />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {activeTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  nowMs={now}
                  currency={currency}
                  minimumCharge={minimumCharge}
                  busy={startBusy === table.id}
                  onSelect={handleTableSelect}
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800/70 bg-[#08111d]/60 px-3 py-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Caja abierta desde {formatClock(currentShift?.openedAt)} · {currentShift?.openedByName}
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <Users className="h-3.5 w-3.5" />
              {plural(occupiedTables.length, 'mesa', 'mesas')} en curso
            </span>
          </div>
        </section>

        <aside className="xl:sticky xl:top-[7.75rem] xl:self-start">
          {selectedTable ? (
            <OrderPanel
              table={selectedTable}
              onClose={() => setSelectedId(null)}
              onCheckout={openCheckout}
              checkoutBusy={checkoutBusy}
            />
          ) : (
            <div className="panel overflow-hidden">
              <div className="border-b border-slate-800/80 px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Pedido de mesa</h2>
                    <p className="text-[10px] text-slate-500">Selecciona una mesa para comenzar</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4">
                {occupiedTables.length > 0 ? (
                  <>
                    <p className="label">Mesas en curso</p>
                    <div className="space-y-1.5">
                      {occupiedTables.map((table) => {
                        const session = table.activeSession!;
                        const calculation = calculateActiveSession(session, minimumCharge, now);
                        const billiard = effectiveBilliardAmount(calculation.cost, session.playerType);
                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => setSelectedId(table.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/[0.04]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="table-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black"
                                style={tableColorStyle(table.color)}
                              >
                                {table.number}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-bold text-slate-200">
                                  {table.name}
                                  {session.playerType !== 'normal' ? (
                                    <span className="ml-1.5 rounded bg-violet-500/15 px-1 py-0.5 text-[9px] font-bold text-violet-300">
                                      {session.playerType === 'staff' ? 'Encargados' : '50%'}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="num text-[10px] text-slate-500">
                                  {calculation.timer} · {session.openedByName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="num text-[11px] font-semibold text-emerald-300">
                                {formatMoney(
                                  billiard +
                                    session.items.reduce(
                                      (sum, item) => sum + Number(item.price) * Number(item.quantity),
                                      0
                                    ),
                                  currency
                                )}
                              </span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-slate-600" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Todas las mesas están libres"
                    description="Cuando inicies una mesa, aquí verás el pedido y podrás agregar consumos."
                    icon={<TableProperties className="h-6 w-6" />}
                  />
                )}
              </div>

              {isAdmin ? (
                <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-3">
                  <p className="label">Resumen rápido del turno</p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Billar</span>
                      <span className="num text-slate-300">
                        {formatMoney(currentShift?.totals.totalBilliard, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Productos</span>
                      <span className="num text-slate-300">
                        {formatMoney(currentShift?.totals.totalProducts, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cobrado por QR</span>
                      <span className="num text-sky-300">
                        {formatMoney(currentShift?.totals.totalQr, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      <CheckoutModal
        open={Boolean(checkoutTable?.activeSession)}
        mode="table"
        table={checkoutTable}
        items={checkoutTable?.activeSession?.items ?? []}
        onClose={closeCheckout}
        onCancel={closeCheckout}
        onSuccess={() => {
          setCheckoutId(null);
          setSelectedId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingTable)}
        title={`¿Abrir ${pendingTable?.name || 'esta mesa'}?`}
        message={
          <div className="space-y-3">
            <p>
              Se iniciará el cronómetro de{' '}
              <strong className="text-slate-100">{pendingTable?.name}</strong> con una tarifa de{' '}
              <strong className="num text-slate-100">
                {formatMoney(pendingTable?.ratePerHour ?? settings?.defaultRatePerHour, currency)}/hora
              </strong>
              {minimumCharge > 0 ? (
                <>
                  {' '}y un cobro mínimo de{' '}
                  <strong className="num text-slate-100">{formatMoney(minimumCharge, currency)}</strong>
                </>
              ) : null}
              .
            </p>
            <div>
              <p className="label mb-1.5">Tipo de jugadores</p>
              <div className="space-y-1.5">
                {([
                  { id: 'normal', label: 'Clientes normales', hint: 'Se cobra la mesa normal' },
                  { id: 'staff', label: 'Solo encargados', hint: 'No se cobra la mesa (se registra igual)' },
                  { id: 'mixed', label: 'Encargado + cliente', hint: 'Se registra la mesa con 50% de descuento en billar' },
                ] as Array<{ id: TablePlayerType; label: string; hint: string }>).map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition',
                      startPlayerType === option.id
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-slate-800 bg-[#08111d] hover:border-slate-700'
                    )}
                  >
                    <input
                      type="radio"
                      name="player-type"
                      className="mt-0.5"
                      checked={startPlayerType === option.id}
                      onChange={() => setStartPlayerType(option.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-200">{option.label}</span>
                      <span className="block text-[10px] text-slate-500">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Si la tocaste por accidente, cancela. No se iniciará ningún cobro.
            </p>
          </div>
        }
        confirmLabel="Sí, iniciar mesa"
        cancelLabel="No, volver"
        busy={Boolean(startBusy)}
        tone="primary"
        onCancel={() => {
          setPendingTable(null);
          setStartPlayerType('normal');
        }}
        onConfirm={() => {
          if (pendingTable) startTable(pendingTable);
        }}
      />

      <BarSaleModal open={barOpen} onClose={() => setBarOpen(false)} />
      <CustomerTabsModal open={customerTabsOpen} onClose={() => setCustomerTabsOpen(false)} />
    </div>
  );
};
