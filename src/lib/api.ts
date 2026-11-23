import type {
  AppState,
  AuditEntry,
  AuthStatus,
  BackupInfo,
  MutationResponse,
  ShiftDetail,
  ShiftHistoryItem,
  StaffAttendance,
  TransferDirection,
  User,
} from '../types';

const TOKEN_KEY = 'billar_caja_token_v2';

export class ApiError extends Error {
  status: number;
  payload: MutationResponse | null;

  constructor(message: string, status = 0, payload: MutationResponse | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent('billar:unauthorized'));
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const useAuth = options.auth !== false;
  const token = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (useAuth && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor local. Verifica que la ventana del sistema siga abierta.', 0);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && useAuth && token) {
      clearToken();
      notifyUnauthorized();
    }
    const payload = (data || null) as MutationResponse | null;
    throw new ApiError(payload?.error || `Error ${response.status}`, response.status, payload);
  }

  if (data && typeof data === 'object' && 'ok' in data && (data as { ok?: boolean }).ok === false) {
    const payload = data as MutationResponse;
    throw new ApiError(payload.error || 'La operación no se pudo completar.', response.status, payload);
  }

  return data as T;
}

export interface LoginResponse extends MutationResponse {
  token?: string;
  user?: User;
}

export const api = {
  status: () => request<AuthStatus>('/auth/status', { auth: false }),

  login: (pin: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { pin },
      auth: false,
    }),

  logout: () => request<MutationResponse>('/auth/logout', { method: 'POST' }),

  changePin: (currentPin: string, newPin: string) =>
    request<MutationResponse>('/auth/change-pin', {
      method: 'POST',
      body: { currentPin, newPin },
    }),

  state: () => request<{ ok: boolean; state: AppState }>('/state'),

  history: () => request<{ ok: boolean; shifts: ShiftHistoryItem[] }>('/history'),

  attendance: (limit = 300) =>
    request<{ ok: boolean; entries: StaffAttendance[] }>(`/attendance?limit=${limit}`),

  shift: (id: number) => request<{ ok: boolean; shift: ShiftDetail }>(`/shifts/${id}`),

  openShift: (initialCash: number) =>
    request<MutationResponse>('/shifts/open', {
      method: 'POST',
      body: { initialCash },
    }),

  closeShift: (payload: {
    countedCash: number;
    notes: string;
    denominations: Record<string, number>;
  }) =>
    request<MutationResponse>('/shifts/close', {
      method: 'POST',
      body: payload,
    }),

  startTable: (tableId: number, playerType: 'normal' | 'staff' | 'mixed' = 'normal') =>
    request<MutationResponse>(`/tables/${tableId}/start`, { method: 'POST', body: { playerType } }),

  addItem: (tableId: number, productId: number, quantity = 1) =>
    request<MutationResponse>(`/tables/${tableId}/items`, {
      method: 'POST',
      body: { productId, quantity },
    }),

  removeItem: (tableId: number, itemId: number) =>
    request<MutationResponse>(`/tables/${tableId}/items/${itemId}`, {
      method: 'DELETE',
    }),

  startCheckout: (tableId: number) =>
    request<MutationResponse>(`/tables/${tableId}/checkout/start`, {
      method: 'POST',
      body: {},
    }),

  cancelCheckout: (tableId: number) =>
    request<MutationResponse>(`/tables/${tableId}/checkout/cancel`, {
      method: 'POST',
      body: {},
    }),

  updateTableNote: (tableId: number, note: string) =>
    request<MutationResponse>(`/tables/${tableId}/note`, {
      method: 'PATCH',
      body: { note },
    }),

  chargeTable: (
    tableId: number,
    payload: {
      billiardAmount?: number;
      paymentMethod: string;
      cashAmount?: number;
      qrAmount?: number;
      qrReference?: string;
      notes?: string;
    }
  ) =>
    request<MutationResponse>(`/tables/${tableId}/charge`, {
      method: 'POST',
      body: payload,
    }),

  cancelTable: (tableId: number, reason: string) =>
    request<MutationResponse>(`/tables/${tableId}/cancel`, {
      method: 'POST',
      body: { reason },
    }),

  sale: (payload: {
    items: Array<{ productId: number; quantity: number }>;
    paymentMethod: string;
    cashAmount?: number;
    qrAmount?: number;
    qrReference?: string;
    notes?: string;
  }) =>
    request<MutationResponse>('/sales', { method: 'POST', body: payload }),

  openCustomerTab: (customerName: string) =>
    request<MutationResponse>('/customer-tabs', {
      method: 'POST',
      body: { customerName },
    }),

  addCustomerTabItem: (tabId: number, productId: number, quantity = 1) =>
    request<MutationResponse>(`/customer-tabs/${tabId}/items`, {
      method: 'POST',
      body: { productId, quantity },
    }),

  removeCustomerTabItem: (tabId: number, itemId: number) =>
    request<MutationResponse>(`/customer-tabs/${tabId}/items/${itemId}`, {
      method: 'DELETE',
    }),

  chargeCustomerTab: (
    tabId: number,
    payload: {
      paymentMethod: string;
      cashAmount?: number;
      qrAmount?: number;
      qrReference?: string;
      notes?: string;
    }
  ) =>
    request<MutationResponse>(`/customer-tabs/${tabId}/charge`, {
      method: 'POST',
      body: payload,
    }),

  cancelCustomerTab: (tabId: number, reason: string) =>
    request<MutationResponse>(`/customer-tabs/${tabId}/cancel`, {
      method: 'POST',
      body: { reason },
    }),

  addExpense: (payload: {
    amount?: number;
    concept: string;
    category: string;
    items?: Array<{
      productId: number | null;
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  }) => request<MutationResponse>('/expenses', { method: 'POST', body: payload }),

  voidPlay: (id: number, reason: string) =>
    request<MutationResponse>(`/plays/${id}/void`, { method: 'POST', body: { reason } }),

  voidSale: (id: number, reason: string) =>
    request<MutationResponse>(`/sales/${id}/void`, { method: 'POST', body: { reason } }),

  voidExpense: (id: number, reason: string) =>
    request<MutationResponse>(`/expenses/${id}/void`, { method: 'POST', body: { reason } }),

  createTransfer: (payload: {
    direction: TransferDirection;
    amount: number;
    concept: string;
    reference?: string;
  }) => request<MutationResponse>('/transfers', { method: 'POST', body: payload }),

  voidTransfer: (id: number, reason: string) =>
    request<MutationResponse>(`/transfers/${id}/void`, { method: 'POST', body: { reason } }),

  createUser: (payload: { name: string; pin: string; role: string }) =>
    request<MutationResponse>('/admin/users', { method: 'POST', body: payload }),

  updateUser: (id: number, payload: { name?: string; role?: string; active?: boolean }) =>
    request<MutationResponse>(`/admin/users/${id}`, { method: 'PATCH', body: payload }),

  resetUserPin: (id: number, pin: string) =>
    request<MutationResponse>(`/admin/users/${id}/reset-pin`, {
      method: 'POST',
      body: { pin },
    }),

  createProduct: (payload: {
    name: string;
    category: string;
    price: number;
    stock: number | null;
    favorite: boolean;
  }) => request<MutationResponse>('/admin/products', { method: 'POST', body: payload }),

  updateProduct: (
    id: number,
    payload: Partial<{
      name: string;
      category: string;
      price: number;
      stock: number | null;
      favorite: boolean;
      active: boolean;
    }>
  ) => request<MutationResponse>(`/admin/products/${id}`, { method: 'PATCH', body: payload }),

  createTable: (payload: { name: string; ratePerHour: number; color?: string }) =>
    request<MutationResponse>('/admin/tables', { method: 'POST', body: payload }),

  updateTable: (
    id: number,
    payload: Partial<{ name: string; ratePerHour: number; color: string; active: boolean }>
  ) => request<MutationResponse>(`/admin/tables/${id}`, { method: 'PATCH', body: payload }),

  updateSettings: (payload: Partial<{
    businessName: string;
    currency: string;
    defaultRatePerHour: number;
    minimumPlayCharge: number;
    defaultInitialCash: number;
    autoLockMinutes: number;
    receiptPromotions: string;
    thermalPrinterName: string;
    rawPrintingEnabled: boolean;
  }>) => request<MutationResponse>('/admin/settings', { method: 'PATCH', body: payload }),

  getPrinters: () =>
    request<{ ok: boolean; printers: string[] }>('/print/printers'),

  printTest: (printerName?: string) =>
    request<MutationResponse>('/print/test', {
      method: 'POST',
      body: printerName ? { printerName } : {},
    }),

  printReceiptRaw: (receipt: import('../types').ReceiptData) =>
    request<MutationResponse>('/print/receipt', {
      method: 'POST',
      body: receipt,
    }),

  audit: (limit = 200, userId?: number, shiftId?: number) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (userId) params.set('userId', String(userId));
    if (shiftId) params.set('shiftId', String(shiftId));
    return request<{ ok: boolean; entries: AuditEntry[] }>(`/admin/audit?${params.toString()}`);
  },

  backups: () => request<{ ok: boolean; backups: BackupInfo[] }>('/admin/backups'),

  createBackup: () =>
    request<MutationResponse>('/admin/backups', { method: 'POST' }),

  async download(path: string, fallbackName: string) {
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      throw new ApiError('No se pudo conectar con el servidor local.');
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearToken();
        notifyUnauthorized();
      }
      let message = `Error ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.error || message;
      } catch {
        // ignore
      }
      throw new ApiError(message, response.status);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || fallbackName;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  downloadBackup: () => api.download('/admin/backup/download', 'billar-backup.db'),

  exportPlaysCsv: () => api.download('/admin/export/plays.csv', 'partidas-billar.csv'),

  exportShiftsCsv: () => api.download('/admin/export/shifts.csv', 'turnos-billar.csv'),
};
