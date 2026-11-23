import React from 'react';
import { cn } from '../lib/format';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-12 w-12 rounded-xl',
  lg: 'h-20 w-20 rounded-2xl',
};

/** Logo oficial de Billar Bar la Beta. */
export const Logo: React.FC<LogoProps> = ({ size = 'md', className }) => (
  <div
    className={cn(
      'relative shrink-0 overflow-hidden border border-amber-400/25 bg-[#0a0a0c] shadow-[0_10px_28px_-12px_rgba(245,158,11,0.6)]',
      sizes[size],
      className
    )}
    aria-hidden="true"
  >
    <img
      src="/assets/logo-billar-beta.jpg"
      alt=""
      className="h-full w-full object-cover"
      draggable={false}
      decoding="async"
    />
    <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
  </div>
);
