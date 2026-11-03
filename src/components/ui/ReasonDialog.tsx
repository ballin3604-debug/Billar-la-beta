import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  placeholder?: string;
  busy?: boolean;
  tone?: 'danger' | 'warning';
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Diálogo obligatorio de motivo. Se usa para anulaciones y ajustes sensibles:
 * el motivo queda guardado en la auditoría y no se puede omitir.
 */
export const ReasonDialog: React.FC<ReasonDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Anular y registrar',
  placeholder = 'Ej.: el cliente se retiró sin consumir…',
  busy = false,
  tone = 'danger',
  onCancel,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= 3;

  return (
    <Modal
      open={open}
      title={title}
      subtitle="La acción quedará registrada en la auditoría."
      icon={<ShieldAlert className="h-4 w-4" />}
      onClose={busy ? undefined : onCancel}
      disableClose={busy}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger' : 'btn-amber'}
            disabled={!valid || busy}
            onClick={() => {
              setTouched(true);
              if (valid) onConfirm(trimmed);
            }}
          >
            {busy ? 'Guardando…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-xs text-slate-400">
        {description ? (
          <div className="rounded-xl border border-slate-800 bg-[#08111d] px-3 py-2.5 leading-relaxed">
            {description}
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="reason-dialog">
            Motivo <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="reason-dialog"
            className="input min-h-24 resize-none"
            value={reason}
            maxLength={200}
            autoFocus
            placeholder={placeholder}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className={touched && !valid ? 'text-rose-400' : 'text-slate-500'}>
              Mínimo 3 caracteres.
            </span>
            <span className="num text-slate-500">{reason.length}/200</span>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>No se puede deshacer. El administrador podrá revisar quién, cuándo y por qué.</span>
        </div>
      </div>
    </Modal>
  );
};
