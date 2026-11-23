import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  Info,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import type { TransferDirection } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { cn, formatMoney } from '../lib/format';
import { Modal } from './ui/Modal';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const parseDecimal = (value: string) => {
  const numeric = Number(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
};

export const TransferModal: React.FC<TransferModalProps> = ({ open, onClose }) => {
  const { settings, runAction } = useApp();
  const currency = settings?.currency || 'Bs';
  const [direction, setDirection] = useState<TransferDirection>('qr_to_cash');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDirection('qr_to_cash');
      setAmount('');
      setConcept('');
      setReference('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const numericAmount = useMemo(() => round2(parseDecimal(amount)), [amount]);
  const cashEffect = direction === 'qr_to_cash' ? -numericAmount : numericAmount;
  const cashEffectLabel =
    cashEffect < 0
      ? `El efectivo esperado baja ${formatMoney(Math.abs(cashEffect), currency)}`
      : `El efectivo esperado sube ${formatMoney(cashEffect, currency)}`;

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setError(null);

    if (!(numericAmount > 0)) {
      return setError('Ingresa un monto mayor a cero.');
    }
    if (concept.trim().length < 2) {
      return setError('Describe el motivo o el cliente del traspaso.');
    }

    setBusy(true);
    try {
      const response = await runAction(() =>
        api.createTransfer({
          direction,
          amount: numericAmount,
          concept: concept.trim(),
          reference: reference.trim() || undefined,
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
      title="Traspaso QR ↔ efectivo"
      subtitle="Intercambio de dinero entre la gaveta y la cuenta QR. No cuenta como venta ni como gasto."
      icon={<ArrowLeftRight className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="transfer-form" className="btn-primary" disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar traspaso'}
          </button>
        </>
      }
    >
      <form id="transfer-form" className="space-y-4" onSubmit={submit}>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setDirection('qr_to_cash')}
            className={cn(
              'rounded-xl border p-3 text-left transition',
              direction === 'qr_to_cash'
                ? 'border-amber-500/45 bg-amber-500/[0.08]'
                : 'border-slate-800 bg-[#08111d] hover:border-slate-700'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 text-amber-300">
                <QrCode className="h-4 w-4" />
                <ArrowLeftRight className="h-3.5 w-3.5 text-slate-500" />
                <Banknote className="h-4 w-4" />
              </span>
              <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                − efectivo
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-white">Entregar efectivo</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              El cliente paga por QR y recibe efectivo de la gaveta.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDirection('cash_to_qr')}
            className={cn(
              'rounded-xl border p-3 text-left transition',
              direction === 'cash_to_qr'
                ? 'border-emerald-500/45 bg-emerald-500/[0.08]'
                : 'border-slate-800 bg-[#08111d] hover:border-slate-700'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <Banknote className="h-4 w-4" />
                <ArrowLeftRight className="h-3.5 w-3.5 text-slate-500" />
                <QrCode className="h-4 w-4" />
              </span>
              <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                + efectivo
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-white">Entregar QR</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              El cliente paga en efectivo y recibe una transferencia QR.
            </p>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="transfer-amount">
              Monto
            </label>
            <div className="relative">
              <input
                id="transfer-amount"
                className="input num pr-14 text-lg font-bold"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d*[.,]?\d{0,2}$/.test(value)) setAmount(value);
                }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                {currency}
              </span>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="transfer-concept">
              Concepto / cliente
            </label>
            <input
              id="transfer-concept"
              className="input"
              maxLength={120}
              placeholder="Ej.: cliente de la mesa 3"
              value={concept}
              onChange={(event) => setConcept(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="transfer-reference">
            Referencia QR <span className="font-normal text-slate-600">(opcional)</span>
          </label>
          <input
            id="transfer-reference"
            className="input"
            maxLength={80}
            placeholder="N° de operación o nombre del destinatario"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>

        <div
          className={cn(
            'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[11px] leading-relaxed',
            cashEffect < 0
              ? 'border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90'
              : 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200/90'
          )}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">{numericAmount > 0 ? cashEffectLabel : 'Efecto en el cierre'}</p>
            <p className="mt-0.5">
              {numericAmount > 0
                ? 'El monto se descuenta o suma al efectivo esperado del turno, pero no altera las ventas.'
                : 'Indica el monto para ver cómo se ajustará el efectivo esperado del turno.'}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2 text-[10px] leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
            El traspaso queda en auditoría con usuario, hora y motivo. Solo el administrador puede
            anularlo.
          </div>
        )}
      </form>
    </Modal>
  );
};
