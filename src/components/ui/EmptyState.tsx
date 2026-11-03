import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-[#08111d]/60 px-5 py-8 text-center ${className}`}
  >
    {icon ? <div className="mb-1 text-slate-600">{icon}</div> : null}
    <p className="text-sm font-semibold text-slate-300">{title}</p>
    {description ? <p className="max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);
