import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, ReceiptText, ShieldCheck, TrendingDown } from 'lucide-react';
import type { ExpenseCategory } from '../types';
import { useApp } from '../context/AppContext';
import {
  cn,
  expenseCategoryLabel,
  formatClock,
  formatMoney,
  plural,
  transferCashEffectLabel,
  transferDirectionLabel,
} from '../lib/format';
import { ExpenseModal } from './ExpenseModal';
import { TransferModal } from './TransferModal';
import { EmptyState } from './ui/EmptyState';
import { StatCard } from './ui/StatCard';

export const CashierExpensesView: React.FC = () => {
  const { currentShift, settings } = useApp();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const currency = settings?.currency || 'Bs';

  const ownExpenses = currentShift?.expenses ?? [];
  const ownTransfers = currentShift?.cashTransfers ?? [];
  const activeExpenses = useMemo(
    () => ownExpenses.filter((expense) => expense.status === 'active'),
    [ownExpenses]
  );
  const total = useMemo(
    () => activeExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [activeExpenses]
  );

  if (!currentShift) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Egresos del turno
            </h1>
            <span className="rounded-md border border-slate-800 bg-[#0b1422] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Turno #{currentShift.id}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Registra los gastos de caja. Aquí solo aparecen los egresos que registraste tú.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 text-violet-400" />
            Traspaso QR ↔ efectivo
          </button>
          <button type="button" className="btn-primary" onClick={() => setExpenseOpen(true)}>
            <Plus className="h-4 w-4" />
            Registrar egreso
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:max-w-xl">
        <StatCard
          label="Tus egresos"
          value={activeExpenses.length}
          hint={plural(activeExpenses.length, 'egreso vigente', 'egresos vigentes')}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="rose"
        />
        <StatCard
          label="Total de tus egresos"
          value={formatMoney(total, currency)}
          hint="Solo egresos vigentes de este turno"
          icon={<ReceiptText className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">Mis egresos registrados</h2>
            <p className="text-[10px] text-slate-500">
              Quedan en auditoría. Solo el administrador puede anularlos.
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
            Registro protegido
          </span>
        </div>

        {ownExpenses.length === 0 ? (
          <EmptyState
            title="Sin egresos registrados"
            description="Usa “Registrar egreso” para anotar un gasto de caja de este turno."
            icon={<ReceiptText className="h-6 w-6" />}
            className="m-4"
            action={
              <button type="button" className="btn-primary" onClick={() => setExpenseOpen(true)}>
                <Plus className="h-4 w-4" />
                Registrar egreso
              </button>
            }
          />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="data-table min-w-[560px]">
              <thead className="table-head">
                <tr>
                  <th>Hora</th>
                  <th>Concepto y productos</th>
                  <th>Categoría</th>
                  <th className="text-right">Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...ownExpenses].reverse().map((expense) => (
                  <tr
                    key={expense.id}
                    className={expense.status === 'voided' ? 'opacity-55' : ''}
                  >
                    <td className="num text-slate-300">{formatClock(expense.createdAt)}</td>
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
                    <td className="num text-right font-bold text-rose-300">
                      {formatMoney(expense.amount, currency)}
                    </td>
                    <td>
                      {expense.status === 'voided' ? (
                        <span className="inline-flex rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          Anulado
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          Vigente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] text-slate-500">
          {plural(ownExpenses.length, 'egreso registrado', 'egresos registrados')} en este turno.
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">Mis traspasos QR ↔ efectivo</h2>
            <p className="text-[10px] text-slate-500">
              Intercambios de efectivo por QR registrados por ti en este turno.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 text-violet-400" />
            Registrar traspaso
          </button>
        </div>

        {ownTransfers.length === 0 ? (
          <EmptyState
            title="Sin traspasos registrados"
            description="Si un cliente te pide cambiar QR por efectivo o efectivo por QR, regístralo aquí."
            icon={<ArrowLeftRight className="h-6 w-6" />}
            className="m-4"
            action={
              <button type="button" className="btn-secondary" onClick={() => setTransferOpen(true)}>
                <ArrowLeftRight className="h-4 w-4" />
                Registrar traspaso
              </button>
            }
          />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="data-table min-w-[620px]">
              <thead className="table-head">
                <tr>
                  <th>Hora</th>
                  <th>Movimiento</th>
                  <th>Concepto</th>
                  <th>Referencia</th>
                  <th className="text-right">Efecto en caja</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...ownTransfers].reverse().map((transfer) => {
                  const cashOut = transfer.direction === 'qr_to_cash';
                  return (
                    <tr
                      key={transfer.id}
                      className={transfer.status === 'voided' ? 'opacity-55' : ''}
                    >
                      <td className="num text-slate-300">{formatClock(transfer.createdAt)}</td>
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
                      <td className="max-w-[180px] text-slate-300">{transfer.concept}</td>
                      <td className="max-w-[130px] truncate text-slate-500">
                        {transfer.reference || '—'}
                      </td>
                      <td
                        className={cn(
                          'num text-right font-bold',
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
                          <span className="inline-flex rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                            Anulado
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                            Vigente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] text-slate-500">
          {plural(ownTransfers.length, 'traspaso registrado', 'traspasos registrados')} en este
          turno. Solo el administrador puede anularlos.
        </div>
      </section>

      <ExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  );
};
