import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'primary' | 'warning';
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  busy = false,
  tone = 'primary',
  onCancel,
  onConfirm,
}) => {
  const Icon = tone === 'primary' ? CheckCircle2 : AlertTriangle;
  const buttonClass =
    tone === 'danger' ? 'btn-danger' : tone === 'warning' ? 'btn-amber' : 'btn-primary';

  return (
    <Modal
      open={open}
      title={title}
      icon={<Icon className="h-4 w-4" />}
      onClose={busy ? undefined : onCancel}
      disableClose={busy}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={buttonClass} onClick={onConfirm} disabled={busy}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 text-sm leading-relaxed text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div>{message}</div>
      </div>
    </Modal>
  );
};
