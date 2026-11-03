import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock3,
  QrCode,
  Receipt,
  Split,
  Timer,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { PaymentMethod, Table } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  calculateSession,
  formatClock,
  formatMoney,
  paymentLabel,
  plural,
  sumItems,
} from '../lib/format';
import { useNow } from '../lib/useNow';
import {
  findNewPlay,
  findNewSale,
  playToReceipt,
  saleToReceipt,
} from '../lib/receipt';
import { Modal } from './ui/Modal';
import { cn } from '../lib/format';

export interface CheckoutItem {
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutModalProps {
  open: boolean;
  mode: 'table' | 'bar';
  table?: Table | null;
  items: CheckoutItem[];
  onClose: () => void;
  onSuccess?: () => void;
}

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  mode,
  table,
  items,
  onClose,
  onSuccess,
}) => {
  const { user, settings, clockOffset, runAction, showReceipt } = useApp();
  const now = useNow(clockOffset);
  const currency = settings?.currency || 'Bs';
  const minimumCharge = Number(settings?.minimumPlayCharge || 0);

  const session = mode === 'table' ? table?.activeSession ?? null : null;
  const liveCalculation = session
    ? calculateSession(session.startTime, session.ratePerHour, minimumCharge, now)
    : null;
  const liveBilliard = liveCalculation?.cost ?? 0;

  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [manualBilliard, setManualBilliard] = useState(false);
  const [billiardInput, setBilliardInput] = useState('0');
  const [cashReceived, setCashReceived] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [qrReference, setQrReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod('efectivo');
    setManualBilliard(false);
    setBilliardInput(String(liveBilliard));
    setCashReceived('');
    setMixedCash('');
    setQrReference('');
    setNotes('');
    setError(null);
    setBusy(false);
    // El cálculo se reinicia solo al abrir el cobro para no pisar ajustes manuales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, table?.id]);

  useEffect(() => {
    if (open && !manualBilliard) setBilliardInput(String(liveBilliard));
  }, [liveBilliard, manualBilliard, open]);

  const productsAmount = useMemo(() => sumItems(items), [items]);
  const billiardAmount = mode === 'table'
    ? manualBilliard
      ? round2(Number(billiardInput.replace(',', '.')) || 0)
      : liveBilliard
    : 0;
  const total = round2(billiardAmount + productsAmount);

  const parsedMixedCash = round2(Number(mixedCash.replace(',', '.')) || 0);
  const mixedQr = round2(total - parsedMixedCash);
  const mixedValid = parsedMixedCash > 0 && parsedMixedCash < total;
  const received = Number(cashReceived.replace(',', '.')) || 0;
  const change = received > 0 ? round2(received - total) : 0;

  const setNumeric = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (/^\d*[.,]?\d{0,2}$/.test(value)) setter(value);
  };

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (mode === 'table' && !session) {
      return setError('La mesa ya no tiene una partida abierta.');
    }
    if (mode === 'bar' && items.length === 0) {
      return setError('Agrega al menos un producto a la venta.');
    }
    if (total <= 0) {
      return setError('El total a cobrar debe ser mayor a cero.');
    }
    if (mode === 'table' && billiardAmount < 0) {
      return setError('El monto de billar no puede ser negativo.');
    }
    if (method === 'mixto' && !mixedValid) {
      return setError('En el pago mixto, el efectivo debe ser mayor a 0 y menor al total.');
    }
    if (method === 'efectivo' && cashReceived.trim() && received < total) {
      return setError('El efectivo recibido no alcanza el total a cobrar.');
    }

    setBusy(true);
    try {
      let response;
      if (mode === 'table' && table) {
        response = await runAction(() =>
          api.chargeTable(table.id, {
            paymentMethod: method,
            ...(manualBilliard && user?.role === 'admin' ? { billiardAmount } : {}),
            ...(method === 'mixto' ? { cashAmount: parsedMixedCash } : {}),
            ...(method !== 'efectivo' && qrReference.trim()
              ? { qrReference: qrReference.trim() }
              : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          })
        );
      } else {
        const saleItems = items
          .filter((item) => item.productId !== null)
          .map((item) => ({
            productId: Number(item.productId),
            quantity: item.quantity,
          }));
        response = await runAction(() =>
          api.sale({
            items: saleItems,
            paymentMethod: method,
            ...(method === 'mixto' ? { cashAmount: parsedMixedCash } : {}),
            ...(method !== 'efectivo' && qrReference.trim()
              ? { qrReference: qrReference.trim() }
              : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          })
        );
      }

      if (response) {
        const receiptSettings = settings ?? {
          businessName: 'Billar & Bar',
          currency,
          defaultRatePerHour: 0,
          minimumPlayCharge: 0,
          autoLockMinutes: 0,
        };
        const cashTendered = method === 'efectivo' && received > 0 ? received : undefined;

        if (mode === 'table' && table) {
          const play = findNewPlay(response.state, table.id);
          if (play) showReceipt(playToReceipt(play, receiptSettings, cashTendered));
        } else {
          const sale = findNewSale(response.state);
          if (sale) showReceipt(saleToReceipt(sale, receiptSettings, cashTendered));
        }

        onSuccess?.();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const methods: Array<{ id: PaymentMethod; label: string; icon: React.ReactNode; hint: string }> = [
    { id: 'efectivo', label: 'Efectivo', icon: <Banknote className="h-4 w-4" />, hint: 'Gaveta' },
    { id: 'qr', label: 'QR', icon: <QrCode className="h-4 w-4" />, hint: 'Transferencia' },
    { id: 'mixto', label: 'Mixto', icon: <Split className="h-4 w-4" />, hint: 'Efectivo + QR' },
  ];

  return (
    <Modal
      open={open}
      title={mode === 'table' ? `Cobrar ${table?.name || 'mesa'}` : 'Cobrar venta de barra'}
      subtitle={
        mode === 'table'
          ? `Cierre de partida · ${total > 0 ? formatMoney(total, currency) : 'Sin consumo'}`
          : plural(
              items.reduce((sum, item) => sum + item.quantity, 0),
              'producto',
              'productos'
            )
      }
      icon={<Receipt className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="xl"
      footer={
        <>
          <div className="mr-auto hidden items-center gap-2 text-[10px] text-slate-500 sm:flex">
            <UserRound className="h-3.5 w-3.5" />
            Se registrará a nombre de{' '}
            <strong className="text-slate-300">{user?.name}</strong>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy || total <= 0}>
            {busy ? 'Procesando…' : `Cobrar ${formatMoney(total, currency)}`}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-[#08111d] p-3.5">
            {mode === 'table' && session && liveCalculation ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {table?.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span className="text-slate-500">Entrada</span>
                      <span className="num text-slate-300">{formatClock(session.startTime)}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-slate-500">Salida</span>
                      <span className="num text-slate-300">{formatClock(new Date(now))}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-2.5 py-1 text-right">
                    <p className="num text-sm font-bold text-white">{liveCalculation.timer}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Tiempo</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <div>
                    <p className="text-[11px] text-slate-400">Billar</p>
                    <p className="text-[9px] text-slate-600">
                      Calculado a {formatMoney(session.ratePerHour, currency)}/h
                    </p>
                  </div>
                  {user?.role === 'admin' ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        className="input-compact num w-24 text-right"
                        inputMode="decimal"
                        value={manualBilliard ? billiardInput : String(liveBilliard)}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!/^\d*[.,]?\d{0,2}$/.test(value)) return;
                          setManualBilliard(true);
                          setBilliardInput(value);
                        }}
                      />
                      <span className="text-[10px] text-slate-500">{currency}</span>
                    </div>
                  ) : (
                    <p className="num text-sm font-bold text-emerald-300">
                      {formatMoney(liveBilliard, currency)}
                    </p>
                  )}
                </div>
                {user?.role === 'admin' ? (
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] text-slate-600">
                      {manualBilliard ? 'Monto ajustado manualmente' : 'Tarifa automática'}
                    </span>
                    {manualBilliard ? (
                      <button
                        type="button"
                        className="text-[9px] font-semibold text-sky-400 hover:text-sky-300"
                        onClick={() => {
                          setManualBilliard(false);
                          setBilliardInput(String(liveBilliard));
                        }}
                      >
                        Volver al cálculo
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Venta de barra
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">Productos para llevar o consumo en barra.</p>
                </div>
                <Timer className="h-5 w-5 text-slate-600" />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#08111d]">
            <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Detalle
              </p>
              <span className="text-[10px] text-slate-500">
                {plural(
                  items.reduce((sum, item) => sum + item.quantity, 0),
                  'ítem',
                  'ítems'
                )}
              </span>
            </div>
            <div className="scroll-thin max-h-44 overflow-y-auto px-3.5 py-2">
              {items.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-slate-500">Sin productos cargados.</p>
              ) : (
                items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex items-center justify-between gap-3 border-b border-slate-800/60 py-1.5 last:border-0"
                  >
                    <span className="min-w-0 truncate text-[11px] text-slate-300">
                      <span className="num mr-1 text-slate-500">{item.quantity}×</span>
                      {item.name}
                    </span>
                    <span className="num shrink-0 text-[11px] font-semibold text-slate-300">
                      {formatMoney(item.price * item.quantity, currency)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5">
            <div className="space-y-1.5 text-[11px]">
              {mode === 'table' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Billar</span>
                    <span className="num text-slate-300">{formatMoney(billiardAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Consumo</span>
                    <span className="num text-slate-300">{formatMoney(productsAmount, currency)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-500">Productos</span>
                  <span className="num text-slate-300">{formatMoney(productsAmount, currency)}</span>
                </div>
              )}
              <div className="flex items-end justify-between border-t border-emerald-500/20 pt-2">
                <span className="text-xs font-bold text-slate-200">Total a cobrar</span>
                <span className="num text-xl font-black text-emerald-300">
                  {formatMoney(total, currency)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="label">Forma de pago</p>
            <div className="grid grid-cols-3 gap-1.5">
              {methods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMethod(item.id);
                    setError(null);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5 transition',
                    method === item.id
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-[#08111d] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  )}
                >
                  {item.icon}
                  <span className="text-[10px] font-bold">{item.label}</span>
                  <span className="text-[8px] text-slate-500">{item.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {method === 'efectivo' ? (
            <div className="rounded-xl border border-slate-800 bg-[#08111d] p-3.5">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <p className="text-xs font-bold text-slate-200">Efectivo recibido</p>
              </div>
              <div className="mt-2 flex gap-1.5">
                <input
                  className="input num text-base font-bold"
                  inputMode="decimal"
                  placeholder={`Ej. ${total}`}
                  value={cashReceived}
                  onChange={setNumeric(setCashReceived)}
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0 px-2.5 text-[10px]"
                  onClick={() => setCashReceived(String(total))}
                >
                  Exacto
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Vuelto</span>
                <span className={cn('num font-bold', change > 0 ? 'text-sky-300' : 'text-slate-500')}>
                  {formatMoney(Math.max(0, change), currency)}
                </span>
              </div>
            </div>
          ) : null}

          {method === 'mixto' ? (
            <div className="rounded-xl border border-slate-800 bg-[#08111d] p-3.5">
              <div className="flex items-center gap-2">
                <Split className="h-4 w-4 text-violet-400" />
                <p className="text-xs font-bold text-slate-200">Reparto del pago</p>
              </div>
              <div className="mt-2 space-y-2">
                <div>
                  <label className="label" htmlFor="mixed-cash">
                    Parte en efectivo
                  </label>
                  <input
                    id="mixed-cash"
                    className="input num"
                    inputMode="decimal"
                    placeholder="0"
                    value={mixedCash}
                    onChange={setNumeric(setMixedCash)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070d16] px-2.5 py-2">
                  <span className="text-[10px] text-slate-500">Parte por QR</span>
                  <span className={cn('num text-sm font-bold', mixedValid ? 'text-sky-300' : 'text-rose-300')}>
                    {formatMoney(Math.max(0, mixedQr), currency)}
                  </span>
                </div>
                {!mixedValid && mixedCash ? (
                  <p className="text-[10px] text-rose-400">
                    El efectivo debe ser mayor a 0 y menor al total.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {method !== 'efectivo' ? (
            <div>
              <label className="label" htmlFor="qr-reference">
                Referencia / comprobante QR <span className="font-normal text-slate-600">(opcional)</span>
              </label>
              <input
                id="qr-reference"
                className="input"
                maxLength={80}
                placeholder="Últimos dígitos o nota de la transferencia"
                value={qrReference}
                onChange={(event) => setQrReference(event.target.value)}
              />
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="checkout-notes">
              Nota <span className="font-normal text-slate-600">(opcional)</span>
            </label>
            <textarea
              id="checkout-notes"
              className="input min-h-16 resize-none"
              maxLength={300}
              placeholder="Observación del cobro…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
              {error}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2 text-[10px] leading-relaxed text-slate-500">
              <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500/80" />
              Revisa el monto antes de confirmar. El movimiento quedará registrado en el turno.
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2 text-[10px]">
            <span className="text-slate-500">Se cobrará como</span>
            <span className="font-bold text-slate-300">
              {method === 'mixto' ? 'Mixto (efectivo + QR)' : paymentLabel(method)}
            </span>
          </div>
        </section>
      </div>
    </Modal>
  );
};
