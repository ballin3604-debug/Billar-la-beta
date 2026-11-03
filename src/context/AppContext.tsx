import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AppState,
  AuthStatus,
  MutationResponse,
  ReceiptData,
  Settings,
  Tab,
  User,
} from '../types';
import {
  ApiError,
  api,
  clearToken,
  getToken,
  setToken,
} from '../lib/api';

type Phase = 'loading' | 'login' | 'app';
type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

interface AppContextValue {
  phase: Phase;
  locked: boolean;
  authStatus: AuthStatus;
  user: User | null;
  state: AppState | null;
  settings: Settings | null;
  tables: AppState['tables'];
  products: AppState['products'];
  currentShift: AppState['currentShift'];
  users: User[];
  tab: Tab;
  setTab: (tab: Tab) => void;
  toast: ToastState | null;
  dismissToast: () => void;
  receipt: ReceiptData | null;
  showReceipt: (receipt: ReceiptData) => void;
  closeReceipt: () => void;
  clockOffset: number;
  login: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
  logout: () => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<MutationResponse>;
  refresh: (silent?: boolean) => Promise<void>;
  applyMutation: (response: MutationResponse) => MutationResponse;
  runAction: (action: () => Promise<MutationResponse>) => Promise<MutationResponse | null>;
  handleError: (error: unknown) => void;
  notify: (message: string, type?: ToastType) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const DEFAULT_STATUS: AuthStatus = {
  ok: true,
  businessName: 'Billar & Bar',
  needsSetup: false,
  version: '0.9.0',
};

function isTab(value: string | null): value is Tab {
  return value === 'mesas' || value === 'caja' || value === 'historial' || value === 'ajustes';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [locked, setLocked] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(DEFAULT_STATUS);
  const [state, setState] = useState<AppState | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('billar_tab');
    return isTab(saved) ? saved : 'mesas';
  });
  const toastTimer = useRef<number | null>(null);

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showReceipt = useCallback((nextReceipt: ReceiptData) => {
    setReceipt(nextReceipt);
  }, []);

  const closeReceipt = useCallback(() => setReceipt(null), []);

  const setTab = useCallback((nextTab: Tab) => {
    setTabState(nextTab);
    sessionStorage.setItem('billar_tab', nextTab);
  }, []);

  const applyState = useCallback((nextState: AppState) => {
    setState(nextState);
    setUser(nextState.user);
    const serverTime = new Date(nextState.serverTime).getTime();
    if (Number.isFinite(serverTime)) {
      setClockOffset(serverTime - Date.now());
    }
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) return;
      const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      notify(message, 'error');
    },
    [notify]
  );

  const refresh = useCallback(
    async (silent = true) => {
      if (!getToken()) return;
      try {
        const response = await api.state();
        applyState(response.state);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return;
        if (!silent) handleError(error);
      }
    },
    [applyState, handleError]
  );

  const applyMutation = useCallback(
    (response: MutationResponse) => {
      if (response.state) applyState(response.state);
      if (response.message) notify(response.message, 'success');
      return response;
    },
    [applyState, notify]
  );

  const runAction = useCallback(
    async (action: () => Promise<MutationResponse>) => {
      try {
        const response = await action();
        return applyMutation(response);
      } catch (error) {
        handleError(error);
        return null;
      }
    },
    [applyMutation, handleError]
  );

  const performLogin = useCallback(
    async (pin: string) => {
      const response = await api.login(pin);
      if (!response.token || !response.state || !response.user) {
        throw new ApiError('No se pudo iniciar sesión.');
      }
      setToken(response.token);
      applyState(response.state);
      setAuthStatus((previous) => ({ ...previous, needsSetup: false }));
      setLocked(false);
      setPhase('app');
      if (response.message) notify(response.message, 'success');
    },
    [applyState, notify]
  );

  const login = useCallback(
    async (pin: string) => {
      await performLogin(pin);
    },
    [performLogin]
  );

  const unlock = useCallback(
    async (pin: string) => {
      await performLogin(pin);
    },
    [performLogin]
  );

  const lock = useCallback(() => {
    if (phase === 'app') setLocked(true);
  }, [phase]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // the local session must close even if the server is unavailable
    } finally {
      clearToken();
      setState(null);
      setUser(null);
      setReceipt(null);
      setLocked(false);
      setPhase('login');
      setTab('mesas');
      notify('Sesión cerrada.', 'info');
    }
  }, [notify, setTab]);

  const changePin = useCallback(
    async (currentPin: string, newPin: string) => {
      const response = await api.changePin(currentPin, newPin);
      return applyMutation(response);
    },
    [applyMutation]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.status();
        if (!cancelled) setAuthStatus(status);
      } catch {
        // the server might still be starting
      }

      if (getToken()) {
        try {
          const response = await api.state();
          if (!cancelled) {
            applyState(response.state);
            setPhase('app');
          }
          return;
        } catch (error) {
          clearToken();
          if (!cancelled) {
            setPhase('login');
            if (!(error instanceof ApiError && error.status === 401)) {
              notify(
                error instanceof Error
                  ? error.message
                  : 'No se pudo recuperar la sesión anterior.',
                'error'
              );
            }
          }
          return;
        }
      }

      if (!cancelled) setPhase('login');
    })();

    return () => {
      cancelled = true;
    };
  }, [applyState, notify]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setState(null);
      setUser(null);
      setLocked(false);
      setPhase('login');
      setReceipt(null);
      notify('Tu sesión expiró. Ingresa tu PIN nuevamente.', 'error');
    };
    const handleFocus = () => {
      if (phase === 'app' && !locked) refresh(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && phase === 'app' && !locked) {
        refresh(true);
      }
    };

    window.addEventListener('billar:unauthorized', handleUnauthorized);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('billar:unauthorized', handleUnauthorized);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [locked, notify, phase, refresh]);

  useEffect(() => {
    if (phase !== 'app') return;
    const interval = window.setInterval(() => {
      if (!locked) refresh(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [locked, phase, refresh]);

  useEffect(() => {
    if (phase !== 'app' || locked) return;
    const minutes = Number(state?.settings.autoLockMinutes ?? 0);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    let timer = 0;
    let lastReset = 0;
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setLocked(true);
      }, minutes * 60 * 1000);
    };
    const reset = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return;
      lastReset = now;
      arm();
    };

    arm();
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [locked, phase, state?.settings.autoLockMinutes]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      phase,
      locked,
      authStatus,
      user,
      state,
      settings: state?.settings ?? null,
      tables: state?.tables ?? [],
      products: state?.products ?? [],
      currentShift: state?.currentShift ?? null,
      users: state?.users ?? [],
      tab,
      setTab,
      toast,
      dismissToast,
      receipt,
      showReceipt,
      closeReceipt,
      clockOffset,
      login,
      unlock,
      lock,
      logout,
      changePin,
      refresh,
      applyMutation,
      runAction,
      handleError,
      notify,
    }),
    [
      phase,
      locked,
      authStatus,
      user,
      state,
      tab,
      setTab,
      toast,
      dismissToast,
      receipt,
      showReceipt,
      closeReceipt,
      clockOffset,
      login,
      unlock,
      lock,
      logout,
      changePin,
      refresh,
      applyMutation,
      runAction,
      handleError,
      notify,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider');
  return context;
}
