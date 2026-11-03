import React, { useState } from 'react';
import { LogOut, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PinPad } from './ui/PinPad';
import { Logo } from './Logo';
import { formatClock } from '../lib/format';

export const LockScreen: React.FC = () => {
  const { user, unlock, logout, settings } = useApp();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const submit = async () => {
    if (busy || pin.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await unlock(pin);
      setPin('');
    } catch (err) {
      setPin('');
      setError(err instanceof Error ? err.message : 'No se pudo desbloquear.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.12),transparent_28rem)]" />
      <div className="relative w-full max-w-[390px]">
        <div className="mb-5 flex items-center justify-center gap-3">
          <Logo size="md" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400">
              {settings?.businessName || 'Billar & Bar'}
            </p>
            <p className="text-sm font-bold text-white">Sistema de caja</p>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-800/80 px-5 py-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-300">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-base font-bold text-white">Pantalla bloqueada</h1>
            <p className="mt-1 text-xs text-slate-400">
              {user?.name} · {formatClock(new Date())}
            </p>
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
              submitLabel="Desbloquear"
            />
          </div>

          <div className="border-t border-slate-800/80 px-5 py-3">
            <button
              type="button"
              className="btn-ghost w-full justify-center text-xs"
              disabled={busy || leaving}
              onClick={async () => {
                setLeaving(true);
                await logout();
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              {leaving ? 'Cerrando…' : 'Cerrar sesión y cambiar de usuario'}
            </button>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Se bloquea automáticamente para proteger la caja.
        </p>
      </div>
    </div>
  );
};
