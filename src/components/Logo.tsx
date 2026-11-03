import React from 'react';
import { cn } from '../lib/format';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
};

const ballSizes = {
  sm: 'h-4 w-4 text-[7px]',
  md: 'h-5 w-5 text-[8px]',
  lg: 'h-7 w-7 text-[11px]',
};

/** Bola 8 como identificación visual del sistema. Sin imágenes externas. */
export const Logo: React.FC<LogoProps> = ({ size = 'md', className }) => (
  <div
    className={cn(
      'relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800 shadow-[0_8px_22px_-8px_rgba(16,185,129,0.7)]',
      sizes[size],
      className
    )}
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_45%)]" />
    <span
      className={cn(
        'relative flex items-center justify-center rounded-full bg-slate-950 font-black text-white shadow-inner ring-1 ring-white/20',
        ballSizes[size]
      )}
    >
      8
    </span>
  </div>
);
