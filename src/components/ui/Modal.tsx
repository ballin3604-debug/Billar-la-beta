import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/format';

const sizes: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-7xl',
};

interface ModalProps {
  open?: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof sizes;
  disableClose?: boolean;
  className?: string;
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open = true,
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  size = 'lg',
  disableClose = false,
  className,
  bodyClassName,
}) => {
  useEffect(() => {
    if (!open || disableClose) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disableClose, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop animate-fade-in"
      onMouseDown={(event) => {
        if (!disableClose && event.target === event.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={cn('modal-card animate-pop-in', sizes[size], className)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-white sm:text-base">{title}</h2>
              {subtitle ? <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div> : null}
            </div>
          </div>
          {!disableClose ? (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost -mr-1 shrink-0 p-1.5"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className={cn('max-h-[calc(100vh-11rem)] overflow-y-auto px-4 py-4 sm:px-5', bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800/80 px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
