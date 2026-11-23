import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ReceiptText, Trash2, Wallet } from 'lucide-react';
import type { ExpenseCategory } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { expenseCategoryLabel, formatMoney } from '../lib/format';
import { Modal } from './ui/Modal';

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
}

interface ExpenseLine {
  key: number;
  productId: number | null;
  name: string;
  quantity: string;
  unitPrice: string;
}

const CATEGORIES: ExpenseCategory[] = ['comida', 'personal', 'compras', 'servicios', 'otro'];
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const parseDecimal = (value: string) => {
  const numeric = Number(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
};

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ open, onClose }) => {
  const { products, settings, runAction } = useApp();
  const currency = settings?.currency || 'Bs';
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('compras');
  const [lines, setLines] = useState<ExpenseLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(1);

  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products]
  );

  useEffect(() => {
    if (open) {
      setAmount('');
      setConcept('');
      setCategory('compras');
      setLines([]);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const linesTotal = useMemo(
    () =>
      round2(
        lines.reduce(
          (sum, line) => sum + parseDecimal(line.quantity) * parseDecimal(line.unitPrice),
          0
        )
      ),
    [lines]
  );

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        key: nextKey.current++,
        productId: null,
        name: '',
        quantity: '1',
        unitPrice: '',
      },
    ]);
  };

  const updateLine = (key: number, patch: Partial<ExpenseLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const changeLineName = (key: number, value: string) => {
    const match = activeProducts.find(
      (product) => product.name.toLowerCase() === value.trim().toLowerCase()
    );
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        return {
          ...line,
          name: value,
          productId: match?.id ?? null,
          // Al elegir un producto del catálogo se toma su precio como costo
          // unitario. Ese costo queda bloqueado y no se edita en la línea.
          ...(match ? { unitPrice: String(match.price) } : {}),
        };
      })
    );
  };

  const removeLine = (key: number) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setError(null);

    if (concept.trim().length < 2) {
      return setError('Describe el gasto con al menos 2 caracteres.');
    }

    let items:
      | Array<{ productId: number | null; name: string; quantity: number; unitPrice: number }>
      | undefined;
    let numericAmount = 0;

    if (lines.length > 0) {
      const parsed: Array<{
        productId: number | null;
        name: string;
        quantity: number;
        unitPrice: number;
      }> = [];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const name = line.name.trim();
        if (name.length < 1) {
          return setError(`Escribe el nombre del producto #${index + 1}.`);
        }
        const quantity = Math.floor(Number(line.quantity));
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
          return setError(`La cantidad del producto #${index + 1} no es válida.`);
        }
        const catalogProduct =
          line.productId !== null
            ? products.find((product) => product.id === line.productId)
            : null;
        const unitPrice = round2(
          catalogProduct ? catalogProduct.price : parseDecimal(line.unitPrice)
        );
        if (!(unitPrice > 0)) {
          return setError(
            catalogProduct
              ? `El producto #${index + 1} no tiene un costo definido en el inventario.`
              : `Ingresa el costo unitario del producto #${index + 1}.`
          );
        }
        parsed.push({ productId: line.productId, name, quantity, unitPrice });
      }
      items = parsed;
      numericAmount = round2(
        parsed.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      );
      if (!(numericAmount > 0)) {
        return setError('El total de los productos debe ser mayor a cero.');
      }
    } else {
      numericAmount = round2(parseDecimal(amount));
      if (!(numericAmount > 0)) {
        return setError('Ingresa un monto mayor a cero o agrega productos.');
      }
    }

    setBusy(true);
    try {
      const response = await runAction(() =>
        api.addExpense({
          concept: concept.trim(),
          category,
          ...(items && items.length > 0
            ? { items }
            : { amount: numericAmount }),
        })
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
      size="md"
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
          <label className="label" htmlFor="expense-concept">
            Concepto
          </label>
          <input
            id="expense-concept"
            className="input"
            autoFocus
            maxLength={120}
            placeholder="Ej. Compra de hielo y limones"
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

        <div className="rounded-xl border border-slate-800 bg-[#08111d] p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-slate-200">Productos comprados (opcional)</p>
              <p className="text-[9px] text-slate-500">
                El costo de los productos del inventario se toma automáticamente y no se edita.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost border border-slate-800 px-2 py-1 text-[10px]"
              onClick={addLine}
              disabled={busy || lines.length >= 50}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </button>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-800 px-3 py-2.5 text-[10px] leading-relaxed text-slate-500">
              Sin productos. Puedes registrar solo el monto del gasto o agregar el detalle de lo
              comprado.
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_44px_72px_66px_24px] items-center gap-1.5 px-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                <span>Producto</span>
                <span className="text-center">Cant.</span>
                <span className="text-right">Costo</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>
              {lines.map((line, index) => {
                const subtotal = round2(
                  parseDecimal(line.quantity) * parseDecimal(line.unitPrice)
                );
                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-[minmax(0,1fr)_44px_72px_66px_24px] items-center gap-1.5"
                  >
                    <input
                      list="expense-product-options"
                      className="input-compact px-2 py-1 text-[11px]"
                      placeholder={`Producto #${index + 1}`}
                      maxLength={80}
                      value={line.name}
                      onChange={(event) => changeLineName(line.key, event.target.value)}
                    />
                    <input
                      className="input-compact num px-1 py-1 text-center text-[11px]"
                      inputMode="numeric"
                      aria-label={`Cantidad del producto #${index + 1}`}
                      value={line.quantity}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (/^\d{0,3}$/.test(value)) updateLine(line.key, { quantity: value });
                      }}
                    />
                    <input
                      className={`input-compact num px-1 py-1 text-right text-[11px] ${
                        line.productId !== null
                          ? 'cursor-not-allowed border-slate-700/60 bg-slate-800/40 text-slate-400'
                          : ''
                      }`}
                      inputMode="decimal"
                      aria-label={
                        line.productId !== null
                          ? `Costo fijo del producto #${index + 1}`
                          : `Costo unitario del producto #${index + 1}`
                      }
                      placeholder="0"
                      value={line.unitPrice}
                      readOnly={line.productId !== null}
                      tabIndex={line.productId !== null ? -1 : undefined}
                      title={
                        line.productId !== null
                          ? 'El costo se toma del inventario y no se puede editar.'
                          : undefined
                      }
                      onChange={(event) => {
                        if (line.productId !== null) return;
                        const value = event.target.value;
                        if (/^\d*[.,]?\d{0,2}$/.test(value)) {
                          updateLine(line.key, { unitPrice: value });
                        }
                      }}
                    />
                    <span className="num truncate text-right text-[9px] font-bold text-slate-300">
                      {formatMoney(subtotal, currency)}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-300"
                      title="Quitar producto"
                      onClick={() => removeLine(line.key)}
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <datalist id="expense-product-options">
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
            </div>
          )}
        </div>

        {lines.length === 0 ? (
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
        ) : (
          <p className="rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2 text-[10px] leading-relaxed text-slate-500">
            El monto se calcula con la cantidad y el costo de cada producto. Los costos del
            inventario no se editan.
          </p>
        )}

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
          <span className="text-slate-400">
            {lines.length > 0 ? 'Total de productos' : 'Monto a registrar'}
          </span>
          <span className="num font-bold text-amber-300">
            {formatMoney(
              lines.length > 0 ? linesTotal : parseDecimal(amount),
              currency
            )}
          </span>
        </div>
      </form>
    </Modal>
  );
};
