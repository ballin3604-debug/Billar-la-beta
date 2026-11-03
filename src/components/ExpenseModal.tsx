import React, { useEffect, useState } from 'react';
import { ReceiptText, Wallet } from 'lucide-react';
import type { ExpenseCategory } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { expenseCategoryLabel, formatMoney } from '../lib/format';
import { Modal } from './ui/Modal';

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: ExpenseCategory[] = ['comida', 'personal', 'compras', 'servicios', 'otro'];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ open, onClose }) => {
  const { settings, runAction } = useApp();
  const currency = settings?.currency || 'Bs';
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('compras');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount('');
      setConcept('');
      setCategory('compras');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setError(null);

    const numeric = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return setError('Ingresa un monto mayor a cero.');
    }
    if (concept.trim().length < 2) {
      return setError('Describe el gasto con al menos 2 caracteres.');
    }

    setBusy(true);
    try {
      const response = await runAction(() =>
        api.addExpense({ amount: numeric, concept: concept.trim(), category })
      );
      if (response) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Registrar gasto de caja"
      subtitle="El monto se descuenta del efectivo esperado."
      icon={<ReceiptText className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="expense-form" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Registrar gasto'}
          </button>
        </>
      }
    >
      <form id="expense-form" className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="expense-amount">
            Monto ({currency})
          </label>
          <div className="relative">
            <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="expense-amount"
              className="input num pl-9 text-base font-bold"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              value={amount}
              onChange={(event) => {
                const value = event.target.value;
                if (/^\d*[.,]?\d{0,2}$/.test(value)) setAmount(value);
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Ejemplos: compra de hielo, pago de taxi, retiro autorizado.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="expense-concept">
            Concepto
          </label>
          <input
            id="expense-concept"
            className="input"
            maxLength={120}
            placeholder="Ej. Hielo y limones"
            value={concept}
            onChange={(event) => setConcept(event.target.value)}
          />
        </div>

        <div>
          <p className="label">Categoría</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`chip justify-center py-2 ${
                  category === item ? 'chip-active' : ''
                }`}
              >
                {expenseCategoryLabel(item)}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <p className="rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2 text-[10px] leading-relaxed text-slate-500">
            Se guardará con tu nombre y la hora. Solo el administrador puede anularlo y deberá
            escribir un motivo.
          </p>
        )}

        <div className="flex justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px]">
          <span className="text-slate-400">Monto a registrar</span>
          <span className="num font-bold text-amber-300">
            {formatMoney(Number(amount.replace(',', '.')) || 0, currency)}
          </span>
        </div>
      </form>
    </Modal>
  );
};
