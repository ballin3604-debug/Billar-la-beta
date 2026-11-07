export type Role = 'admin' | 'cashier';
export type Tab = 'mesas' | 'caja' | 'historial' | 'ajustes';
export type PaymentMethod = 'efectivo' | 'qr' | 'mixto';
export type ExpenseCategory = 'comida' | 'personal' | 'compras' | 'servicios' | 'otro';
export type ProductCategory = 'cervezas' | 'bebidas' | 'snacks' | 'multas' | 'otros';

export interface User {
  id: number;
  name: string;
  role: Role;
  active: boolean;
  mustChangePin: boolean;
  createdAt: string;
}

export interface Settings {
  businessName: string;
  currency: string;
  defaultRatePerHour: number;
  minimumPlayCharge: number;
  autoLockMinutes: number;
}

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number | null;
  favorite: boolean;
  active: boolean;
}

export interface SessionItem {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
}

export interface ActiveSession {
  id: number;
  tableId: number;
  startTime: string;
  ratePerHour: number;
  openedByName: string;
  items: SessionItem[];
  itemsAmount: number;
}

export interface Table {
  id: number;
  number: number;
  name: string;
  ratePerHour: number;
  active: boolean;
  status: 'available' | 'occupied';
  activeSession: ActiveSession | null;
}

export interface ShiftTotals {
  totalBilliard: number;
  totalProducts: number;
  tableProducts: number;
  barSales: number;
  grossTotal: number;
  totalQr: number;
  totalExpenses: number;
  cashCollected?: number;
  expectedCash?: number;
  playsCount: number;
  salesCount: number;
  expensesCount: number;
  itemsCount: number;
}

export interface Play {
  id: number;
  shiftId: number;
  sessionId: number;
  tableId: number;
  tableNumber: number;
  tableName: string;
  itemNumber: number;
  openedByName: string;
  closedByName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  billiardAmount: number;
  computedBilliardAmount: number;
  productsAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  qrAmount: number;
  qrReference: string | null;
  notes: string | null;
  status: 'active' | 'voided';
  voidedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  items: SessionItem[];
}

export interface SaleItem {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: number;
  shiftId: number;
  createdByName: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  qrAmount: number;
  qrReference: string | null;
  notes: string | null;
  status: 'active' | 'voided';
  voidedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  items: SaleItem[];
}

export interface ExpenseItem {
  id: number;
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Expense {
  id: number;
  shiftId: number;
  createdByName: string;
  createdAt: string;
  amount: number;
  concept: string;
  category: ExpenseCategory;
  status: 'active' | 'voided';
  voidedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  items: ExpenseItem[];
}

export interface QrPayment {
  id: string;
  refId: number;
  source: 'mesa' | 'barra';
  description: string;
  amount: number;
  timestamp: string;
  userName: string;
  reference: string | null;
}

export interface TableSummary {
  tableId: number;
  tableNumber: number;
  tableName: string;
  playsCount: number;
  billiard: number;
  products: number;
  total: number;
}

export interface ProductSummaryRow {
  name: string;
  quantity: number;
  amount: number;
}

export interface ClosingInfo {
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  notes: string | null;
  denominations: Record<string, number> | null;
}

export interface AuditEntry {
  id: number;
  createdAt: string;
  userName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  shiftId?: number | null;
  details: Record<string, unknown> | null;
}

export interface StaffAttendance {
  id: number;
  userId: number;
  userName: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  shiftId: number | null;
  closedShiftId: number | null;
}

export interface ShiftDetail {
  id: number;
  dateStart: string;
  dateEnd: string | null;
  openedAt: string;
  openedByName: string;
  closedAt: string | null;
  closedByName: string | null;
  initialCash: number;
  status: 'open' | 'closed';
  totals: ShiftTotals;
  tablePlays: Play[];
  sales: Sale[];
  expenses: Expense[];
  qrPayments: QrPayment[];
  tableSummary: TableSummary[];
  productSummary: ProductSummaryRow[];
  attendance: StaffAttendance[];
  closing: ClosingInfo | null;
  audit?: AuditEntry[];
}

export interface ShiftHistoryItem {
  id: number;
  dateStart: string;
  dateEnd: string | null;
  openedAt: string;
  closedAt: string | null;
  openedByName: string;
  closedByName: string | null;
  initialCash: number;
  status: 'open' | 'closed';
  totals: ShiftTotals;
  closing: ClosingInfo;
  hasDiscrepancy: boolean;
}

export interface AppState {
  user: User;
  settings: Settings;
  tables: Table[];
  products: Product[];
  currentShift: ShiftDetail | null;
  users?: User[];
  attendanceToday: StaffAttendance | null;
  serverTime: string;
}

export interface AuthStatus {
  ok: boolean;
  businessName: string;
  needsSetup: boolean;
  version: string;
}

export interface BackupInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
}

export interface ReceiptData {
  kind: 'table' | 'sale';
  number: string;
  businessName: string;
  currency: string;
  createdAt: string;
  shiftId: number;
  cashier: string;
  tableName?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  items: ReceiptItem[];
  billiardAmount: number;
  productsAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  qrAmount: number;
  qrReference?: string | null;
  notes?: string | null;
  received?: number;
  change?: number;
}

export interface MutationResponse {
  ok: boolean;
  state?: AppState;
  message?: string;
  closedShift?: ShiftDetail;
  backup?: BackupInfo;
  backups?: BackupInfo[];
  shifts?: ShiftHistoryItem[];
  shift?: ShiftDetail;
  entries?: AuditEntry[];
  users?: User[];
  error?: string;
  remaining?: number;
  retryAfter?: number;
}
