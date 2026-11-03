import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, PenTool, Sparkles } from 'lucide-react';
import { cn } from '../lib/format';
import { APP_STAGE_LABEL, APP_VERSION } from '../lib/version';
import { Modal } from './ui/Modal';

interface DesignStageBadgeProps {
  className?: string;
}

const DONE = [
  'Mesas con entrada, salida y total en vivo',
  'Cobros en efectivo, QR y pago mixto',
  'Cierre de caja con arqueo y diferencia',
  'Barra, consumos y control de stock',
];

const REVIEW = [
  'Lectura de las tarjetas de mesa',
  'Textos y jerarquía de la información',
  'Flujo de cobro rápido en mostrador',
  'Detalles visuales para el salón',
];

export const DesignStageBadge: React.FC<DesignStageBadgeProps> = ({ className }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#0b1422] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 transition hover:border-amber-500/30 hover:text-amber-300',
          className
        )}
        title="Detalles de la versión de diseño"
      >
        <Sparkles className="h-3 w-3 text-amber-400/80" />
        {APP_STAGE_LABEL}
      </button>

      {createPortal(
        <Modal
          open={open}
          title="Versión de diseño"
          subtitle={`MVP ${APP_VERSION} · validación con el dueño`}
          icon={<PenTool className="h-4 w-4" />}
          onClose={() => setOpen(false)}
          size="md"
          footer={
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          }
        >
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3.5">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Etapa actual · diseño
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Esta es una versión MVP funcional. La operación de caja, mesas y cobros ya se puede
              recorrer de punta a punta; estamos afinando la experiencia y los textos antes de la
              instalación definitiva en el billar.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ya operativo
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                {DONE.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-300">
                <ClipboardCheck className="h-3.5 w-3.5" />
                En revisión de diseño
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
                {REVIEW.map((item) => (
                  <li key={item} className="flex gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-[#08111d] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Siguiente hito
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                Validación con el dueño, ajustes finales e instalación en el equipo del salón.
              </p>
            </div>
          </div>
        </Modal>,
        document.body
      )}
    </>
  );
};
