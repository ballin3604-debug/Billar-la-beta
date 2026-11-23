import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { formatClock, formatMoney, plural, sumItems } from '../lib/format';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { Modal } from './ui/Modal';
import { ProductPicker } from './ui/ProductPicker';
import { CheckoutModal, type CheckoutItem } from './CheckoutModal';

interface CustomerTabsModalProps {
  open: boolean;
  onClose: () => void;
}

export const CustomerTabsModal: React.FC<CustomerTabsModalProps> = ({ open, onClose }) => {
  const { customerTabs, products, settings, user, runAction, handleError } = useApp();
  const currency = settings?.currency || 'Bs';
  const isAdmin = user?.role === 'admin';

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setNewName('');
      setCreating(false);
      setBusyKey(null);
      setCheckoutOpen(false);
      setCancelOpen(false);
      setCancelReason('');
      setCancelBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (selectedId && !customerTabs.some((tab) => tab.id === selectedId)) {
      setSelectedId(customerTabs[0]?.id ?? null);
    }
    if (!selectedId && customerTabs.length > 0) {
      setSelectedId(customerTabs[0].id);
    }
  }, [open, selectedId, customerTabs]);

  const selectedTab = useMemo(
    () => customerTabs.find((tab) => tab.id === selectedId) ?? null,
    [customerTabs, selectedId]
  );

  const checkoutItems = useMemo<CheckoutItem[]>(
    () =>
      (selectedTab?.items ?? []).map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    [selectedTab]
  );

  const selectedQuantities = useMemo(
    () =>
      Object.fromEntries(
        (selectedTab?.items ?? [])
          .filter((item) => item.productId !== null)
          .map((item) => [Number(item.productId), Number(item.quantity)])
      ),
    [selectedTab]
  );

  const createTab = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const name = newName.trim();
    if (name.length < 2) return;
    setCreating(true);
    try {
      const response = await runAction(() => api.openCustomerTab(name));
      if (response) {
        setNewName('');
        const tabs = response.state?.customerTabs ?? [];
        const created = [...tabs].reverse().find((tab) => tab.customerName === name);
        if (created) setSelectedId(created.id);
      }
    } finally {
      setCreating(false);
    }
  };

  const addProduct = async (productId: number) => {
    if (!selectedTab || busyKey) return;
    setBusyKey(`add-${productId}`);
    try {
      await runAction(() => api.addCustomerTabItem(selectedTab.id, productId, 1));
    } finally {
      setBusyKey(null);
    }
  };

  const removeItem = async (itemId: number) => {
    if (!selectedTab || busyKey) return;
    setBusyKey(`remove-${itemId}`);
    try {
      await runAction(() => api.removeCustomerTabItem(selectedTab.id, itemId));
    } finally {
      setBusyKey(null);
    }
  };

  const cancelTab = async () => {
    if (!selectedTab || cancelBusy) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) return;
    setCancelBusy(true);
    try {
      const response = await runAction(() => api.cancelCustomerTab(selectedTab.id, reason));
      if (response) {
        setCancelOpen(false);
        setCancelReason('');
        setSelectedId(null);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setCancelBusy(false);
    }
  };

  if (!open) return null;

  const totalOpen = customerTabs.reduce((sum, tab) => sum + Number(tab.itemsAmount || 0), 0);

  return (
    <>
      <Modal
        open={open}
        title="Ventas por cliente"
        subtitle="Cuentas abiertas para clientes que consumen de a poco y pagan al final."
        icon={<Users className="h-4 w-4" />}
        onClose={onClose}
        size="xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[10px] text-slate-500">
              {plural(customerTabs.length, 'cuenta abierta', 'cuentas abiertas')} ·{' '}
              <span className="num font-semibold text-slate-300">{formatMoney(totalOpen, currency)}</span>
            </p>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <form onSubmit={createTab} className="rounded-xl border border-slate-800 bg-[#08111d] p-3">
              <p className="label mb-2">Nueva cuenta</p>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={newName}
                  maxLength={60}
                  placeholder="Nombre del cliente"
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button
                  type="submit"
                  className="btn-primary shrink-0 px-3"
                  disabled={creating || newName.trim().length < 2}
                  title="Abrir cuenta"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Anota el nombre y agrega productos a medida que consuma.
              </p>
            </form>

            <div className="rounded-xl border border-slate-800 bg-[#08111d]">
              <div className="border-b border-slate-800 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Cuentas abiertas
                </p>
              </div>
              <div className="scroll-thin max-h-[420px] overflow-y-auto p-2">
                {customerTabs.length === 0 ? (
                  <EmptyState
                    title="Sin cuentas abiertas"
                    description="Crea una cuenta para empezar a acumular el consumo de un cliente."
                    icon={<Users className="h-5 w-5" />}
                    className="border-0 bg-transparent px-2 py-8"
                  />
                ) : (
                  <div className="space-y-1.5">
                    {customerTabs.map((tab) => {
                      const active = tab.id === selectedId;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSelectedId(tab.id)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                            active
                              ? 'border-emerald-500/45 bg-emerald-500/[0.08]'
                              : 'border-slate-800 bg-[#0b1422] hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-slate-200">
                                {tab.customerName}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                                <Clock3 className="h-3 w-3" />
                                {formatClock(tab.createdAt)}
                                <span className="text-slate-700">·</span>
                                {plural(
                                  tab.items.reduce((sum, item) => sum + item.quantity, 0),
                                  'ítem',
                                  'ítems'
                                )}
                              </p>
                            </div>
                            <span className="num shrink-0 text-[11px] font-bold text-emerald-300">
                              {formatMoney(tab.itemsAmount, currency)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0 rounded-xl border border-slate-800 bg-[#08111d]">
            {!selectedTab ? (
              <div className="flex h-full min-h-[320px] items-center justify-center p-6">
                <EmptyState
                  title="Selecciona una cuenta"
                  description="Elige una cuenta abierta o crea una nueva para agregar productos."
                  icon={<ShoppingBag className="h-5 w-5" />}
                  className="border-0 bg-transparent px-2 py-8"
                />
              </div>
            ) : (
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="border-b border-slate-800 p-3 xl:border-b-0 xl:border-r">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{selectedTab.customerName}</p>
                      <p className="text-[10px] text-slate-500">
                        Abierta {formatClock(selectedTab.createdAt)} · por {selectedTab.openedByName}
                      </p>
                    </div>
                    <span className="num rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">
                      {formatMoney(selectedTab.itemsAmount, currency)}
                    </span>
                  </div>

                  <ProductPicker
                    products={products}
                    currency={currency}
                    onPick={(product) => void addProduct(product.id)}
                    selected={selectedQuantities}
                    disabled={Boolean(busyKey)}
                    emptyText="No hay productos activos para agregar a la cuenta."
                  />
                </div>

                <div className="flex min-h-[320px] flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Consumo acumulado
                    </p>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                      {plural(
                        selectedTab.items.reduce((sum, item) => sum + item.quantity, 0),
                        'ítem',
                        'ítems'
                      )}
                    </span>
                  </div>

                  <div className="scroll-thin flex-1 overflow-y-auto px-2.5 py-2">
                    {selectedTab.items.length === 0 ? (
                      <EmptyState
                        title="Cuenta sin consumo"
                        description="Agrega productos desde el catálogo."
                        icon={<ShoppingBag className="h-5 w-5" />}
                        className="border-0 bg-transparent px-2 py-8"
                      />
                    ) : (
                      <div className="space-y-1.5">
                        {selectedTab.items.map((item) => (
                          <div
                            key={item.id}
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
                            <div className="mt-1.5 flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-40"
                                onClick={() => void removeItem(item.id)}
                                disabled={Boolean(busyKey)}
                                aria-label={`Quitar uno de ${item.name}`}
                                title="Quitar 1"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="num w-6 text-center text-xs font-bold text-white">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40"
                                onClick={() => {
                                  if (item.productId !== null) void addProduct(item.productId);
                                }}
                                disabled={(() => {
                                  if (Boolean(busyKey) || item.productId === null) return true;
                                  const product = products.find((entry) => entry.id === item.productId);
                                  if (!product) return true;
                                  if (product.stock !== null && item.quantity >= Number(product.stock)) return true;
                                  return false;
                                })()}
                                aria-label={`Agregar uno de ${item.name}`}
                                title="Agregar 1"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-800 px-3.5 py-3">
                    <div className="mb-3 flex items-end justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Total a cobrar
                      </span>
                      <span className="num text-lg font-black text-emerald-300">
                        {formatMoney(sumItems(checkoutItems), currency)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {isAdmin ? (
                        <button
                          type="button"
                          className="btn-danger px-3"
                          onClick={() => setCancelOpen(true)}
                          disabled={Boolean(busyKey)}
                          title="Anular cuenta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-primary flex-1"
                        onClick={() => setCheckoutOpen(true)}
                        disabled={checkoutItems.length === 0 || Boolean(busyKey)}
                      >
                        <Receipt className="h-4 w-4" />
                        Cobrar cuenta
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </Modal>

      <CheckoutModal
        open={checkoutOpen && Boolean(selectedTab)}
        mode="customer"
        customerTabId={selectedTab?.id ?? null}
        customerName={selectedTab?.customerName}
        items={checkoutItems}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={() => {
          setCheckoutOpen(false);
          setSelectedId(null);
        }}
      />

      <ConfirmDialog
        open={cancelOpen && Boolean(selectedTab)}
        title={`Anular cuenta de ${selectedTab?.customerName || 'cliente'}?`}
        message={
          <div className="space-y-3">
            <p>
              Se anulará la cuenta abierta y se devolverá el stock de los productos. Esta acción queda
              registrada en auditoría.
            </p>
            <div>
              <label className="label" htmlFor="customer-tab-cancel-reason">
                Motivo de anulación
              </label>
              <textarea
                id="customer-tab-cancel-reason"
                className="input min-h-[88px] resize-y"
                value={cancelReason}
                maxLength={200}
                placeholder="Ejemplo: cliente se retiró, error al abrir cuenta..."
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </div>
          </div>
        }
        confirmLabel="Anular cuenta"
        cancelLabel="Volver"
        busy={cancelBusy}
        tone="danger"
        onCancel={() => {
          if (cancelBusy) return;
          setCancelOpen(false);
          setCancelReason('');
        }}
        onConfirm={() => void cancelTab()}
      />
    </>
  );
};