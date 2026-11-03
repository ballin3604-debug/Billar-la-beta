import React, { useState } from 'react';
import {
  History,
  LayoutGrid,
  Lock,
  LogOut,
  Settings,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Tab } from '../types';
import { cn, formatClock, formatDateShort, formatMoney, roleLabel } from '../lib/format';
import { useNow } from '../lib/useNow';
import { Logo } from './Logo';
import { ConfirmDialog } from './ui/ConfirmDialog';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
  { id: 'mesas', label: 'Mesas', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'caja', label: 'Caja', icon: <Wallet className="h-4 w-4" /> },
  { id: 'historial', label: 'Historial', icon: <History className="h-4 w-4" /> },
  { id: 'ajustes', label: 'Ajustes', icon: <Settings className="h-4 w-4" />, adminOnly: true },
];

export const Header: React.FC = () => {
  const {
    user,
    settings,
    currentShift,
    tables,
    tab,
    setTab,
    lock,
    logout,
    clockOffset,
  } = useApp();
  const now = useNow(clockOffset, 1000);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const occupied = tables.filter((table) => table.status === 'occupied').length;
  const visibleTabs = TABS.filter((item) => !item.adminOnly || user?.role === 'admin');

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-slate-800/80 bg-[#070d16]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-5">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-black leading-tight text-white">
                  {settings?.businessName || 'Billar & Bar'}
                </p>
                <p className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">
                  Control de caja y mesas
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-5 md:flex">
              <div className="text-right">
                <p className="num text-sm font-bold text-slate-200">{formatClock(new Date(now))}</p>
                <p className="text-[9px] uppercase tracking-wider text-slate-500">
                  {formatDateShort(new Date(now))}
                </p>
              </div>
              <div className="h-7 w-px bg-slate-800" />
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    currentShift
                      ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
                      : 'bg-amber-400 shadow-[0_0_0_4px_rgba(245,158,11,0.1)]'
                  )}
                />
                <div>
                  <p className="text-[11px] font-bold text-slate-200">
                    {currentShift ? 'Caja abierta' : 'Caja cerrada'}
                  </p>
                  <p className="num text-[9px] text-slate-500">
                    {currentShift
                      ? `Desde ${formatClock(currentShift.openedAt)} · ${occupied} mesa${occupied === 1 ? '' : 's'}`
                      : 'Abre un turno para operar'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="mr-1 hidden items-center gap-2 rounded-xl border border-slate-800 bg-[#0b1422] py-1 pl-2 pr-2.5 sm:flex">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-black text-emerald-300">
                  {user?.name?.slice(0, 1).toUpperCase() || '?'}
                </div>
                <div className="max-w-[100px]">
                  <p className="truncate text-[11px] font-bold leading-tight text-slate-200">
                    {user?.name}
                  </p>
                  <p className="text-[9px] leading-tight text-slate-500">{roleLabel(user?.role || '')}</p>
                </div>
              </div>

              <button
                type="button"
                className="btn-ghost p-2"
                onClick={lock}
                title="Bloquear pantalla"
                aria-label="Bloquear pantalla"
              >
                <Lock className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-ghost p-2"
                onClick={() => setLogoutOpen(true)}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="scroll-thin flex h-11 items-stretch gap-1 overflow-x-auto">
            {visibleTabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 px-3 text-xs font-bold transition-colors',
                    active
                      ? 'text-emerald-300'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {item.icon}
                  {item.label}
                  {item.id === 'mesas' && occupied > 0 ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                      {occupied}
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-400" />
                  ) : null}
                </button>
              );
            })}

            <div className="ml-auto hidden items-center gap-4 pl-4 text-[10px] lg:flex">
              <span className="flex items-center gap-1.5 text-slate-500">
                <WifiOff className="h-3.5 w-3.5" />
                Modo local
              </span>
              {currentShift ? (
                <span className="text-slate-400">
                  Ventas:{' '}
                  <strong className="num text-slate-200">
                    {formatMoney(currentShift.totals.grossTotal, settings?.currency)}
                  </strong>
                </span>
              ) : null}
              {currentShift && user?.role === 'admin' && currentShift.totals.expectedCash !== undefined ? (
                <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1 text-emerald-300">
                  Efectivo:{' '}
                  <strong className="num">
                    {formatMoney(currentShift.totals.expectedCash, settings?.currency)}
                  </strong>
                </span>
              ) : null}
            </div>
          </nav>
        </div>
      </header>

      <ConfirmDialog
        open={logoutOpen}
        title="Cerrar sesión"
        message={
          <span>
            Se cerrará la sesión de <strong className="text-white">{user?.name}</strong>. La caja y
            las mesas seguirán abiertas para el siguiente usuario.
          </span>
        }
        confirmLabel="Cerrar sesión"
        tone="warning"
        busy={leaving}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={async () => {
          setLeaving(true);
          await logout();
          setLeaving(false);
        }}
      />
    </>
  );
};
