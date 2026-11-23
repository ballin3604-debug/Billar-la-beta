import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import type { Product } from '../types';
import { useApp } from '../context/AppContext';
import { formatMoney, plural, sumItems } from '../lib/format';
import { Modal } from './ui/Modal';
import { ProductPicker } from './ui/ProductPicker';
import { CheckoutModal, type CheckoutItem } from './CheckoutModal';
import { EmptyState } from './ui/EmptyState';

interface BarSaleModalProps {
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export const BarSaleModal: React.FC<BarSaleModalProps> = ({ open, onClose, embedded = false }) => {
  const { products, settings } = useApp();
  const currency = settings?.currency || 'Bs';
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    if (!open) {
      setCart({});
      setCheckout(false);
    }
  }, [open]);

  const items = useMemo<CheckoutItem[]>(() => {
    return Object.entries(cart)
      .map(([id, quantity]): CheckoutItem | null => {
        const product = products.find((item) => item.id === Number(id));
        if (!product || quantity <= 0) return null;
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
        };
      })
      .filter((item): item is CheckoutItem => item !== null);
  }, [cart, products]);

  const total = sumItems(items);
  const quantityTotal = items.reduce((sum, item) => sum + item.quantity, 0);

  const add = (product: Product) => {
    setCart((previous) => {
      const current = previous[product.id] || 0;
      if (current >= 99) return previous;
      if (product.stock !== null && current >= Number(product.stock)) return previous;
      return { ...previous, [product.id]: current + 1 };
    });
  };

  const remove = (productId: number) => {
    setCart((previous) => {
      const current = previous[productId] || 0;
      if (current <= 1) {
        const next = { ...previous };
        delete next[productId];
        return next;
      }
      return { ...previous, [productId]: current - 1 };
    });
  };

  if (!open) return null;

  const body = (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_265px]">
      <div>
        <ProductPicker
          products={products}
          currency={currency}
          onPick={add}
          selected={cart}
          emptyText="No hay productos activos. Agrégalos desde Ajustes."
        />
      </div>

      <aside className="flex min-h-[280px] flex-col rounded-xl border border-slate-800 bg-[#08111d]">
        <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Pedido
          </p>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-400">
            {plural(quantityTotal, 'ítem', 'ítems')}
          </span>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-2.5 py-2">
          {items.length === 0 ? (
            <EmptyState
              title="Pedido vacío"
              description="Toca un producto para agregarlo."
              icon={<ShoppingCart className="h-5 w-5" />}
              className="border-0 bg-transparent px-2 py-8"
            />
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-lg border border-slate-800/80 bg-[#0b1422] px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-slate-200">{item.name}</p>
                      <p className="num text-[10px] text-slate-500">
                        {formatMoney(item.price, currency)} c/u
                      </p>
                    </div>
                    <span className="num shrink-0 text-[11px] font-bold text-slate-200">
                      {formatMoney(item.price * item.quantity, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
                        onClick={() => remove(Number(item.productId))}
                        aria-label={`Quitar uno de ${item.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="num w-6 text-center text-xs font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300"
                        onClick={() => {
                          const product = products.find((entry) => entry.id === Number(item.productId));
                          if (product) add(product);
                        }}
                        aria-label={`Agregar uno de ${item.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 px-3.5 py-3">
          <div className="flex items-end justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Total
            </span>
            <span className="num text-lg font-black text-emerald-300">
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );

  const footer = (
    <>
      <div className="mr-auto">
        <p className="text-[9px] uppercase tracking-wider text-slate-500">Total de la venta</p>
        <p className="num text-lg font-black text-emerald-300">{formatMoney(total, currency)}</p>
      </div>
      <button type="button" className="btn-secondary" onClick={() => setCart({})} disabled={items.length === 0}>
        Limpiar
      </button>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setCheckout(true)}
        disabled={items.length === 0}
      >
        <ShoppingCart className="h-4 w-4" />
        Continuar al cobro
      </button>
    </>
  );

  if (checkout) {
    return (
      <CheckoutModal
        open
        mode="bar"
        items={items}
        onClose={() => setCheckout(false)}
        onSuccess={() => {
          setCart({});
          onClose();
        }}
      />
    );
  }

  if (embedded) {
    return (
      <div className="space-y-4">
        {body}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">{footer}</div>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      title="Venta directa"
      subtitle="Cobro inmediato de productos sin abrir una mesa."
      icon={<ShoppingCart className="h-4 w-4" />}
      onClose={() => {
        setCart({});
        onClose();
      }}
      size="xl"
      footer={footer}
    >
      {body}
    </Modal>
  );
};