import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CircleDollarSign,
  CupSoda,
  History,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TableProperties,
  Wallet,
} from 'lucide-react';
import type { PaymentMethod } from '../types';
import { useApp } from '../context/AppContext';
import {
  cn,
  durationLabel,
  formatClock,
  formatMoney,
  paymentLabel,
  plural,
} from '../lib/format';
import { playToReceipt, saleToReceipt } from '../lib/receipt';
import { EmptyState } from './ui/EmptyState';
import { StatCard } from './ui/StatCard';

type PaymentFilter = 'todo' | 'efectivo' | 'qr' | 'mixto';

interface Movement {
  key: string;
  kind: 'mesa' | 'barra';
  time: string;
  title: string;
  subtitle: string;
  detail: string;
  total: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  qrAmount: number;
  status: 'active' | 'voided';
  userName: string;
  playId?: number;
  saleId?: number;
}

const paymentChip = (method: PaymentMethod) => {
  const tone =
    method === 'qr'
      ? 'border-sky-500/25 bg-sky-500/10 text-sky-300'
      : method === 'mixto'
      ? 'border-violet-500/25 bg-violet-500/10 text-violet-300'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
  return (
    <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold', tone)}>
      {paymentLabel(method)}
    </span>
  );
};

const statusBadge = (status: 'active' | 'voided', activeLabel = 'Vigente') =>
  status === 'voided' ? (
    <span className="inline-flex rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
      Anulada
    </span>
  ) : (
    <span className="inline-flex rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
      {activeLabel}
    </span>
  );

