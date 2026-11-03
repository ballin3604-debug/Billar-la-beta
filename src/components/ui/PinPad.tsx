import React, { useEffect, useState } from 'react';
import { Check, Delete, Loader2 } from 'lucide-react';
import { cn } from '../../lib/format';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  submitLabel?: string;
  footer?: React.ReactNode;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const PinPad: React.FC<PinPadProps> = ({
  value,
  onChange,
  onSubmit,
  maxLength = 6,
  busy = false,
  disabled = false,
  error,
  submitLabel = 'Ingresar',
  footer,
}) => {
  const [pressed, setPressed] = useState<string | null>(null);

  const canSubmit = value.length >= 4 && !busy && !disabled;

  const append = (digit: string) => {
    if (disabled || busy || value.length >= maxLength) return;
    onChange(value + digit);
    setPressed(digit);
    window.setTimeout(() => setPressed(null), 110);
  };

  const backspace = () => {
    if (disabled || busy) return;
    onChange(value.slice(0, -1));
  };

  const submit = () => {
    if (canSubmit) onSubmit();
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (disabled || busy) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        append(event.key);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-center gap-2.5" aria-label="PIN ingresado">
        {Array.from({ length: maxLength }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-3 w-3 rounded-full border transition-all',
              index < value.length
                ? 'border-emerald-400 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                : 'border-slate-600 bg-slate-800/60'
            )}
          />
        ))}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-center text-xs font-medium text-rose-300">
          {error}
        </div>
      ) : (
        <div className="mb-3 h-8" />
      )}

      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => append(digit)}
            disabled={disabled || busy || value.length >= maxLength}
            className={cn('key-button', pressed === digit && 'border-emerald-500 bg-emerald-500/15')}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          onClick={backspace}
          disabled={disabled || busy || value.length === 0}
          className="key-button text-slate-400"
          aria-label="Borrar último dígito"
        >
          <Delete className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => append('0')}
          disabled={disabled || busy || value.length >= maxLength}
          className={cn('key-button', pressed === '0' && 'border-emerald-500 bg-emerald-500/15')}
        >
          0
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex h-14 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
          aria-label={submitLabel}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-3 w-full rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-600/20 disabled:opacity-40"
      >
        {busy ? 'Verificando…' : submitLabel}
      </button>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
};
