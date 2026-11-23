import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  LockKeyhole,
  LogIn,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { formatClock, formatDateShort, formatMoney } from '../lib/format';
import { Logo } from './Logo';

const CHECKS = [
  {
    icon: <Banknote className="h-4 w-4" />,
    title: 'Cambio fijo',
    text: 'El encargado define el monto en Ajustes. No se cambia al abrir la caja.',
  },
  {
    icon: <LockKeyhole className="h-4 w-4" />,
    title: 'Cada usuario usa su PIN',
    text: 'Los cobros y anulaciones quedan asociados a la persona que los realizó.',
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: 'Cierra el turno con conteo ciego',
    text: 'Al final se compara el efectivo contado con lo que el sistema registró.',
  },
];

export const OpenShiftScreen: React.FC = () => {
  const { settings, runAction, user, attendanceToday } = useApp();
  const initialCash = settings?.defaultInitialCash ?? 0;
  const [busy, setBusy] = useState(false);

  const currency = settings?.currency || 'Bs';
  const parsedCash = Number(initialCash || 0);

  const openShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runAction(() => api.openShift(parsedCash));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center py-2">
      <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="panel relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <Logo size="md" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  {settings?.businessName || 'Billar Bar la Beta'}
                </p>
                <p className="text-xs text-slate-400">Apertura del turno</p>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Caja cerrada
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Abre la caja para empezar
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Hola, {user?.name}. Antes de iniciar mesas o vender en la barra, abre la caja con el
              fondo fijo definido por el encargado. El turno quedará a nombre de todos los usuarios
              que operen con su PIN.
            </p>
            {attendanceToday ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-sky-200/90">
                <LogIn className="h-4 w-4" />
                Tu entrada quedó registrada a las {formatClock(attendanceToday.checkInAt)}
              </div>
            ) : null}

            <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
              {CHECKS.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-800 bg-[#08111d] p-3">
                  <div className="text-emerald-400">{item.icon}</div>
                  <p className="mt-2 text-[11px] font-bold text-slate-200">{item.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDateShort(new Date())}
              </span>
              <span className="flex items-center gap-1.5">
                <ReceiptText className="h-3.5 w-3.5" />
                Tarifa por hora: {formatMoney(settings?.defaultRatePerHour, currency)}
              </span>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                Respaldo automático al cerrar
              </span>
            </div>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-800/80 px-5 py-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <WalletCards className="h-4 w-4" />
              <h2 className="text-sm font-bold text-white">Cambio de caja</h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Monto fijo definido por el encargado en Información general.
            </p>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div>
              <label className="label" htmlFor="initial-cash">
                Efectivo inicial ({currency})
              </label>
              <div className="relative">
                <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="initial-cash"
                  className="input num cursor-not-allowed pl-9 text-lg font-bold opacity-80"
                  inputMode="decimal"
                  value={String(initialCash)}
                  readOnly
                />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                El monto solo se puede cambiar desde{' '}
                <strong className="text-slate-300">Ajustes &gt; Información general</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#08111d] px-3 py-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Fondo que se registrará</span>
                <span className="num text-base font-bold text-emerald-300">
                  {formatMoney(parsedCash, currency)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary w-full py-2.5"
              onClick={openShift}
              disabled={busy}
            >
              {busy ? 'Abriendo caja…' : 'Abrir caja y comenzar'}
              {!busy ? <ArrowRight className="h-4 w-4" /> : null}
            </button>

            <p className="text-center text-[10px] leading-relaxed text-slate-600">
              Si el monto no es correcto, avisa al encargado para que lo actualice en
              Ajustes &gt; Información general.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
