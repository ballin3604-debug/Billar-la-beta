import React from 'react';
import { cn } from '../../lib/format';

type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'violet';

const tones: Record<Tone, { box: string; icon: string; value: string }> = {
  emerald: {
    box: 'border-emerald-500/20 bg-emerald-500/[0.06]',
    icon: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    value: 'text-emerald-300',
  },
  sky: {
    box: 'border-sky-500/20 bg-sky-500/[0.06]',
    icon: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
    value: 'text-sky-300',
  },
  amber: {
    box: 'border-amber-500/20 bg-amber-500/[0.06]',
    icon: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    value: 'text-amber-300',
  },
  rose: {
    box: 'border-rose-500/20 bg-rose-500/[0.06]',
    icon: 'border-rose-500/25 bg-rose-500/10 text-rose-400',
    value: 'text-rose-300',
  },
  slate: {
    box: 'border-slate-800 bg-[#08111d]',
    icon: 'border-slate-700 bg-slate-800/60 text-slate-400',
    value: 'text-slate-100',
  },
  violet: {
    box: 'border-violet-500/20 bg-violet-500/[0.06]',
    icon: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
    value: 'text-violet-300',
  },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  tone = 'slate',
  className = '',
}) => {
  const palette = tones[tone];
  return (
    <div className={cn('rounded-xl border p-3', palette.box, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className={cn('num mt-1 truncate text-lg font-bold leading-tight', palette.value)}>{value}</p>
          {hint ? <p className="mt-1 text-[10px] leading-snug text-slate-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', palette.icon)}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
};
