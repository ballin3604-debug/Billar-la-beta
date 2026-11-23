import React, { useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  CloudOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { APP_VERSION } from '../lib/version';
import { PinPad } from './ui/PinPad';
import { Logo } from './Logo';

const FEATURES = [
  {
    icon: <Wallet className="h-4 w-4" />,
    title: 'Caja clara',
    text: 'Apertura, movimientos y cierre con arqueo ciego.',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Mesas y barra',
    text: 'Tiempo, consumos y cobros en una sola pantalla.',
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: 'Todo auditado',
    text: 'Cada anulación deja nombre, hora y motivo.',
  },
  {
    icon: <CloudOff className="h-4 w-4" />,
    title: 'Sin internet',
    text: 'La información queda en esta computadora.',
  },
];

export const LoginScreen: React.FC = () => {
  const { login, authStatus } = useApp();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || pin.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await login(pin);
    } catch (err) {
      setPin('');
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.12),transparent_26rem),radial-gradient(circle_at_88%_90%,rgba(14,165,233,0.09),transparent_30rem)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="hidden lg:block">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
                Sistema local
              </p>
              <h1 className="text-2xl font-black leading-tight text-white">
                {authStatus.businessName || 'Billar Bar la Beta'}
              </h1>
            </div>
          </div>

          <h2 className="mt-10 max-w-lg text-4xl font-black leading-[1.1] tracking-tight text-white">
            La caja del billar,
            <span className="block text-emerald-400">bajo control.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Controla mesas, consumos y cobros sin depender de internet. Cada turno queda
            cerrado, respaldado y auditado en esta computadora.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-800/80 bg-[#0b1422]/70 px-3.5 py-3 backdrop-blur"
              >
                <div className="flex items-center gap-2 text-emerald-400">
                  {feature.icon}
                  <span className="text-xs font-bold text-slate-200">{feature.title}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{feature.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-2 text-[11px] text-slate-500">
            <BadgeCheck className="h-4 w-4 text-emerald-500/80" />
            <span>Datos guardados localmente · Respaldos automáticos al cerrar caja</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[400px]">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <Logo size="md" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                Sistema local
              </p>
              <h1 className="truncate text-lg font-black text-white">
                {authStatus.businessName || 'Billar Bar la Beta'}
              </h1>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-transparent px-5 pb-4 pt-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="mt-3 text-base font-bold text-white">Ingreso del personal</h2>
              <p className="mt-1 text-xs text-slate-400">Ingresa tu PIN para abrir el turno de trabajo.</p>
            </div>

            <div className="px-5 py-5">
              <PinPad
                value={pin}
                onChange={(next) => {
                  setPin(next);
                  if (error) setError(null);
                }}
                onSubmit={submit}
                busy={busy}
                error={error}
                submitLabel="Entrar al sistema"
              />

              {authStatus.needsSetup ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
                  <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Primer inicio: el PIN temporal del administrador es <strong>1234</strong>.
                    El sistema te pedirá cambiarlo al entrar.
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/80 px-5 py-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="status-dot" />
                Servidor local
              </span>
              <span className="num" title="MVP en etapa de diseño">
                v{APP_VERSION} · MVP
              </span>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-600">
            Acceso solo para personal autorizado. Los intentos fallidos quedan registrados.
          </p>
        </section>
      </div>
    </div>
  );
};
