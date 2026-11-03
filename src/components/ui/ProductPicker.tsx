import React, { useMemo, useState } from 'react';
import { PackageSearch, Search, Star } from 'lucide-react';
import type { Product } from '../../types';
import { cn, formatMoney, productCategoryLabel } from '../../lib/format';

interface ProductPickerProps {
  products: Product[];
  currency?: string;
  onPick: (product: Product) => void;
  selected?: Record<number, number>;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}

const CATEGORIES = ['todos', 'cervezas', 'bebidas', 'snacks', 'multas', 'otros'] as const;

/**
 * Buscador de productos compartido por las mesas y la venta de barra.
 * Muestra favoritos, stock y la cantidad ya agregada al pedido.
 */
export const ProductPicker: React.FC<ProductPickerProps> = ({
  products,
  currency = 'Bs',
  onPick,
  selected = {},
  disabled = false,
  className = '',
  emptyText = 'No hay productos que coincidan con la búsqueda.',
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('todos');

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const categories = useMemo(
    () =>
      CATEGORIES.filter((item) => {
        if (item === 'todos') return true;
        return activeProducts.some((product) => product.category === item);
      }),
    [activeProducts]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return activeProducts.filter((product) => {
      if (category !== 'todos' && product.category !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        productCategoryLabel(product.category).toLowerCase().includes(term)
      );
    });
  }, [activeProducts, category, query]);

  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-8"
          value={query}
          placeholder="Buscar producto…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="scroll-thin mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              'chip shrink-0 whitespace-nowrap',
              category === item && 'chip-active'
            )}
          >
            {item === 'todos' ? 'Todos' : productCategoryLabel(item)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800 px-4 py-7 text-center">
          <PackageSearch className="h-6 w-6 text-slate-600" />
          <p className="text-xs text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {filtered.map((product) => {
            const quantity = selected[product.id] || 0;
            const outOfStock = product.stock !== null && product.stock <= 0;
            const limitReached =
              product.stock !== null && !outOfStock && quantity >= Number(product.stock);
            const unavailable = disabled || outOfStock || limitReached;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onPick(product)}
                disabled={unavailable}
                className={cn(
                  'group relative flex min-h-[62px] flex-col justify-between rounded-xl border border-slate-800 bg-[#08111d] p-2.5 text-left transition',
                  unavailable
                    ? 'cursor-not-allowed opacity-45'
                    : 'hover:border-emerald-500/50 hover:bg-emerald-500/[0.06] active:scale-[0.98]'
                )}
              >
                <div className="flex w-full items-start justify-between gap-1.5">
                  <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-200">
                    {product.name}
                  </span>
                  {product.favorite ? (
                    <Star className="mt-0.5 h-3 w-3 shrink-0 fill-amber-400/80 text-amber-400/80" />
                  ) : null}
                </div>
                <div className="mt-1.5 flex w-full items-end justify-between gap-2">
                  <span className="num text-[11px] font-bold text-emerald-300">
                    {formatMoney(product.price, currency)}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-medium',
                      outOfStock ? 'text-rose-400' : 'text-slate-500'
                    )}
                  >
                    {product.stock === null
                      ? 'Disponible'
                      : outOfStock
                      ? 'Sin stock'
                      : `Stock ${product.stock}`}
                  </span>
                </div>
                {quantity > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-slate-950 shadow">
                    {quantity}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
