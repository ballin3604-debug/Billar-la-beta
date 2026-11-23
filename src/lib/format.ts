import type { ExpenseCategory, PaymentMethod, ProductCategory } from '../types';

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function formatMoney(value: number | null | undefined, currency = 'Bs') {
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted}\u00A0${currency}`;
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
  // Un turno pertenece a una sola fecha: se muestra solo esa fecha para no
  // mezclar días aunque la caja haya quedado abierta de un día para otro.
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
  nowMs: number,
  pausedSeconds = 0
): SessionCalculation {
  const start = new Date(startTime).getTime();
  const pausedMs = Math.max(0, Number(pausedSeconds) || 0) * 1000;
  const seconds = Math.max(0, Math.floor((nowMs - start - pausedMs) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rawCost = (minutes / 60) * Number(ratePerHour || 0);
  // El billar se cobra en pasos de 0,50 Bs desde el primer minuto.
  const stepCost = minutes > 0 ? Math.ceil(rawCost / 0.5) * 0.5 : 0;
  const cost = Math.round((Math.max(Number(minimumCharge || 0), stepCost) + Number.EPSILON) * 100) / 100;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = seconds % 60;
  const timer = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return { seconds, minutes, cost, timer };
}

export interface SessionTiming {
  startTime: string;
  ratePerHour: number;
  pausedSeconds?: number;
  checkoutStartedAt?: string | null;
}

/**
 * Calcula una mesa usando la hora congelada del cobro cuando existe. Así el
 * cronómetro y el monto dejan de avanzar mientras el cajero elige el pago.
 */
export function calculateActiveSession(
  session: SessionTiming,
  minimumCharge: number,
  nowMs: number
): SessionCalculation {
  const frozenMs = session.checkoutStartedAt
    ? new Date(session.checkoutStartedAt).getTime()
    : Number.NaN;
  const effectiveNow = Number.isFinite(frozenMs) ? frozenMs : nowMs;
  return calculateSession(
    session.startTime,
    session.ratePerHour,
    minimumCharge,
    effectiveNow,
    session.pausedSeconds
  );
}

export function durationLabel(minutes: number) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`;
}

export function tablePlayerTypeLabel(type?: string) {
  if (type === 'staff') return 'Encargados (sin cobro de mesa)';
  if (type === 'mixed') return 'Encargado + cliente (50% mesa)';
  return 'Normal';
}

export function effectiveBilliardAmount(
  computedCost: number,
  playerType?: string
) {
  const amount = Math.round((Math.max(0, Number(computedCost) || 0) + Number.EPSILON) * 100) / 100;
  if (playerType === 'staff') return 0;
  if (playerType === 'mixed') return Math.round((amount / 2 + Number.EPSILON) * 100) / 100;
  return amount;
}

export function paymentLabel(method: PaymentMethod | string) {
  if (method === 'qr') return 'QR';
  if (method === 'mixto') return 'Mixto';
  return 'Efectivo';
}

export function transferDirectionLabel(direction: string) {
  return direction === 'qr_to_cash'
    ? 'Entregó efectivo · recibió QR'
    : 'Recibió efectivo · entregó QR';
}

export function transferCashEffectLabel(direction: string) {
  return direction === 'qr_to_cash' ? 'Sale de caja' : 'Entra a caja';
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
    staff_check_in: 'Entrada de personal',
    staff_check_out: 'Salida de personal',
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
    cash_transfer_create: 'Traspaso QR ↔ efectivo',
    cash_transfer_void: 'Traspaso anulado',
    user_create: 'Usuario creado',
    user_update: 'Usuario actualizado',
    user_reset_pin: 'PIN restablecido',
    product_create: 'Producto creado',
    product_update: 'Producto actualizado',
    table_create: 'Mesa creada',
    table_update: 'Mesa actualizada',
    price_change: 'Cambio de precios',
    settings_update: 'Configuración actualizada',
    backup_create: 'Copia de seguridad',
    backup_download: 'Respaldo descargado',
    export_plays: 'Exportación de partidas',
    export_shifts: 'Exportación de turnos',
  };
  return labels[action] || action;
}