export const CashierSalesView: React.FC = () => {
  const { currentShift, settings, refresh, showReceipt } = useApp();
  const [filter, setFilter] = useState<PaymentFilter>('todo');
  const [refreshing, setRefreshing] = useState(false);
  const currency = settings?.currency || 'Bs';

  const plays = currentShift?.tablePlays ?? [];
  const sales = currentShift?.sales ?? [];

  const movements = useMemo<Movement[]>(() => {
    const list: Movement[] = [];

    for (const play of plays) {
      const typeNote =
        play.playerType === 'staff'
          ? ' · Encargados (sin cobro)'
          : play.playerType === 'mixed'
          ? ' · 50% mesa'
          : '';
      list.push({
        key: `play-${play.id}`,
        kind: 'mesa',
        time: play.endTime || play.startTime,
        title: `${play.tableName}${play.itemNumber > 1 ? ` #${play.itemNumber}` : ''}`,
        subtitle: `${formatClock(play.startTime)} → ${formatClock(play.endTime)} · ${durationLabel(
          play.durationMinutes
        )}${typeNote}`,
        detail: play.items.length
          ? play.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')
          : 'Sin consumo',
        total: Number(play.totalAmount || 0),
        paymentMethod: play.paymentMethod,
        cashAmount: Number(play.cashAmount || 0),
        qrAmount: Number(play.qrAmount || 0),
        status: play.status,
        userName: play.closedByName,
        playId: play.id,
      });
    }

    for (const sale of sales) {
      const customerName = sale.customerName?.trim();
      list.push({
        key: `sale-${sale.id}`,
        kind: 'barra',
        time: sale.createdAt,
        title: customerName ? `Cliente: ${customerName}` : 'Venta rápida',
        subtitle: customerName
          ? `Venta por cliente · ${sale.createdByName}`
          : `Barra · ${sale.createdByName}`,
        detail: sale.items.length
          ? sale.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')
          : 'Venta de barra',
        total: Number(sale.totalAmount || 0),
        paymentMethod: sale.paymentMethod,
        cashAmount: Number(sale.cashAmount || 0),
        qrAmount: Number(sale.qrAmount || 0),
        status: sale.status,
        userName: sale.createdByName,
        saleId: sale.id,
      });
    }

    return list.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }, [plays, sales]);

  const activeMovements = useMemo(
    () => movements.filter((movement) => movement.status === 'active'),
    [movements]
  );

  const totals = useMemo(() => {
    const activePlays = plays.filter((play) => play.status === 'active');
    const activeSales = sales.filter((sale) => sale.status === 'active');
    const totalBilliard = activePlays.reduce(
      (sum, play) => sum + Number(play.billiardAmount || 0),
      0
    );
    const tableProducts = activePlays.reduce(
      (sum, play) => sum + Number(play.productsAmount || 0),
      0
    );
    const barSales = activeSales.reduce(
      (sum, sale) => sum + Number(sale.totalAmount || 0),
      0
    );
    const cashCollected = activeMovements.reduce(
      (sum, movement) => sum + movement.cashAmount,
      0
    );
    const totalQr = activeMovements.reduce(
      (sum, movement) => sum + movement.qrAmount,
      0
    );

    return {
      totalBilliard,
      tableProducts,
      barSales,
      grossTotal: totalBilliard + tableProducts + barSales,
      cashCollected,
      totalQr,
      playsCount: activePlays.length,
      salesCount: activeSales.length,
      cashCount: activeMovements.filter((movement) => movement.cashAmount > 0).length,
      qrCount: activeMovements.filter((movement) => movement.qrAmount > 0).length,
    };
  }, [activeMovements, plays, sales]);

  const tableRows = useMemo(() => {
    const map = new Map<
      number,
      {
        tableId: number;
        tableNumber: number;
        tableName: string;
        playsCount: number;
        billiard: number;
        products: number;
        total: number;
      }
    >();

    for (const play of plays) {
      if (play.status !== 'active') continue;
      const current = map.get(play.tableId) || {
        tableId: play.tableId,
        tableNumber: play.tableNumber,
        tableName: play.tableName,
        playsCount: 0,
        billiard: 0,
        products: 0,
        total: 0,
      };
      current.playsCount += 1;
      current.billiard += Number(play.billiardAmount || 0);
      current.products += Number(play.productsAmount || 0);
      current.total = current.billiard + current.products;
      map.set(play.tableId, current);
    }

    return [...map.values()].sort((a, b) => a.tableNumber - b.tableNumber);
  }, [plays]);

  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (filter === 'todo') return true;
        if (filter === 'efectivo') return movement.cashAmount > 0;
        if (filter === 'qr') return movement.qrAmount > 0;
        return movement.paymentMethod === 'mixto';
      }),
    [filter, movements]
  );

  const filters: Array<{ id: PaymentFilter; label: string; count: number }> = [
    { id: 'todo', label: 'Todo', count: movements.length },
    {
      id: 'efectivo',
      label: 'Efectivo',
      count: movements.filter((movement) => movement.cashAmount > 0).length,
    },
    {
      id: 'qr',
      label: 'QR',
      count: movements.filter((movement) => movement.qrAmount > 0).length,
    },
    {
      id: 'mixto',
      label: 'Mixto',
      count: movements.filter((movement) => movement.paymentMethod === 'mixto').length,
    },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReprint = (movement: Movement) => {
    if (!settings || movement.status !== 'active') return;

    if (movement.kind === 'mesa' && movement.playId !== undefined) {
      const play = plays.find((item) => item.id === movement.playId);
      if (play) showReceipt({ ...playToReceipt(play, settings), reprint: true });
      return;
    }

    if (movement.kind === 'barra' && movement.saleId !== undefined) {
      const sale = sales.find((item) => item.id === movement.saleId);
      if (sale) showReceipt({ ...saleToReceipt(sale, settings), reprint: true });
    }
  };

  if (!currentShift) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Ventas del turno
            </h1>
            <span className="rounded-md border border-slate-800 bg-[#0b1422] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Turno #{currentShift.id}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Historial de mesas cobradas y ventas rápidas, con el desglose de efectivo y QR para
            respaldar tu caja. Puedes reimprimir el comprobante de cualquier venta vigente.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost border border-slate-800 px-2.5"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Actualizar ventas del turno"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <StatCard
          label="Venta de Productos + Tiempo Billar"
          value={formatMoney(totals.grossTotal, currency)}
          hint={`${plural(totals.playsCount, 'partida', 'partidas')} · ${plural(
            totals.salesCount,
            'venta rápida',
            'ventas rápidas'
          )}`}
          icon={<Wallet className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Efectivo cobrado"
          value={formatMoney(totals.cashCollected, currency)}
          hint={`${plural(totals.cashCount, 'cobro', 'cobros')} en efectivo`}
          icon={<Banknote className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="QR"
          value={formatMoney(totals.totalQr, currency)}
          hint={`${plural(totals.qrCount, 'cobro', 'cobros')} con QR`}
          icon={<QrCode className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Cambio"
          value={formatMoney(currentShift.initialCash, currency)}
          hint="Monto fijo del turno"
          icon={<CircleDollarSign className="h-4 w-4" />}
          tone="slate"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <div>
              <h2 className="text-sm font-bold text-white">Desglose de pagos</h2>
              <p className="text-[10px] text-slate-500">
                Solo suman los movimientos vigentes. Las ventas anuladas aparecen en gris.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 p-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label mb-1">Efectivo</p>
                <p className="num text-xl font-black text-emerald-300">
                  {formatMoney(totals.cashCollected, currency)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {plural(totals.cashCount, 'cobro', 'cobros')} para contar en la gaveta
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <Banknote className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label mb-1">QR</p>
                <p className="num text-xl font-black text-sky-300">
                  {formatMoney(totals.totalQr, currency)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {plural(totals.qrCount, 'cobro', 'cobros')} por transferencia QR
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-400">
                <QrCode className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">Historial de ventas</h2>
            <p className="text-[10px] text-slate-500">
              Mesas cobradas y ventas rápidas de barra, de la más reciente a la más antigua.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('chip', filter === item.id && 'chip-active')}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span className="rounded bg-slate-800 px-1 py-0.5 text-[8px] text-slate-400">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {movements.length === 0 ? (
          <EmptyState
            title="Aún no hay ventas en este turno"
            description="Cuando cobres una mesa o registres una venta rápida, aparecerá aquí con su forma de pago."
            icon={<ShoppingBag className="h-6 w-6" />}
            className="m-4"
          />
        ) : filteredMovements.length === 0 ? (
          <EmptyState
            title="Sin movimientos para este filtro"
            description="Prueba con “Todo” para ver el historial completo del turno."
            icon={<History className="h-6 w-6" />}
            className="m-4"
          />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="data-table min-w-[1020px]">
              <thead className="table-head">
                <tr>
                  <th>Hora</th>
                  <th>Origen</th>
                  <th>Detalle</th>
                  <th>Pago</th>
                  <th className="text-right">Efectivo</th>
                  <th className="text-right">QR</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                  <th className="text-right">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr
                    key={movement.key}
                    className={movement.status === 'voided' ? 'opacity-55' : ''}
                  >
                    <td className="num text-slate-300">{formatClock(movement.time)}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {movement.kind === 'mesa' ? (
                          <TableProperties className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <CupSoda className="h-3.5 w-3.5 text-sky-400" />
                        )}
                        <span className="font-semibold text-slate-200">{movement.title}</span>
                      </div>
                      <p className="mt-0.5 text-[9px] text-slate-500">{movement.subtitle}</p>
                    </td>
                    <td className="max-w-[260px] text-slate-300">
                      <p className="truncate" title={movement.detail}>
                        {movement.detail}
                      </p>
                    </td>
                    <td>{paymentChip(movement.paymentMethod)}</td>
                    <td className="num text-right">
                      {movement.cashAmount > 0 ? (
                        <span className="font-semibold text-emerald-300">
                          {formatMoney(movement.cashAmount, currency)}
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                    <td className="num text-right">
                      {movement.qrAmount > 0 ? (
                        <span className="font-semibold text-sky-300">
                          {formatMoney(movement.qrAmount, currency)}
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                    <td className="num text-right font-bold text-slate-100">
                      {formatMoney(movement.total, currency)}
                    </td>
                    <td>{statusBadge(movement.status, movement.kind === 'mesa' ? 'Cobrada' : 'Vigente')}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-[10px]"
                        onClick={() => handleReprint(movement)}
                        disabled={movement.status !== 'active' || !settings}
                        title={
                          movement.status === 'voided'
                            ? 'Las ventas anuladas no se reimprimen'
                            : 'Reimprimir comprobante'
                        }
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Reimprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] text-slate-500">
          {plural(movements.length, 'movimiento registrado', 'movimientos registrados')} en este
          turno · {plural(totals.cashCount, 'cobro', 'cobros')} en efectivo ·{' '}
          {plural(totals.qrCount, 'cobro', 'cobros')} por QR
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <TableProperties className="h-4 w-4 text-slate-500" />
            <div>
              <h2 className="text-sm font-bold text-white">
                Tiempo Billar y Venta de Productos por mesa
              </h2>
              <p className="text-[10px] text-slate-500">
                Tiempo Billar y Venta de Productos de las mesas cobradas en este turno.
              </p>
            </div>
          </div>
          <span className="num text-[10px] text-slate-500">
            {formatMoney(totals.totalBilliard + totals.tableProducts, currency)}
          </span>
        </div>

        {tableRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11px] text-slate-500">
            No hay mesas cobradas en este turno.
          </p>
        ) : (
          <div className="scroll-thin max-h-72 overflow-y-auto">
            <table className="data-table min-w-[560px]">
              <thead className="table-head">
                <tr>
                  <th>Mesa</th>
                  <th className="text-center">Partidas</th>
                  <th className="text-right">Tiempo Billar</th>
                  <th className="text-right">Venta de Productos</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.tableId}>
                    <td className="font-medium text-slate-200">{row.tableName}</td>
                    <td className="num text-center">{row.playsCount}</td>
                    <td className="num text-right">{formatMoney(row.billiard, currency)}</td>
                    <td className="num text-right">{formatMoney(row.products, currency)}</td>
                    <td className="num text-right font-semibold text-slate-200">
                      {formatMoney(row.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-sky-200/90">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Arqueo ciego:</strong> este historial te sirve para respaldar tus cobros, pero no
          muestra el efectivo esperado ni la diferencia final de la caja. Esos datos los revisa el
          administrador al cerrar el turno.
        </span>
      </div>
    </div>
  );
};
