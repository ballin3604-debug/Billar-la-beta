import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/format';

export const Toast: React.FC = () => {
  const { toast, dismissToast } = useApp();
  if (!toast) return null;

  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;
  const tone =
    toast.type === 'success'
      ? 'border-emerald-500/40 bg-emerald-950/95 text-emerald-100'
      : toast.type === 'error'
      ? 'border-rose-500/40 bg-rose-950/95 text-rose-100'
      : 'border-sky-500/40 bg-sky-950/95 text-sky-100';

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] w-[min(92vw,28rem)] no-print">
      <div
        key={toast.id}
        className={cn(
          'pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs font-medium shadow-2xl backdrop-blur animate-fade-in',
          tone
        )}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1 leading-snug">{toast.message}</span>
        <button
          type="button"
          className="opacity-60 hover:opacity-100"
          onClick={dismissToast}
          aria-label="Cerrar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
