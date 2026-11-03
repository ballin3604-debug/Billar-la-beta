import type { ExpenseCategory, PaymentMethod, ProductCategory } from '../types';

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function formatMoney(value: number | null | undefined, currency = 'Bs') {
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function formatClock(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatTimeShort(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateShort(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = parseDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateInput(value: string | Date | null | undefined) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(value: string | Date): Date | null {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShiftRange(shift: {
  dateStart: string;
  dateEnd?: string | null;
  openedAt?: string;
  closedAt?: string | null;
}) {
  if (shift.openedAt) {
    const start = formatDateTime(shift.openedAt);
    if (shift.closedAt) return `${start} → ${formatDateTime(shift.closedAt)}`;
    return `${start} → en curso`;
  }
  if (shift.dateEnd && shift.dateEnd !== shift.dateStart) {
    return `${formatDateShort(shift.dateStart)} → ${formatDateShort(shift.dateEnd)}`;
  }
  return formatDateShort(shift.dateStart);
}

export interface SessionCalculation {
  seconds: number;
  minutes: number;
  cost: number;
  timer: string;
}

export function calculateSession(
  startTime: string,
  ratePerHour: number,
  minimumCharge: number,
  nowMs: number
): SessionCalculation {
  const start = new Date(startTime).getTime();
  const seconds = Math.max(0, Math.floor((nowMs - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rawCost = (minutes / 60) * Number(ratePerHour || 0);
  let cost = minutes > 0 ? Math.max(Number(minimumCharge || 0), rawCost) : 0;
  cost = Math.round(cost);

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = seconds % 60;
  const timer = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return { seconds, minutes, cost, timer };
}

export function durationLabel(minutes: number) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`;
}

export function paymentLabel(method: PaymentMethod | string) {
  if (method === 'qr') return 'QR';
  if (method === 'mixto') return 'Mixto';
  return 'Efectivo';
}

export function productCategoryLabel(category: ProductCategory | string) {
  const labels: Record<string, string> = {
    cervezas: 'Cervezas',
    bebidas: 'Bebidas',
    snacks: 'Snacks',
    multas: 'Multas',
    otros: 'Otros',
  };
  return labels[category] || category;
}

export function expenseCategoryLabel(category: ExpenseCategory | string) {
  const labels: Record<string, string> = {
    comida: 'Comida',
    personal: 'Personal',
    compras: 'Compras',
    servicios: 'Servicios',
    otro: 'Otro',
  };
  return labels[category] || category;
}

export function roleLabel(role: string) {
  return role === 'admin' ? 'Administrador' : 'Cajero';
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBackupDate(value: string) {
  return formatDateTime(value);
}

export function todayInputDate() {
  return formatDateInput(new Date());
}

export function sumItems(items: Array<{ price: number; quantity: number }>) {
  return items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
}

export function actionLabel(action: string) {
  const labels: Record<string, string> = {
    login: 'Inicio de sesión',
    logout: 'Cierre de sesión',
    login_failed: 'Intento de PIN fallido',
    login_failed_duplicate_pin: 'PIN duplicado',
    change_pin: 'Cambio de PIN',
    shift_open: 'Apertura de caja',
    shift_close: 'Cierre de caja',
    table_start: 'Mesa iniciada',
    table_item_add: 'Producto agregado a mesa',
    table_item_remove: 'Producto retirado de mesa',
    table_charge: 'Mesa cobrada',
    table_cancel: 'Mesa anulada',
    sale: 'Venta de barra',
    sale_void: 'Venta anulada',
    play_void: 'Partida anulada',
    expense_add: 'Gasto registrado',
    expense_void: 'Gasto anulado',
    user_create: 'Usuario creado',
    user_update: 'Usuario actualizado',
    user_reset_pin: 'PIN restablecido',
    product_create: 'Producto creado',
    product_update: 'Producto actualizado',
    table_create: 'Mesa creada',
    table_update: 'Mesa actualizada',
    settings_update: 'Configuración actualizada',
    backup_create: 'Copia de seguridad',
    backup_download: 'Respaldo descargado',
    export_plays: 'Exportación de partidas',
    export_shifts: 'Exportación de turnos',
  };
  return labels[action] || action;
}
