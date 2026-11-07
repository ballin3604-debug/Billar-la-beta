import React from 'react';
import type { ExpenseCategory, ShiftDetail } from '../types';
import { useApp } from '../context/AppContext';
import {
  expenseCategoryLabel,
  formatDateTime,
  formatMoney,
  formatShiftRange,
  plural,
} from '../lib/format';
import { Modal } from './ui/Modal';
import { Printer } from 'lucide-react';

interface ExpenseReportProps {
  shift: ShiftDetail;
}

const thClass = 'border border-slate-300 bg-slate-100 px-1.5 py-1 text-left font-bold';
const tdClass = 'border border-slate-300 px-1.5 py-1 align-top';
const moneyClass = 'border border-slate-300 px-1.5 py-1 text-right align-top whitespace-nowrap';
const CATEGORIES: ExpenseCategory[] = ['comida', 'personal', 'compras', 'servicios', 'otro'];

export const ExpenseReport: React.FC<ExpenseReportProps> = ({ shift }) => {
  const { settings } = useApp();
  const currency = settings?.currency || 'Bs';
  const activeExpenses = shift.expenses.filter((expense) => expense.status === 'active');
  const voidedExpenses = shift.expenses.filter((expense) => expense.status === 'voided');
  const totalActive = activeExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalVoided = voidedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const activeWithItems = activeExpenses.filter((expense) => expense.items.length > 0);
  const activeUnits = activeWithItems.reduce(
    (sum, expense) =>
      sum + expense.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  const categoryRows = CATEGORIES.map((category) => {
    const categoryExpenses = shift.expenses.filter((expense) => expense.category === category);
    const active = categoryExpenses.filter((expense) => expense.status === 'active');
    const voided = categoryExpenses.filter((expense) => expense.status === 'voided');
    return {
      category,
      count: active.length,
      voidedCount: voided.length,
      amount: active.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      voidedAmount: voided.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    };
  });

  const productMap = new Map<string, { name: string; quantity: number; amount: number }>();
  for (const expense of activeExpenses) {
    for (const item of expense.items) {
      const key = item.name.trim().toLowerCase();
      const current = productMap.get(key) || { name: item.name, quantity: 0, amount: 0 };
      current.quantity += Number(item.quantity || 0);
      current.amount += Number(item.quantity || 0) * Number(item.unitPrice || 0);
      productMap.set(key, current);
    }
  }
  const productRows = [...productMap.values()].sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-white p-4 text-[10px] leading-snug text-slate-900 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {settings?.businessName || 'Billar & Bar'}
          </p>
          <h1 className="mt-0.5 text-lg font-black uppercase tracking-tight">
            Planilla de gastos de caja
          </h1>
          <p className="text-[9px] text-slate-600">
            Turno #{shift.id} · {formatShiftRange(shift)}
          </p>
        </div>
        <div className="text-right text-[9px] leading-relaxed text-slate-600">
          <p>
            <span className="font-bold text-slate-900">Estado:</span>{' '}
            {shift.status === 'open' ? 'Caja abierta' : 'Caja cerrada'}
          </p>
          <p>
            <span className="font-bold text-slate-900">Abrió:</span> {shift.openedByName}
          </p>
          <p>
            <span className="font-bold text-slate-900">Cerró:</span>{' '}
            {shift.closedByName || '—'}
          </p>
          <p>
            <span className="font-bold text-slate-900">Emitido:</span>{' '}
            {formatDateTime(new Date().toISOString())}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Gastos vigentes
          </p>
          <p className="num mt-0.5 text-sm font-black">{formatMoney(totalActive, currency)}</p>
          <p className="text-[8px] text-slate-500">
            {plural(activeExpenses.length, 'registro', 'registros')}
          </p>
        </div>
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Gastos anulados
          </p>
          <p className="num mt-0.5 text-sm font-black">{formatMoney(totalVoided, currency)}</p>
          <p className="text-[8px] text-slate-500">
            {plural(voidedExpenses.length, 'registro', 'registros')}
          </p>
        </div>
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Con productos
          </p>
          <p className="num mt-0.5 text-sm font-black">{activeWithItems.length}</p>
          <p className="text-[8px] text-slate-500">
            {plural(activeUnits, 'unidad comprada', 'unidades compradas')}
          </p>
        </div>
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Movimientos
          </p>
          <p className="num mt-0.5 text-sm font-black">{shift.expenses.length}</p>
          <p className="text-[8px] text-slate-500">incluye anulados</p>
        </div>
      </div>

      <div className="mt-3">
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">
          Resumen por categoría
        </h2>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr>
              <th className={thClass}>Categoría</th>
              <th className={thClass}>Vigentes</th>
              <th className={thClass}>Anulados</th>
              <th className={thClass}>Monto vigente</th>
              <th className={thClass}>Monto anulado</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.map((row) => (
              <tr key={row.category}>
                <td className={tdClass}>{expenseCategoryLabel(row.category)}</td>
                <td className={`${tdClass} text-center`}>{row.count}</td>
                <td className={`${tdClass} text-center`}>
                  {row.voidedCount > 0 ? row.voidedCount : '—'}
                </td>
                <td className={moneyClass}>{formatMoney(row.amount, currency)}</td>
                <td className={moneyClass}>
                  {row.voidedAmount > 0 ? formatMoney(row.voidedAmount, currency) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className={thClass}>Total</th>
              <th className={`${thClass} text-center`}>{activeExpenses.length}</th>
              <th className={`${thClass} text-center`}>{voidedExpenses.length}</th>
              <th className={`${thClass} text-right`}>{formatMoney(totalActive, currency)}</th>
              <th className={`${thClass} text-right`}>{formatMoney(totalVoided, currency)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 print-break">
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">
          Detalle de gastos
        </h2>
        {shift.expenses.length === 0 ? (
          <p className="border border-slate-300 px-2 py-2 text-[9px] text-slate-500">
            No se registraron gastos en este turno.
          </p>
        ) : (
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={thClass}>#</th>
                <th className={thClass}>Hora</th>
                <th className={thClass}>Concepto</th>
                <th className={thClass}>Categoría</th>
                <th className={thClass}>Registró</th>
                <th className={thClass}>Productos comprados</th>
                <th className={`${thClass} text-right`}>Monto</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {shift.expenses.map((expense, index) => (
                <tr key={expense.id}>
                  <td className={`${tdClass} text-center`}>{index + 1}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatDateTime(expense.createdAt)}
                  </td>
                  <td className={tdClass}>{expense.concept}</td>
                  <td className={tdClass}>{expenseCategoryLabel(expense.category)}</td>
                  <td className={tdClass}>{expense.createdByName}</td>
                  <td className={tdClass}>
                    {expense.items.length === 0 ? (
                      <span className="text-slate-400">Sin detalle de productos</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {expense.items.map((item) => (
                          <li key={item.id}>
                            {item.quantity}× {item.name}{' '}
                            <span className="text-slate-500">
                              ({formatMoney(item.unitPrice, currency)} c/u)
                            </span>
                            <span className="float-right font-bold">
                              {formatMoney(item.quantity * item.unitPrice, currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={`${moneyClass} font-bold`}>
                    {formatMoney(expense.amount, currency)}
                  </td>
                  <td className={tdClass}>
                    {expense.status === 'voided'
                      ? `Anulado${expense.voidReason ? `: ${expense.voidReason}` : ''}`
                      : 'Vigente'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className={thClass} colSpan={6}>
                  Total de gastos vigentes
                </th>
                <th className={`${thClass} text-right`}>{formatMoney(totalActive, currency)}</th>
                <th className={thClass} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="mt-3 print-break">
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">
          Productos comprados
        </h2>
        {productRows.length === 0 ? (
          <p className="border border-slate-300 px-2 py-2 text-[9px] text-slate-500">
            Los gastos vigentes no tienen productos detallados.
          </p>
        ) : (
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={thClass}>Producto</th>
                <th className={thClass}>Cantidad</th>
                <th className={thClass}>Costo total</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => (
                <tr key={row.name}>
                  <td className={tdClass}>{row.name}</td>
                  <td className={`${tdClass} text-center`}>{row.quantity}</td>
                  <td className={moneyClass}>{formatMoney(row.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className={thClass} colSpan={2}>
                  Total comprado en productos
                </th>
                <th className={`${thClass} text-right`}>
                  {formatMoney(
                    productRows.reduce((sum, row) => sum + row.amount, 0),
                    currency
                  )}
                </th>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {voidedExpenses.length > 0 ? (
        <p className="mt-3 border border-slate-300 bg-slate-50 px-2 py-1.5 text-[8px] text-slate-600">
          Los gastos anulados se muestran en el detalle para auditoría, pero no se descuentan del
          efectivo esperado ni de los totales vigentes.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-10 text-center text-[9px]">
        <div className="border-t border-slate-500 pt-1">Firma del cajero</div>
        <div className="border-t border-slate-500 pt-1">Firma del administrador</div>
      </div>

      <p className="mt-4 border-t border-slate-200 pt-1 text-center text-[8px] text-slate-400">
        Documento generado por el sistema local · {settings?.businessName || 'Billar & Bar'} · Este
        reporte refleja los gastos registrados hasta el momento de la impresión.
      </p>
    </div>
  );
};

interface ExpenseReportModalProps {
  open: boolean;
  shift: ShiftDetail | null;
  onClose: () => void;
}

export const ExpenseReportModal: React.FC<ExpenseReportModalProps> = ({
  open,
  shift,
  onClose,
}) => {
  if (!shift) return null;
  return (
    <Modal
      open={open}
      title="Planilla de gastos de caja"
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
      <ExpenseReport shift={shift} />
    </Modal>
  );
};
