import React, { useState } from 'react';
import {
  Ban,
  LogIn,
  LogOut,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { Table } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  calculateSession,
  cn,
  formatClock,
  formatMoney,
  plural,
  sumItems,
} from '../lib/format';
import { useNow } from '../lib/useNow';
import { ProductPicker } from './ui/ProductPicker';
import { ReasonDialog } from './ui/ReasonDialog';

interface OrderPanelProps {
  table: Table;
  onClose: () => void;
  onCheckout: (table: Table) => void;
}

export const OrderPanel: React.FC<OrderPanelProps> = ({ table, onClose, onCheckout }) => {
  const {
    products,
    settings,
    user,
    clockOffset,
    runAction,
  } = useApp();
  const now = useNow(clockOffset);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const session = table.activeSession;
  const currency = settings?.currency || 'Bs';
  const minimumCharge = settings?.minimumPlayCharge || 0;

  if (!session) {
    return (
      <div className="panel flex min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center">
        <ShoppingBag className="h-7 w-7 text-slate-600" />
        <p className="text-sm font-semibold text-slate-300">Esta mesa está libre</p>
        <p className="text-xs text-slate-500">Inicia la mesa desde el panel principal.</p>
        <button type="button" className="btn-secondary mt-2" onClick={onClose}>
          Cerrar panel
        </button>
      </div>
    );
  }

  const calculation = calculateSession(
    session.startTime,
    session.ratePerHour,
    minimumCharge,
    now
  );
  const itemsAmount = sumItems(session.items);
  const total = itemsAmount + calculation.cost;
  const selected = Object.fromEntries(
    session.items
      .filter((item) => item.productId !== null)
      .map((item) => [Number(item.productId), Number(item.quantity)])
  );

  const addProduct = async (productId: number) => {
    if (busyKey) return;
    setBusyKey(`add-${productId}`);
    try {
      await runAction(() => api.addItem(table.id, productId, 1));
    } finally {
      setBusyKey(null);
    }
  };

  const removeItem = async (itemId: number) => {
    if (busyKey) return;
    setBusyKey(`item-${itemId}`);
    try {
      await runAction(() => api.removeItem(table.id, itemId));
    } finally {
      setBusyKey(null);
    }
  };

  const cancelTable = async (reason: string) => {
    setCancelling(true);
    try {
      const response = await runAction(() => api.cancelTable(table.id, reason));
      if (response) {
        setCancelOpen(false);
        onClose();
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/50 to-transparent px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-xs font-black text-emerald-300">
              {table.number}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-white">{table.name}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] text-slate-500">
                <span className="flex items-center gap-1">
                  <LogIn className="h-3 w-3 text-emerald-500/80" />
                  Entrada {formatClock(session.startTime)}
                </span>
                <span
                  className="flex items-center gap-1"
                  title="Hora de salida y total al corte si cobras la mesa en este momento"
                >
                  <LogOut className="h-3 w-3 text-sky-400/80" />
                  Salida {formatClock(new Date(now))}
                </span>
                <span className="flex items-center gap-1">
                  <UserRound className="h-3 w-3" />
                  {session.openedByName}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="btn-ghost -mr-1 p-1.5" onClick={onClose} aria-label="Cerrar pedido">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-800/80 bg-[#08111d] px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Tiempo jugado
            </p>
            <p className="num text-2xl font-black tracking-tight text-white">{calculation.timer}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Billar ahora
            </p>
            <p className="num text-xl font-bold text-emerald-300">
              {formatMoney(calculation.cost, currency)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>Tarifa {formatMoney(session.ratePerHour, currency)}/h</span>
          <span>Mínimo {formatMoney(minimumCharge, currency)}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <Receipt className="h-3.5 w-3.5" />
            Consumo de la mesa
          </h3>
          <span className="num text-[10px] text-slate-500">
            {plural(
              session.items.reduce((sum, item) => sum + item.quantity, 0),
              'ítem',
              'ítems'
            )}
          </span>
        </div>

        {session.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 px-3 py-4 text-center text-[11px] text-slate-500">
            Sin consumos. Agrega productos desde abajo.
          </div>
        ) : (
          <div className="scroll-thin max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
            {session.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-[#08111d] px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-200">{item.name}</p>
                  <p className="num text-[10px] text-slate-500">
                    {formatMoney(item.price, currency)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-40"
                    onClick={() => removeItem(item.id)}
                    disabled={Boolean(busyKey)}
                    aria-label={`Quitar uno de ${item.name}`}
                  >
                    {item.quantity === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  </button>
                  <span className="num w-5 text-center text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40"
                    onClick={() => {
                      if (item.productId) addProduct(item.productId);
                    }}
                    disabled={Boolean(busyKey) || !item.productId}
                    aria-label={`Agregar uno de ${item.name}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-slate-800/80 pt-3">
          <ProductPicker
            products={products}
            currency={currency}
            selected={selected}
            onPick={(product) => addProduct(product.id)}
            disabled={Boolean(busyKey)}
          />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-slate-800/80 bg-[#0b1422]/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Billar</span>
            <span className="num text-slate-300">{formatMoney(calculation.cost, currency)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Consumo</span>
            <span className="num text-slate-300">{formatMoney(itemsAmount, currency)}</span>
          </div>
          <div className="flex items-end justify-between border-t border-slate-800 pt-1.5">
            <span
              className="text-xs font-bold text-slate-200"
              title="Acumulado hasta este momento; se confirma al cobrar"
            >
              Total al momento
            </span>
            <span className="num text-lg font-black text-emerald-300">
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => onCheckout(table)}
            disabled={Boolean(busyKey)}
          >
            <Receipt className="h-4 w-4" />
            Cobrar mesa
          </button>
          {user?.role === 'admin' ? (
            <button
              type="button"
              className="btn-ghost shrink-0 border border-slate-800 px-2.5 text-rose-400/80 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
              onClick={() => setCancelOpen(true)}
              disabled={Boolean(busyKey)}
              title="Anular mesa"
            >
              <Ban className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <ReasonDialog
        open={cancelOpen}
        title={`Anular ${table.name}`}
        description={
          <span>
            Se cerrará la mesa sin cobrar. Se devolverán al stock los productos cargados y la
            partida quedará registrada en la auditoría.
          </span>
        }
        confirmLabel="Anular mesa"
        placeholder="Explica por qué se anula esta mesa…"
        busy={cancelling}
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancelTable}
      />
    </div>
  );
};
