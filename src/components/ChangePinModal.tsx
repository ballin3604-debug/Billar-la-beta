import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Modal } from './ui/Modal';

interface ChangePinModalProps {
  open: boolean;
  forced?: boolean;
  onClose: () => void;
}

function digits(value: string, max = 6) {
  return value.replace(/\D/g, '').slice(0, max);
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({ open, forced = false, onClose }) => {
  const { changePin, user } = useApp();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setError(null);

    if (currentPin.length < 4) return setError('Ingresa tu PIN actual.');
    if (newPin.length < 4) return setError('El PIN nuevo debe tener entre 4 y 6 dígitos.');
    if (newPin !== confirmPin) return setError('La confirmación no coincide con el PIN nuevo.');
    if (newPin === currentPin) return setError('El PIN nuevo debe ser diferente al actual.');

    setBusy(true);
    try {
      await changePin(currentPin, newPin);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={forced ? 'Crea tu PIN personal' : 'Cambiar mi PIN'}
      subtitle={
        forced
          ? 'El PIN temporal debe reemplazarse antes de continuar.'
          : `Usuario: ${user?.name || ''}`
      }
      icon={<KeyRound className="h-4 w-4" />}
      onClose={forced ? undefined : onClose}
      disableClose={forced || busy}
      size="sm"
      footer={
        <>
          {!forced ? (
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" form="change-pin-form" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar PIN'}
          </button>
        </>
      }
    >
      <form id="change-pin-form" className="space-y-3" onSubmit={submit}>
        {forced ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/90">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Usa el PIN temporal con el que acabas de entrar. Tu PIN nuevo debe ser privado:
              no lo compartas con otros cajeros.
            </span>
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="current-pin">
            PIN actual
          </label>
          <input
            id="current-pin"
            className="input num tracking-[0.3em]"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            value={currentPin}
            autoFocus
            onChange={(event) => setCurrentPin(digits(event.target.value))}
            placeholder="••••"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="new-pin">
              PIN nuevo
            </label>
            <input
              id="new-pin"
              className="input num tracking-[0.3em]"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={newPin}
              onChange={(event) => setNewPin(digits(event.target.value))}
              placeholder="4 a 6 dígitos"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-pin">
              Confirmar
            </label>
            <input
              id="confirm-pin"
              className="input num tracking-[0.3em]"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={confirmPin}
              onChange={(event) => setConfirmPin(digits(event.target.value))}
              placeholder="Repite el PIN"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-slate-500">
            El PIN no puede repetirse entre usuarios. Si lo olvidas, otro administrador puede
            asignarte uno temporal.
          </p>
        )}
      </form>
    </Modal>
  );
};
