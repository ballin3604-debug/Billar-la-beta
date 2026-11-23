import React from 'react';
import type { ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import {
  durationLabel,
  expenseCategoryLabel,
  formatClock,
  formatDateShort,
  formatDateTime,
  formatMoney,
  formatShiftRange,
  paymentLabel,
  plural,
  transferCashEffectLabel,
  transferDirectionLabel,
} from '../lib/format';
import { Modal } from './ui/Modal';
import { Printer } from 'lucide-react';

interface ShiftReportProps {
  shift: ShiftDetail;
}

const thClass =
  'border border-slate-300 bg-slate-100 px-2 py-1.5 text-left font-bold whitespace-nowrap';
const tdClass = 'border border-slate-300 px-2 py-1.5 align-top';
const tdNowrapClass = `${tdClass} whitespace-nowrap`;

const attendanceDuration = (checkInAt: string, checkOutAt: string) => {
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  return durationLabel(Math.round((end - start) / 60000));
};

export const ShiftReport: React.FC<ShiftReportProps> = ({ shift }) => {
  const { settings } = useApp();
  const currency = settings?.currency || 'Bs';
  const closing = shift.closing;
  const expected = closing?.expectedCash ?? shift.totals.expectedCash;
  const counted = closing?.countedCash ?? null;
  const difference = closing?.difference ?? null;
  const pendingTotal = Number(shift.totals.pendingTotal || 0);
  const transfersIn = Number(shift.totals.cashTransfersIn || 0);
  const transfersOut = Number(shift.totals.cashTransfersOut || 0);
  const totalWithChange =
    shift.totals.totalWithChange ??
    Number(shift.initialCash || 0) + Number(shift.totals.grossTotal || 0);
  const openSessions = shift.openSessions ?? [];
  const openTabs = shift.openCustomerTabs ?? [];
  const outOfRange = shift.outOfRange ?? null;
  const cashInDrawer = counted !== null ? counted : expected ?? null;

  return (
    <div className="bg-white p-5 text-[11px] leading-relaxed text-slate-900 sm:p-7">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {settings?.businessName || 'Billar Bar la Beta'}
          </p>
          <h1 className="mt-0.5 text-lg font-black uppercase tracking-tight">Planilla de control de caja</h1>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {formatShiftRange(shift)} · Turno #{shift.id}
          </p>
        </div>
        <div className="text-right text-[10px]">
          <p className="inline-block rounded border border-slate-400 px-2 py-0.5 font-bold uppercase">
            {shift.status === 'closed' ? 'Turno cerrado' : 'Turno abierto'}
          </p>
          <p className="mt-1 text-slate-500">Impreso: {formatDateTime(new Date())}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] sm:grid-cols-4">
        <div>
          <p className="font-bold uppercase tracking-wider text-slate-500">Encargado apertura</p>
          <p>{shift.openedByName}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-slate-500">Encargado cierre</p>
          <p>{shift.closedByName || '—'}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-slate-500">Apertura</p>
          <p>{formatDateTime(shift.openedAt)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-slate-500">Cierre</p>
          <p>{formatDateTime(shift.closedAt)}</p>
        </div>
      </div>

      {shift.attendance.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">
            Entrada y salida del personal
          </h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Personal</th>
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Entrada</th>
                <th className={thClass}>Salida</th>
                <th className={thClass}>Duración</th>
              </tr>
            </thead>
            <tbody>
              {shift.attendance.map((entry) => (
                <tr key={entry.id}>
                  <td className={tdClass}>{entry.userName}</td>
                  <td className={tdClass}>{formatDateShort(entry.date)}</td>
                  <td className={tdClass}>{formatClock(entry.checkInAt)}</td>
                  <td className={tdClass}>
                    {entry.checkOutAt ? formatClock(entry.checkOutAt) : 'Sin salida'}
                  </td>
                  <td className={tdClass}>
                    {entry.checkOutAt
                      ? attendanceDuration(entry.checkInAt, entry.checkOutAt)
                      : 'En curso'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-4">
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">Resumen del turno</h2>
        <table className="w-full border-collapse text-[10px]">
          <tbody>
            <tr>
              <th className={thClass}>Venta de Productos</th>
              <td className={tdClass}>{formatMoney(shift.totals.totalProducts, currency)}</td>
            </tr>
            <tr>
              <th className={thClass}>Tiempo Billar</th>
              <td className={tdClass}>{formatMoney(shift.totals.totalBilliard, currency)}</td>
            </tr>
            <tr>
              <th className={thClass}>Cambio</th>
              <td className={tdClass}>{formatMoney(shift.initialCash, currency)}</td>
            </tr>
            <tr className="bg-slate-100">
              <th className={thClass}>Total V.P. + T.B. + C.</th>
              <td className={`${tdClass} font-bold`}>{formatMoney(totalWithChange, currency)}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-white px-2 py-1 text-[9px] text-slate-500" colSpan={2}>
                Total V.P. + T.B. + C. = Venta de Productos + Tiempo Billar + Cambio
              </td>
            </tr>
            {pendingTotal > 0 ? (
              <tr>
                <th className={thClass}>Consumo por cobrar (mesas y clientes abiertos)</th>
                <td className={tdClass}>−{formatMoney(pendingTotal, currency)}</td>
              </tr>
            ) : null}
            {pendingTotal > 0 ? (
              <tr>
                <td className="border border-slate-300 bg-white px-2 py-1 text-[9px] text-slate-500" colSpan={2}>
                  El consumo por cobrar ya está sumado en Total V.P. + T.B. + C., pero todavía no
                  entró a caja; por eso se descuenta para calcular el efectivo esperado.
                </td>
              </tr>
            ) : null}
            <tr>
              <th className={thClass}>QR</th>
              <td className={tdClass}>−{formatMoney(shift.totals.totalQr, currency)}</td>
            </tr>
            <tr>
              <th className={thClass}>Gastos de Caja</th>
              <td className={tdClass}>−{formatMoney(shift.totals.totalExpenses, currency)}</td>
            </tr>
            {transfersIn > 0 ? (
              <tr>
                <th className={thClass}>Traspasos que entran a caja</th>
                <td className={tdClass}>+{formatMoney(transfersIn, currency)}</td>
              </tr>
            ) : null}
            {transfersOut > 0 ? (
              <tr>
                <th className={thClass}>Traspasos que salen de caja</th>
                <td className={tdClass}>−{formatMoney(transfersOut, currency)}</td>
              </tr>
            ) : null}
            <tr className="bg-slate-100">
              <th className={thClass}>Total Efectivo esperado</th>
              <td className={`${tdClass} font-bold`}>
                {expected !== undefined && expected !== null ? formatMoney(expected, currency) : '—'}
              </td>
            </tr>
            <tr>
              <th className={thClass}>Saldo en contra (−) o a favor (+)</th>
              <td className={`${tdClass} font-bold`}>
                {difference !== null
                  ? `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatMoney(
                      Math.abs(difference),
                      currency
                    )}`
                  : '—'}
              </td>
            </tr>
            <tr>
              <th className={thClass}>Total de Efectivo en Caja</th>
              <td className={`${tdClass} font-bold`}>
                {cashInDrawer !== null ? formatMoney(cashInDrawer, currency) : '—'}
                <span className="ml-1 font-normal text-slate-500">
                  {counted !== null ? '(contado)' : '(esperado)'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-[9px] text-slate-500">
          {shift.totals.playsCount} partidas cobradas · {shift.totals.salesCount} ventas ·{' '}
          {shift.totals.expensesCount} gastos · {openSessions.length} mesas abiertas ·{' '}
          {openTabs.length} ventas por cliente abiertas
        </p>
      </div>

      {openSessions.length > 0 || openTabs.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-1 text-[11px] font-black uppercase tracking-wider">
            Mesas y clientes abiertos
          </h2>
          <p className="mb-2 text-[9px] text-slate-500">
            Consumo todavía no cobrado. Está incluido en el resumen del turno como “consumo por
            cobrar”.
          </p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Mesa / cliente</th>
                <th className={thClass}>Entrada</th>
                <th className={thClass}>Duración</th>
                <th className={thClass}>Tiempo Billar</th>
                <th className={thClass}>Venta de Productos</th>
                <th className={thClass}>Total</th>
                <th className={thClass}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {openSessions.map((session) => (
                <tr key={`session-${session.id}`}>
                  <td className={tdClass}>
                    {session.tableName}
                    {session.outsideShiftDate ? (
                      <span className="ml-1 text-[9px] text-slate-500">(de otra fecha)</span>
                    ) : null}
                  </td>
                  <td className={tdClass}>{formatDateTime(session.startTime)}</td>
                  <td className={tdClass}>{session.timer}</td>
                  <td className={tdClass}>{formatMoney(session.billiardAmount, currency)}</td>
                  <td className={tdClass}>{formatMoney(session.productsAmount, currency)}</td>
                  <td className={`${tdClass} font-bold`}>{formatMoney(session.totalAmount, currency)}</td>
                  <td className={tdClass}>{session.notes || '—'}</td>
                </tr>
              ))}
              {openTabs.map((tab) => (
                <tr key={`tab-${tab.id}`}>
                  <td className={tdClass}>
                    Cliente: {tab.customerName}
                    {tab.outsideShiftDate ? (
                      <span className="ml-1 text-[9px] text-slate-500">(de otra fecha)</span>
                    ) : null}
                  </td>
                  <td className={tdClass}>{formatDateTime(tab.createdAt)}</td>
                  <td className={tdClass}>—</td>
                  <td className={tdClass}>{formatMoney(0, currency)}</td>
                  <td className={tdClass}>{formatMoney(tab.itemsAmount, currency)}</td>
                  <td className={`${tdClass} font-bold`}>{formatMoney(tab.itemsAmount, currency)}</td>
                  <td className={tdClass}>
                    {tab.items.map((item) => `${item.quantity}× ${item.name}`).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {outOfRange ? (
        <div className="mt-4 print-break rounded border border-amber-400 bg-amber-50 p-2">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-amber-800">
            Movimientos de otras fechas no incluidos
          </h2>
          <p className="mt-1 text-[9px] text-amber-800">
            Este turno pertenece solo al {formatDateShort(shift.dateStart)}. Los movimientos de
            otras fechas no se suman a la planilla:
          </p>
          <table className="mt-2 w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="border border-amber-300 px-2 py-1 text-left font-bold">Fecha</th>
                <th className="border border-amber-300 px-2 py-1 text-left font-bold">Movimientos</th>
                <th className="border border-amber-300 px-2 py-1 text-left font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {outOfRange.dates.map((item) => (
                <tr key={item.date}>
                  <td className="border border-amber-300 px-2 py-1">{formatDateShort(item.date)}</td>
                  <td className="border border-amber-300 px-2 py-1">{plural(item.count, 'movimiento', 'movimientos')}</td>
                  <td className="border border-amber-300 px-2 py-1 font-bold">
                    {formatMoney(item.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {(shift.cashTransfers ?? []).length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">
            Traspasos QR ↔ efectivo
          </h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Hora</th>
                <th className={thClass}>Movimiento</th>
                <th className={thClass}>Concepto</th>
                <th className={thClass}>Referencia</th>
                <th className={thClass}>Registró</th>
                <th className={thClass}>Monto</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(shift.cashTransfers ?? []).map((transfer) => {
                const cashOut = transfer.direction === 'qr_to_cash';
                return (
                  <tr key={transfer.id}>
                    <td className={tdClass}>{formatDateTime(transfer.createdAt)}</td>
                    <td className={tdClass}>
                      {transferDirectionLabel(transfer.direction)}
                      <span className="ml-1 text-slate-500">
                        ({transferCashEffectLabel(transfer.direction)})
                      </span>
                    </td>
                    <td className={tdClass}>{transfer.concept}</td>
                    <td className={tdClass}>{transfer.reference || '—'}</td>
                    <td className={tdClass}>{transfer.createdByName}</td>
                    <td className={`${tdClass} font-bold`}>
                      {cashOut ? '−' : '+'}
                      {formatMoney(transfer.amount, currency)}
                    </td>
                    <td className={tdClass}>
                      {transfer.status === 'voided'
                        ? `Anulado: ${transfer.voidReason || ''}`
                        : 'Vigente'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {shift.tableSummary.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">
            Tiempo Billar y Venta de Productos por mesa
          </h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Mesa</th>
                <th className={thClass}>Partidas cobradas</th>
                <th className={thClass}>Tiempo Billar</th>
                <th className={thClass}>Venta de Productos</th>
                <th className={thClass}>Total</th>
              </tr>
            </thead>
            <tbody>
              {shift.tableSummary.map((row) => (
                <tr key={row.tableId}>
                  <td className={tdClass}>{row.tableName}</td>
                  <td className={`${tdClass} text-center`}>
                    {row.playsCount}
                    {Number(row.openCount || 0) > 0 ? (
                      <span className="ml-1 text-[9px] text-slate-500">
                        + {row.openCount} abierta{row.openCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </td>
                  <td className={tdClass}>{formatMoney(row.billiard, currency)}</td>
                  <td className={tdClass}>{formatMoney(row.products, currency)}</td>
                  <td className={`${tdClass} font-bold`}>{formatMoney(row.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {shift.productSummary.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">
            Venta de Productos (detalle)
          </h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Producto</th>
                <th className={thClass}>Cantidad</th>
                <th className={thClass}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {shift.productSummary.map((row) => (
                <tr key={row.name}>
                  <td className={tdClass}>{row.name}</td>
                  <td className={`${tdClass} text-center`}>{row.quantity}</td>
                  <td className={tdClass}>{formatMoney(row.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-4 print-break">
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">
          Tiempo Billar (partidas cobradas)
        </h2>
        {shift.tablePlays.length === 0 ? (
          <p className="border border-slate-300 px-2 py-2 text-[10px] text-slate-500">
            No se registraron partidas en este turno.
          </p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Mesa</th>
                <th className={thClass}>Tipo</th>
                <th className={thClass}>Entrada</th>
                <th className={thClass}>Salida</th>
                <th className={thClass}>Duración</th>
                <th className={thClass}>Billar</th>
                <th className={thClass}>Consumo</th>
                <th className={thClass}>Total</th>
                <th className={thClass}>Pago</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {shift.tablePlays.map((play) => (
                <tr key={play.id}>
                  <td className={tdClass}>
                    {play.tableName}
                    {play.itemNumber > 1 ? ` (#${play.itemNumber})` : ''}
                  </td>
                  <td className={tdClass}>
                    {play.playerType === 'staff'
                      ? 'Encargados (sin cobro)'
                      : play.playerType === 'mixed'
                      ? 'Encargado + cliente (50%)'
                      : 'Normal'}
                  </td>
                  <td className={tdClass}>{formatDateTime(play.startTime)}</td>
                  <td className={tdClass}>{formatDateTime(play.endTime)}</td>
                  <td className={tdClass}>{durationLabel(play.durationMinutes)}</td>
                  <td className={tdClass}>{formatMoney(play.billiardAmount, currency)}</td>
                  <td className={tdClass}>{formatMoney(play.productsAmount, currency)}</td>
                  <td className={`${tdClass} font-bold`}>{formatMoney(play.totalAmount, currency)}</td>
                  <td className={tdClass}>{paymentLabel(play.paymentMethod)}</td>
                  <td className={tdClass}>
                    {play.status === 'voided' ? `Anulada: ${play.voidReason || ''}` : 'Cobrada'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {shift.sales.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">
            Venta de Productos (barra)
          </h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Hora</th>
                <th className={thClass}>Detalle</th>
                <th className={thClass}>Total</th>
                <th className={thClass}>Pago</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {shift.sales.map((sale) => (
                <tr key={sale.id}>
                  <td className={tdClass}>{formatDateTime(sale.createdAt)}</td>
                  <td className={tdClass}>
                    {sale.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                  </td>
                  <td className={`${tdClass} font-bold`}>{formatMoney(sale.totalAmount, currency)}</td>
                  <td className={tdClass}>{paymentLabel(sale.paymentMethod)}</td>
                  <td className={tdClass}>
                    {sale.status === 'voided' ? `Anulada: ${sale.voidReason || ''}` : 'Cobrada'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {shift.expenses.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-2 text-[11px] font-black uppercase tracking-wider">Gastos de Caja</h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={thClass}>Hora</th>
                <th className={thClass}>Concepto</th>
                <th className={thClass}>Productos comprados</th>
                <th className={thClass}>Categoría</th>
                <th className={thClass}>Monto</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {shift.expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className={tdClass}>{formatDateTime(expense.createdAt)}</td>
                  <td className={tdClass}>{expense.concept}</td>
                  <td className={tdClass}>
                    {expense.items.length === 0
                      ? '—'
                      : expense.items
                          .map(
                            (item) =>
                              `${item.quantity}× ${item.name} (${formatMoney(item.unitPrice, currency)} c/u)`
                          )
                          .join(', ')}
                  </td>
                  <td className={tdClass}>{expenseCategoryLabel(expense.category)}</td>
                  <td className={`${tdClass} font-bold`}>{formatMoney(expense.amount, currency)}</td>
                  <td className={tdClass}>
                    {expense.status === 'voided' ? `Anulado: ${expense.voidReason || ''}` : 'Activo'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {closing?.notes ? (
        <div className="mt-4 rounded border border-slate-300 p-2 print-break">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Observaciones del cierre
          </p>
          <p className="mt-1 text-[10px]">{closing.notes}</p>
        </div>
      ) : null}

      {String(settings?.receiptPromotions || '').trim() ? (
        <div className="mt-4 rounded border border-slate-300 p-2 print-break">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Promociones
          </p>
          <p className="mt-1 whitespace-pre-line text-[10px]">{String(settings?.receiptPromotions || '').trim()}</p>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-10 text-center text-[10px]">
        <div className="border-t border-slate-500 pt-1">Firma del encargado</div>
        <div className="border-t border-slate-500 pt-1">Firma del administrador</div>
      </div>

      <p className="mt-4 border-t border-slate-200 pt-1 text-center text-[9px] text-slate-400">
        Documento generado por el sistema local · {settings?.businessName || 'Billar Bar la Beta'} · Este
        reporte refleja los movimientos registrados hasta el momento de la impresión.
      </p>
    </div>
  );
};

interface ShiftReportModalProps {
  open: boolean;
  shift: ShiftDetail | null;
  onClose: () => void;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({ open, shift, onClose }) => {
  if (!shift) return null;
  return (
    <Modal
      open={open}
      title="Planilla del turno"
      subtitle={`Turno #${shift.id} · ${formatShiftRange(shift)}`}
      icon={<Printer className="h-4 w-4" />}
      onClose={onClose}
      size="full"
      bodyClassName="print-area bg-white"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir planilla
          </button>
        </>
      }
    >
      <ShiftReport shift={shift} />
    </Modal>
  );
};
