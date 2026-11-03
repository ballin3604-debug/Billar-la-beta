import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import type { ShiftDetail } from './types';
import { LoginScreen } from './components/LoginScreen';
import { LockScreen } from './components/LockScreen';
import { Header } from './components/Header';
import { TablesView } from './components/TablesView';
import { CashView } from './components/CashView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { OpenShiftScreen } from './components/OpenShiftScreen';
import { ShiftClosedDialog } from './components/ShiftClosedDialog';
import { ChangePinModal } from './components/ChangePinModal';
import { ReceiptModal } from './components/ReceiptModal';
import { Toast } from './components/ui/Toast';
import { Logo } from './components/Logo';
import { EmptyState } from './components/ui/EmptyState';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { formatMoney, formatClock } from './lib/format';
import { APP_VERSION } from './lib/version';

const LoadingScreen: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4">
    <div className="relative">
      <div className="absolute -inset-6 rounded-full bg-emerald-500/10 blur-xl" />
      <Logo size="lg" className="relative" />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-white">Iniciando el sistema local</p>
      <p className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Preparando la caja y la base de datos…
      </p>
    </div>
  </div>
);

const ShiftFooter: React.FC = () => {
  const { currentShift, settings, user, tables } = useApp();
  const occupied = tables.filter((table) => table.status === 'occupied').length;
  const currency = settings?.currency || 'Bs';

  return (
    <footer className="no-print border-t border-slate-800/80 bg-[#070d16]/95">
      <div className="mx-auto flex h-9 w-full max-w-[1600px] items-center justify-between gap-3 px-3 text-[10px] text-slate-500 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              currentShift ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="truncate">
            {currentShift
              ? `Caja abierta · Turno #${currentShift.id} · ${formatClock(currentShift.openedAt)}`
              : 'Caja cerrada · Abre un turno para operar'}
          </span>
          <span
            className="hidden shrink-0 items-center gap-1.5 text-slate-600 sm:flex"
            title="Versión de presentación en etapa de diseño"
          >
            <span className="h-1 w-1 rounded-full bg-amber-400/70" />
            MVP {APP_VERSION} · diseño
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">
            Mesas: <strong className="text-slate-300">{occupied}</strong>
          </span>
          {currentShift ? (
            <>
              <span>
                Ventas:{' '}
                <strong className="num text-slate-300">
                  {formatMoney(currentShift.totals.grossTotal, currency)}
                </strong>
              </span>
              <span className="hidden md:inline">
                QR:{' '}
                <strong className="num text-sky-300">
                  {formatMoney(currentShift.totals.totalQr, currency)}
                </strong>
              </span>
              {user?.role === 'admin' && currentShift.totals.expectedCash !== undefined ? (
                <span className="rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-0.5 text-emerald-300">
                  Efectivo:{' '}
                  <strong className="num">
                    {formatMoney(currentShift.totals.expectedCash, currency)}
                  </strong>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </footer>
  );
};

const AppShell: React.FC = () => {
  const { user, tab, setTab, currentShift } = useApp();
  const [closedShift, setClosedShift] = useState<ShiftDetail | null>(null);
  const [changePinOpen, setChangePinOpen] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin' && tab === 'ajustes') setTab('mesas');
  }, [setTab, tab, user?.role]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-5">
        {tab === 'mesas' ? (
          currentShift ? <TablesView /> : <OpenShiftScreen />
        ) : tab === 'caja' ? (
          currentShift ? (
            <CashView onShiftClosed={(shift) => setClosedShift(shift)} />
          ) : (
            <OpenShiftScreen />
          )
        ) : tab === 'historial' ? (
          <HistoryView />
        ) : tab === 'ajustes' ? (
          user?.role === 'admin' ? (
            <SettingsView />
          ) : (
            <EmptyState
              title="Acceso restringido"
              description="Solo el administrador puede entrar a los ajustes del sistema."
              icon={<ShieldAlert className="h-6 w-6" />}
              action={
                <button type="button" className="btn-secondary" onClick={() => setTab('mesas')}>
                  Volver a mesas
                </button>
              }
            />
          )
        ) : null}
      </main>

      <ShiftFooter />

      <ChangePinModal
        open={Boolean(user?.mustChangePin) || changePinOpen}
        forced={Boolean(user?.mustChangePin)}
        onClose={() => setChangePinOpen(false)}
      />

      <ShiftClosedDialog
        shift={closedShift}
        onClose={() => setClosedShift(null)}
        onViewHistory={() => {
          setClosedShift(null);
          setTab('historial');
        }}
        onNewShift={() => {
          setClosedShift(null);
          setTab('caja');
        }}
      />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { phase, locked } = useApp();

  let content: React.ReactNode;
  if (phase === 'loading') content = <LoadingScreen />;
  else if (phase === 'login') content = <LoginScreen />;
  else if (locked) content = <LockScreen />;
  else content = <AppShell />;

  return (
    <>
      {content}
      <Toast />
      <ReceiptModal />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
