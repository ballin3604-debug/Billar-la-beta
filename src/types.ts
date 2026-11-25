export type Role = 'admin' | 'cashier';
export type Tab = 'mesas' | 'caja' | 'historial' | 'ajustes' | 'egresos' | 'cierre' | 'ventas';
export type PaymentMethod = 'efectivo' | 'qr' | 'mixto';
export type TransferDirection = 'qr_to_cash' | 'cash_to_qr';
export type ExpenseCategory = 'comida' | 'personal' | 'compras' | 'servicios' | 'otro';
export type ProductCategory = 'cervezas' | 'bebidas' | 'snacks' | 'multas' | 'otros';
export type TablePlayerType = 'normal' | 'staff' | 'mixed';
export type TableColor =
  | 'blue'
  | 'violet'
  | 'amber'
  | 'sky'
  | 'pink'
  | 'lime'
  | 'orange'
  | 'teal'
  | 'indigo'
  | 'fuchsia';

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
  defaultInitialCash: number;
  autoLockMinutes: number;
  receiptPromotions: string;
  thermalPrinterName: string;
  rawPrintingEnabled: boolean;
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
  pausedSeconds: number;
  checkoutStartedAt: string | null;
  openedByName: string;
  playerType: TablePlayerType;
  notes: string | null;
  items: SessionItem[];
  itemsAmount: number;
}

export interface Table {
  id: number;
  number: number;
  name: string;
  ratePerHour: number;
  color: TableColor;
  active: boolean;
  status: 'available' | 'occupied';
  activeSession: ActiveSession | null;
}

export interface ShiftTotals {
  totalBilliard: number;
  totalProducts: number;
  tableProducts: number;
  customerTabProducts?: number;
  barSales: number;
  grossTotal: number;
  totalWithChange?: number;
  totalQr: number;
  totalQrNet?: number;
  totalExpenses: number;
  cashCollected?: number;
  expectedCash?: number;
  pendingBilliard?: number;
  pendingProducts?: number;
  pendingTotal?: number;
  cashTransfersIn?: number;
  cashTransfersOut?: number;
  transfersCount?: number;
  playsCount: number;
  salesCount: number;
  expensesCount: number;
  openSessionsCount?: number;
  openTabsCount?: number;
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
  openedBy?: number | null;
  openedByName: string;
  closedBy?: number | null;
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
  playerType: TablePlayerType;
  items: SessionItem[];
}

export interface SaleItem {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
}

export interface CustomerTabItem {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
}

export interface CustomerTab {
  id: number;
  shiftId: number;
  customerName: string;
  openedByName: string;
  createdAt: string;
  status: 'open' | 'charged' | 'cancelled';
  items: CustomerTabItem[];
  itemsAmount: number;
  outsideShiftDate?: boolean;
}

export interface ShiftOpenSession {
  id: number;
  shiftId: number;
  tableId: number;
  tableNumber: number;
  tableName: string;
  startTime: string;
  ratePerHour: number;
  pausedSeconds: number;
  checkoutStartedAt: string | null;
  openedByName: string;
  playerType: TablePlayerType;
  notes: string | null;
  durationMinutes: number;
  seconds: number;
  timer: string;
  billiardAmount: number;
  productsAmount: number;
  totalAmount: number;
  items: SessionItem[];
  itemsAmount: number;
  outsideShiftDate: boolean;
}

export interface ShiftOutOfRangeDate {
  date: string;
  count: number;
  total: number;
}

export interface ShiftOutOfRange {
  count: number;
  total: number;
  dates: ShiftOutOfRangeDate[];
}

export interface Sale {
  id: number;
  shiftId: number;
  createdBy?: number | null;
  createdByName: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashAmount: number;
  qrAmount: number;
  qrReference: string | null;
  notes: string | null;
  customerName?: string | null;
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
  createdBy?: number | null;
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

export interface CashTransfer {
  id: number;
  shiftId: number;
  createdBy?: number | null;
  createdByName: string;
  createdAt: string;
  direction: TransferDirection;
  amount: number;
  concept: string;
  reference: string | null;
  status: 'active' | 'voided';
  voidedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
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
  openCount?: number;
  billiard: number;
  products: number;
  total: number;
}

export interface ProductSummaryRow {
  name: string;
  quantity: number;
  amount: number;
  unitPrice?: number;
}

export interface QuickSalesSummary {
  count: number;
  openCount: number;
  billiard: number;
  products: number;
  total: number;
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
  cashTransfers: CashTransfer[];
  qrPayments: QrPayment[];
  tableSummary: TableSummary[];
  quickSalesSummary?: QuickSalesSummary;
  productSummary: ProductSummaryRow[];
  openSessions?: ShiftOpenSession[];
  openCustomerTabs?: CustomerTab[];
  outOfRange?: ShiftOutOfRange | null;
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
  customerTabs: CustomerTab[];
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
  customerName?: string;
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
  reprint?: boolean;
  promotions?: string;
  playerType?: TablePlayerType;
}

export interface MutationResponse {
  ok: boolean;
  state?: AppState;
  message?: string;
  closedShift?: ShiftDetail;
  sale?: Sale;
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
