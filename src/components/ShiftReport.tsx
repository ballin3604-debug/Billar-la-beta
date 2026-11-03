import React from 'react';
import type { ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import {
  durationLabel,
  expenseCategoryLabel,
  formatDateTime,
  formatMoney,
  formatShiftRange,
  paymentLabel,
} from '../lib/format';
import { Modal } from './ui/Modal';
import { Printer } from 'lucide-react';

interface ShiftReportProps {
  shift: ShiftDetail;
}

const thClass = 'border border-slate-300 bg-slate-100 px-1.5 py-1 text-left font-bold';
const tdClass = 'border border-slate-300 px-1.5 py-1 align-top';

export const ShiftReport: React.FC<ShiftReportProps> = ({ shift }) => {
  const { settings } = useApp();
  const currency = settings?.currency || 'Bs';
  const closing = shift.closing;
  const expected = closing?.expectedCash ?? shift.totals.expectedCash;
  const difference = closing?.difference ?? null;

  return (
    <div className="bg-white p-4 text-[10px] leading-snug text-slate-900 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {settings?.businessName || 'Billar & Bar'}
          </p>
          <h1 className="mt-0.5 text-lg font-black uppercase tracking-tight">Planilla de control de caja</h1>
          <p className="mt-0.5 text-[9px] text-slate-500">
            {formatShiftRange(shift)} · Turno #{shift.id}
          </p>
        </div>
        <div className="text-right text-[9px]">
          <p className="inline-block rounded border border-slate-400 px-2 py-0.5 font-bold uppercase">
            {shift.status === 'closed' ? 'Turno cerrado' : 'Turno abierto'}
          </p>
          <p className="mt-1 text-slate-500">Impreso: {formatDateTime(new Date())}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[9px] sm:grid-cols-4">
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

      <div className="mt-4">
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Resumen del turno</h2>
        <table className="w-full border-collapse text-[9px]">
          <tbody>
            <tr>
              <th className={thClass}>Fondo inicial</th>
              <td className={tdClass}>{formatMoney(shift.initialCash, currency)}</td>
              <th className={thClass}>Ventas de billar</th>
              <td className={tdClass}>{formatMoney(shift.totals.totalBilliard, currency)}</td>
            </tr>
            <tr>
              <th className={thClass}>Ventas de productos</th>
              <td className={tdClass}>{formatMoney(shift.totals.totalProducts, currency)}</td>
              <th className={thClass}>Total vendido</th>
              <td className={`${tdClass} font-bold`}>{formatMoney(shift.totals.grossTotal, currency)}</td>
            </tr>
            <tr>
              <th className={thClass}>Cobrado por QR</th>
              <td className={tdClass}>{formatMoney(shift.totals.totalQr, currency)}</td>
              <th className={thClass}>Gastos de caja</th>
              <td className={tdClass}>{formatMoney(shift.totals.totalExpenses, currency)}</td>
            </tr>
            <tr>
              <th className={thClass}>Efectivo esperado</th>
              <td className={tdClass}>
                {expected !== undefined && expected !== null ? formatMoney(expected, currency) : '—'}
              </td>
              <th className={thClass}>Efectivo contado</th>
              <td className={tdClass}>
                {closing?.countedCash !== undefined && closing?.countedCash !== null
                  ? formatMoney(closing.countedCash, currency)
                  : '—'}
              </td>
            </tr>
            <tr>
              <th className={thClass}>Diferencia</th>
              <td className={`${tdClass} font-bold`}>
                {difference !== null
                  ? `${difference > 0 ? '+' : ''}${formatMoney(difference, currency)}`
                  : '—'}
              </td>
              <th className={thClass}>Movimientos</th>
              <td className={tdClass}>
                {shift.totals.playsCount} partidas · {shift.totals.salesCount} ventas ·{' '}
                {shift.totals.expensesCount} gastos
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {shift.tableSummary.length > 0 ? (
        <div className="mt-4 print-break">
          <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Resumen por mesa</h2>
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={thClass}>Mesa</th>
                <th className={thClass}>Partidas</th>
                <th className={thClass}>Billar</th>
                <th className={thClass}>Productos</th>
                <th className={thClass}>Total</th>
              </tr>
            </thead>
            <tbody>
              {shift.tableSummary.map((row) => (
                <tr key={row.tableId}>
                  <td className={tdClass}>{row.tableName}</td>
                  <td className={`${tdClass} text-center`}>{row.playsCount}</td>
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
          <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Productos vendidos</h2>
          <table className="w-full border-collapse text-[9px]">
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
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Partidas de billar</h2>
        {shift.tablePlays.length === 0 ? (
          <p className="border border-slate-300 px-2 py-2 text-[9px] text-slate-500">
            No se registraron partidas en este turno.
          </p>
        ) : (
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={thClass}>Mesa</th>
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
          <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Ventas de barra</h2>
          <table className="w-full border-collapse text-[8.5px]">
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
          <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Gastos de caja</h2>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={thClass}>Hora</th>
                <th className={thClass}>Concepto</th>
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
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Observaciones del cierre
          </p>
          <p className="mt-1 text-[9px]">{closing.notes}</p>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-10 text-center text-[9px]">
        <div className="border-t border-slate-500 pt-1">Firma del encargado</div>
        <div className="border-t border-slate-500 pt-1">Firma del administrador</div>
      </div>

      <p className="mt-4 border-t border-slate-200 pt-1 text-center text-[8px] text-slate-400">
        Documento generado por el sistema local · {settings?.businessName || 'Billar & Bar'} · Este
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
