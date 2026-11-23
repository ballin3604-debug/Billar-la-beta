import {
  all,
  get,
  getSettings,
  isTableColor,
  localDateKey,
  nowIso,
  run,
} from './database.mjs';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const round2 = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
};

// Un turno pertenece a una sola fecha. Para no partir las mesas que siguen
// jugando después de medianoche, la fecha del turno se extiende hasta el
// mediodía siguiente. Así el turno del 18/11 incluye la madrugada del 19/11,
// pero no las ventas del 20/11 ni del 22/11.
const SHIFT_DAY_CUTOFF_HOUR = 12;

function shiftDateWindow(dateStart) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStart || ''));
  if (!match) return null;
  const start = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0
  );
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  end.setHours(SHIFT_DAY_CUTOFF_HOUR, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function isInsideShiftWindow(value, window) {
  if (!window) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  return time >= window.startMs && time < window.endMs;
}

function shiftRecordDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return localDateKey(date);
}

export function formatDuration(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

export function computeSessionCost(
  startTime,
  ratePerHour,
  minimumCharge,
  nowMs = Date.now(),
  pausedSeconds = 0
) {
  const start = new Date(startTime).getTime();
  const pausedMs = Math.max(0, Number(pausedSeconds) || 0) * 1000;
  const seconds = Math.max(0, Math.floor((nowMs - start - pausedMs) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rawCost = (minutes / 60) * Number(ratePerHour || 0);
  // El billar se cobra en pasos de 0,50 Bs desde el primer minuto.
  const stepCost = minutes > 0 ? Math.ceil(rawCost / 0.5) * 0.5 : 0;
  const cost = round2(Math.max(Number(minimumCharge || 0), stepCost));

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = seconds % 60;
  const timer = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return { seconds, minutes, cost, timer };
}

const PLAYER_TYPES = new Set(['normal', 'staff', 'mixed']);

export function normalizePlayerType(value) {
  const type = String(value ?? 'normal').trim();
  return PLAYER_TYPES.has(type) ? type : 'normal';
}

export function playerTypeLabel(type) {
  if (type === 'staff') return 'Encargados (cortesía)';
  if (type === 'mixed') return 'Encargado + cliente (50% mesa)';
  return 'Normal';
}

export function applyPlayerTypeDiscount(billiardAmount, playerType) {
  const amount = round2(Math.max(0, Number(billiardAmount) || 0));
  if (playerType === 'staff') return 0;
  if (playerType === 'mixed') return round2(amount / 2);
  return amount;
}

export function normalizePayment(total, method, cashAmount, qrAmount, qrReference = '') {
  const normalizedTotal = round2(Math.max(0, Number(total) || 0));
  const validMethods = new Set(['efectivo', 'qr', 'mixto']);
  const normalizedMethod = validMethods.has(method) ? method : 'efectivo';
  const reference = String(qrReference || '').trim().slice(0, 80) || null;

  if (normalizedMethod === 'efectivo') {
    return { paymentMethod: 'efectivo', cashAmount: normalizedTotal, qrAmount: 0, qrReference: null };
  }

  if (normalizedMethod === 'qr') {
    return { paymentMethod: 'qr', cashAmount: 0, qrAmount: normalizedTotal, qrReference: reference };
  }

  const parseAmount = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new HttpError(400, 'Los montos de pago no son válidos.');
    }
    return round2(number);
  };
  let cash = parseAmount(cashAmount);
  let qr = parseAmount(qrAmount);

  if (cash === null && qr === null) {
    // Un total en cero (por ejemplo, mesa de encargados) no requiere montos
    // parciales: se registra como efectivo con 0 y evita el error de "mixto".
    if (normalizedTotal === 0) {
      return { paymentMethod: 'efectivo', cashAmount: 0, qrAmount: 0, qrReference: null };
    }
    throw new HttpError(400, 'Indica cuánto se paga en efectivo y cuánto por QR.');
  }
  if (cash === null) cash = round2(normalizedTotal - qr);
  if (qr === null) qr = round2(normalizedTotal - cash);

  if (cash < 0 || qr < 0) {
    throw new HttpError(400, 'Los montos de pago no pueden ser negativos.');
  }
  if (Math.abs(round2(cash + qr) - normalizedTotal) > 0.02) {
    throw new HttpError(400, `El efectivo y el QR deben sumar exactamente ${normalizedTotal}.`);
  }

  if (qr === 0) {
    return { paymentMethod: 'efectivo', cashAmount: normalizedTotal, qrAmount: 0, qrReference: null };
  }
  if (cash === 0) {
    return { paymentMethod: 'qr', cashAmount: 0, qrAmount: normalizedTotal, qrReference: reference };
  }

  return {
    paymentMethod: 'mixto',
    cashAmount: cash,
    qrAmount: qr,
    qrReference: reference,
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    active: Boolean(user.active),
    mustChangePin: Boolean(user.must_change_pin),
    createdAt: user.created_at,
  };
}

function mapAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    date: row.work_date,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    shiftId: row.shift_id,
    closedShiftId: row.closed_shift_id,
  };
}

export function getLatestAttendanceForUser(userId, workDate = null) {
  const row = workDate
    ? get(
        `SELECT * FROM staff_attendance
         WHERE user_id = ? AND work_date = ?
         ORDER BY check_in_at DESC, id DESC LIMIT 1`,
        userId,
        workDate
      )
    : get(
        `SELECT * FROM staff_attendance
         WHERE user_id = ?
         ORDER BY check_in_at DESC, id DESC LIMIT 1`,
        userId
      );
  return mapAttendance(row);
}

export function getCurrentAttendanceForUser(userId) {
  const open = get(
    `SELECT * FROM staff_attendance
     WHERE user_id = ? AND check_out_at IS NULL
     ORDER BY check_in_at DESC, id DESC LIMIT 1`,
    userId
  );
  return mapAttendance(open) || getLatestAttendanceForUser(userId, localDateKey());
}

function endOfLocalDayIso(workDate) {
  const [year, month, day] = String(workDate).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export function recordStaffCheckIn({ user, shiftId = null, ip = null, at = nowIso() }) {
  const workDate = localDateKey(new Date(at));

  // Si la persona quedó con una entrada abierta de un día anterior (por
  // ejemplo, cerró el navegador sin cerrar sesión), se cierra al final de
  // ese día para que no acumule jornadas "sin salida".
  const previousOpen = all(
    `SELECT * FROM staff_attendance
     WHERE user_id = ? AND check_out_at IS NULL AND work_date < ?
     ORDER BY check_in_at ASC, id ASC`,
    user.id,
    workDate
  );
  const closed = [];
  for (const row of previousOpen) {
    const checkoutAt = endOfLocalDayIso(row.work_date);
    if (!checkoutAt) continue;
    run(
      `UPDATE staff_attendance
       SET check_out_at = ?, check_out_ip = ?
       WHERE id = ?`,
      checkoutAt,
      ip,
      row.id
    );
    closed.push(mapAttendance(get('SELECT * FROM staff_attendance WHERE id = ?', row.id)));
  }

  const existing = get(
    `SELECT * FROM staff_attendance
     WHERE user_id = ? AND work_date = ? AND check_out_at IS NULL
     ORDER BY id DESC LIMIT 1`,
    user.id,
    workDate
  );
  if (existing) {
    return { attendance: mapAttendance(existing), created: false, closed };
  }

  const result = run(
    `INSERT INTO staff_attendance
     (user_id, user_name, work_date, check_in_at, shift_id, check_in_ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.name,
    workDate,
    at,
    shiftId,
    ip,
    at
  );
  const row = get(
    'SELECT * FROM staff_attendance WHERE id = ?',
    Number(result.lastInsertRowid)
  );
  return { attendance: mapAttendance(row), created: true, closed };
}

export function recordStaffCheckOut({
  user,
  shift = null,
  ip = null,
  at = nowIso(),
  createIfMissing = true,
}) {
  const open = get(
    `SELECT * FROM staff_attendance
     WHERE user_id = ? AND check_out_at IS NULL
     ORDER BY check_in_at DESC, id DESC LIMIT 1`,
    user.id
  );

  if (open) {
    run(
      `UPDATE staff_attendance
       SET check_out_at = ?, closed_shift_id = ?, check_out_ip = ?
       WHERE id = ?`,
      at,
      shift?.id ?? null,
      ip,
      open.id
    );
    return mapAttendance(get('SELECT * FROM staff_attendance WHERE id = ?', open.id));
  }

  if (!createIfMissing || !shift) return null;

  // Si la entrada no se registró (por ejemplo, una sesión anterior a esta función),
  // se conserva igualmente la salida para no perder el dato del arqueo.
  const checkInAt = Number(shift.opened_by) === Number(user.id) ? shift.opened_at : at;
  const result = run(
    `INSERT INTO staff_attendance
     (user_id, user_name, work_date, check_in_at, check_out_at, shift_id, closed_shift_id,
      check_in_ip, check_out_ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.name,
    localDateKey(new Date(checkInAt)),
    checkInAt,
    at,
    shift.id,
    shift.id,
    ip,
    ip,
    at
  );
  const row = get(
    'SELECT * FROM staff_attendance WHERE id = ?',
    Number(result.lastInsertRowid)
  );
  return mapAttendance(row);
}

export function getAttendance(viewer, limit = 300) {
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  const rows = viewer?.role === 'admin'
    ? all(
        `SELECT * FROM staff_attendance
         ORDER BY check_in_at DESC, id DESC LIMIT ?`,
        safeLimit
      )
    : all(
        `SELECT * FROM staff_attendance
         WHERE user_id = ?
         ORDER BY check_in_at DESC, id DESC LIMIT ?`,
        viewer?.id ?? 0,
        safeLimit
      );
  return rows.map(mapAttendance);
}

export function getOpenShiftRow() {
  return get("SELECT * FROM shifts WHERE status = 'open' LIMIT 1");
}

export function getShiftRow(shiftId) {
  return get('SELECT * FROM shifts WHERE id = ?', shiftId);
}

export function getOpenSessionForTable(tableId, shiftId = null) {
  if (shiftId) {
    return get(
      "SELECT * FROM sessions WHERE table_id = ? AND shift_id = ? AND status = 'open' LIMIT 1",
      tableId,
      shiftId
    );
  }
  return get("SELECT * FROM sessions WHERE table_id = ? AND status = 'open' LIMIT 1", tableId);
}

export function getSessionItems(sessionId) {
  return all(
    'SELECT * FROM session_items WHERE session_id = ? ORDER BY id ASC',
    sessionId
  ).map((item) => ({
    id: item.id,
    productId: item.product_id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));
}

export function itemsTotal(items) {
  return round2(
    items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  );
}

export function getCustomerTabItems(tabId) {
  return all(
    'SELECT * FROM customer_tab_items WHERE tab_id = ? ORDER BY id ASC',
    tabId
  ).map((item) => ({
    id: item.id,
    productId: item.product_id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));
}

export function getOpenCustomerTabs(shiftId = null) {
  const rows = shiftId
    ? all(
        `SELECT * FROM customer_tabs
         WHERE shift_id = ? AND status = 'open'
         ORDER BY created_at ASC, id ASC`,
        shiftId
      )
    : all(
        `SELECT * FROM customer_tabs
         WHERE status = 'open'
         ORDER BY created_at ASC, id ASC`
      );
  return rows.map((row) => {
    const items = getCustomerTabItems(row.id);
    return {
      id: row.id,
      shiftId: row.shift_id,
      customerName: row.customer_name,
      openedByName: row.opened_by_name,
      createdAt: row.created_at,
      status: row.status,
      items,
      itemsAmount: itemsTotal(items),
    };
  });
}

function mapTable(row) {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    ratePerHour: row.rate_per_hour,
    color: isTableColor(row.color) ? row.color : 'blue',
    active: Boolean(row.active),
  };
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: row.stock === null ? null : Number(row.stock),
    favorite: Boolean(row.favorite),
    active: Boolean(row.active),
  };
}

function mapPlay(row, items = []) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    sessionId: row.session_id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    tableName: row.table_name,
    itemNumber: row.item_number,
    openedByName: row.opened_by_name,
    closedByName: row.closed_by_name,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    billiardAmount: row.billiard_amount,
    computedBilliardAmount: row.computed_billiard_amount,
    productsAmount: row.products_amount,
    totalAmount: row.total_amount,
    paymentMethod: row.payment_method,
    cashAmount: row.cash_amount,
    qrAmount: row.qr_amount,
    qrReference: row.qr_reference,
    notes: row.notes,
    status: row.status,
    voidedByName: row.voided_by_name,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    playerType: normalizePlayerType(row.player_type),
    items,
  };
}

function mapSale(row, items = []) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    totalAmount: row.total_amount,
    paymentMethod: row.payment_method,
    cashAmount: row.cash_amount,
    qrAmount: row.qr_amount,
    qrReference: row.qr_reference,
    notes: row.notes,
    customerName: row.customer_name ?? null,
    status: row.status,
    voidedByName: row.voided_by_name,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    items,
  };
}

export function getSaleDetail(saleId) {
  const sale = get('SELECT * FROM sales WHERE id = ?', saleId);
  if (!sale) return null;
  const items = all(
    'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC',
    saleId
  ).map((row) => ({
    id: row.id,
    productId: row.product_id,
    name: row.name,
    price: row.price,
    quantity: row.quantity,
  }));
  return mapSale(sale, items);
}

function mapExpense(row, items = []) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    amount: row.amount,
    concept: row.concept,
    category: row.category,
    status: row.status,
    voidedByName: row.voided_by_name,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    items,
  };
}

function mapCashTransfer(row) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    direction: row.direction,
    amount: row.amount,
    concept: row.concept,
    reference: row.reference,
    status: row.status,
    voidedByName: row.voided_by_name,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  };
}

function parseDenominations(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function buildState(viewer) {
  const settings = getSettings();
  const tablesRows = all(
    viewer?.role === 'admin'
      ? 'SELECT * FROM tables ORDER BY number ASC'
      : 'SELECT * FROM tables WHERE active = 1 ORDER BY number ASC'
  );
  const productsRows = all(
    viewer?.role === 'admin'
      ? 'SELECT * FROM products ORDER BY favorite DESC, name ASC'
      : 'SELECT * FROM products WHERE active = 1 ORDER BY favorite DESC, name ASC'
  );

  const tables = tablesRows.map((tableRow) => {
    const session = getOpenSessionForTable(tableRow.id);
    const items = session ? getSessionItems(session.id) : [];
    return {
      ...mapTable(tableRow),
      status: session ? 'occupied' : 'available',
      activeSession: session
        ? {
            id: session.id,
            tableId: session.table_id,
            startTime: session.start_time,
            ratePerHour: session.rate_per_hour,
            pausedSeconds: Number(session.paused_seconds || 0),
            checkoutStartedAt: session.checkout_started_at || null,
            openedByName: session.opened_by_name,
            playerType: normalizePlayerType(session.player_type),
            notes: session.notes || null,
            items,
            itemsAmount: itemsTotal(items),
          }
        : null,
    };
  });

  const openShift = getOpenShiftRow();
  const currentShift = openShift
    ? viewer?.role === 'admin'
      ? getShiftDetail(openShift.id, viewer, { includeAudit: false })
      : getCashierShiftDetail(openShift.id, viewer)
    : null;

  const users = viewer?.role === 'admin'
    ? all('SELECT * FROM users ORDER BY active DESC, name ASC').map(publicUser)
    : undefined;
  const attendanceToday = viewer ? getCurrentAttendanceForUser(viewer.id) : null;
  const customerTabs = openShift ? getOpenCustomerTabs(openShift.id) : [];

  return {
    user: publicUser(viewer),
    settings,
    tables,
    products: productsRows.map(mapProduct),
    customerTabs,
    currentShift,
    users,
    attendanceToday,
    serverTime: new Date().toISOString(),
  };
}

export function getShiftDetail(shiftId, viewer = null, options = {}) {
  const shift = getShiftRow(shiftId);
  if (!shift) return null;

  const includeExpected = options.includeExpected !== undefined
    ? Boolean(options.includeExpected)
    : viewer?.role === 'admin' || shift.status === 'closed';

  const settings = getSettings();
  const minimumCharge = Number(settings.minimumPlayCharge || 0);
  const window = shiftDateWindow(shift.date_start);

  const playsRows = all(
    'SELECT * FROM plays WHERE shift_id = ? ORDER BY start_time ASC, id ASC',
    shiftId
  );
  const sessionItemRows = all(
    `SELECT si.*, p.id AS play_id
     FROM session_items si
     JOIN plays p ON p.session_id = si.session_id
     WHERE p.shift_id = ?
     ORDER BY si.id ASC`,
    shiftId
  );
  const sessionItemsByPlay = new Map();
  for (const row of sessionItemRows) {
    if (!sessionItemsByPlay.has(row.play_id)) sessionItemsByPlay.set(row.play_id, []);
    sessionItemsByPlay.get(row.play_id).push({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
    });
  }
  const plays = playsRows.map((row) =>
    mapPlay(row, sessionItemsByPlay.get(row.id) || [])
  );

  const saleRows = all(
    'SELECT * FROM sales WHERE shift_id = ? ORDER BY created_at ASC, id ASC',
    shiftId
  );
  const saleItemRows = all(
    `SELECT si.*
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.shift_id = ?
     ORDER BY si.id ASC`,
    shiftId
  );
  const saleItemsBySale = new Map();
  for (const row of saleItemRows) {
    if (!saleItemsBySale.has(row.sale_id)) saleItemsBySale.set(row.sale_id, []);
    saleItemsBySale.get(row.sale_id).push({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
    });
  }
  const sales = saleRows.map((row) =>
    mapSale(row, saleItemsBySale.get(row.id) || [])
  );

  const expenseRows = all(
    'SELECT * FROM expenses WHERE shift_id = ? ORDER BY created_at ASC, id ASC',
    shiftId
  );
  const expenseItemRows = all(
    `SELECT ei.*
     FROM expense_items ei
     JOIN expenses e ON e.id = ei.expense_id
     WHERE e.shift_id = ?
     ORDER BY ei.id ASC`,
    shiftId
  );
  const expenseItemsByExpense = new Map();
  for (const row of expenseItemRows) {
    if (!expenseItemsByExpense.has(row.expense_id)) expenseItemsByExpense.set(row.expense_id, []);
    expenseItemsByExpense.get(row.expense_id).push({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      subtotal: round2(Number(row.quantity || 0) * Number(row.unit_price || 0)),
    });
  }
  const expenses = expenseRows.map((row) =>
    mapExpense(row, expenseItemsByExpense.get(row.id) || [])
  );

  const cashTransferRows = all(
    'SELECT * FROM cash_transfers WHERE shift_id = ? ORDER BY created_at ASC, id ASC',
    shiftId
  );
  const cashTransfers = cashTransferRows.map(mapCashTransfer);

  const activePlays = plays.filter((play) => play.status === 'active');
  const activeSales = sales.filter((sale) => sale.status === 'active');
  const activeExpenses = expenses.filter((expense) => expense.status === 'active');
  const activeTransfers = cashTransfers.filter((transfer) => transfer.status === 'active');

  // La planilla de un turno pertenece a una sola fecha. Se incluye la
  // madrugada siguiente hasta el mediodía para no cortar mesas nocturnas.
  const shiftPlays = activePlays.filter((play) =>
    isInsideShiftWindow(play.startTime, window)
  );
  const shiftSales = activeSales.filter((sale) =>
    isInsideShiftWindow(sale.createdAt, window)
  );
  const shiftExpenses = activeExpenses.filter((expense) =>
    isInsideShiftWindow(expense.createdAt, window)
  );
  const shiftTransfers = activeTransfers.filter((transfer) =>
    isInsideShiftWindow(transfer.createdAt, window)
  );

  const outOfRangeMap = new Map();
  const addOutOfRange = (value, amount) => {
    const date = shiftRecordDate(value);
    if (!date) return;
    const current = outOfRangeMap.get(date) || { date, count: 0, total: 0 };
    current.count += 1;
    current.total = round2(current.total + Number(amount || 0));
    outOfRangeMap.set(date, current);
  };
  for (const play of activePlays) {
    if (!isInsideShiftWindow(play.startTime, window)) {
      addOutOfRange(play.startTime, play.totalAmount);
    }
  }
  for (const sale of activeSales) {
    if (!isInsideShiftWindow(sale.createdAt, window)) {
      addOutOfRange(sale.createdAt, sale.totalAmount);
    }
  }
  for (const expense of activeExpenses) {
    if (!isInsideShiftWindow(expense.createdAt, window)) {
      addOutOfRange(expense.createdAt, expense.amount);
    }
  }
  for (const transfer of activeTransfers) {
    if (!isInsideShiftWindow(transfer.createdAt, window)) {
      addOutOfRange(transfer.createdAt, transfer.amount);
    }
  }
  const outOfRangeDates = [...outOfRangeMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const outOfRangeCount = outOfRangeDates.reduce((sum, item) => sum + item.count, 0);
  const outOfRangeTotal = round2(
    outOfRangeDates.reduce((sum, item) => sum + item.total, 0)
  );
  const outOfRange = outOfRangeCount > 0
    ? { count: outOfRangeCount, total: outOfRangeTotal, dates: outOfRangeDates }
    : null;

  // Mesas y ventas por cliente que siguen abiertas: todavía no están
  // cobradas, pero su tiempo y consumo deben reflejarse en la planilla.
  const openSessionRows = all(
    `SELECT s.*, t.number AS table_number, t.name AS table_name
     FROM sessions s
     JOIN tables t ON t.id = s.table_id
     WHERE s.shift_id = ? AND s.status = 'open'
     ORDER BY t.number ASC, s.id ASC`,
    shiftId
  );
  const openSessions = openSessionRows.map((row) => {
    const items = getSessionItems(row.id);
    const frozenMs = row.checkout_started_at
      ? new Date(row.checkout_started_at).getTime()
      : Number.NaN;
    const calculation = computeSessionCost(
      row.start_time,
      row.rate_per_hour,
      minimumCharge,
      Number.isFinite(frozenMs) ? frozenMs : Date.now(),
      row.paused_seconds
    );
    const productsAmount = itemsTotal(items);
    return {
      id: row.id,
      shiftId: row.shift_id,
      tableId: row.table_id,
      tableNumber: row.table_number,
      tableName: row.table_name,
      startTime: row.start_time,
      ratePerHour: row.rate_per_hour,
      pausedSeconds: Number(row.paused_seconds || 0),
      checkoutStartedAt: row.checkout_started_at || null,
      openedByName: row.opened_by_name,
      playerType: normalizePlayerType(row.player_type),
      notes: row.notes || null,
      durationMinutes: calculation.minutes,
      seconds: calculation.seconds,
      timer: calculation.timer,
      billiardAmount: calculation.cost,
      productsAmount,
      totalAmount: round2(calculation.cost + productsAmount),
      items,
      itemsAmount: productsAmount,
      outsideShiftDate: !isInsideShiftWindow(row.start_time, window),
    };
  });
  const openCustomerTabs = getOpenCustomerTabs(shiftId).map((tab) => ({
    ...tab,
    outsideShiftDate: !isInsideShiftWindow(tab.createdAt, window),
  }));

  const pendingBilliard = round2(
    openSessions.reduce((sum, session) => sum + Number(session.billiardAmount || 0), 0)
  );
  const openTableProducts = round2(
    openSessions.reduce((sum, session) => sum + Number(session.productsAmount || 0), 0)
  );
  const customerTabProducts = round2(
    openCustomerTabs.reduce((sum, tab) => sum + Number(tab.itemsAmount || 0), 0)
  );
  const pendingProducts = round2(openTableProducts + customerTabProducts);
  const pendingTotal = round2(pendingBilliard + pendingProducts);

  const totalBilliard = round2(
    shiftPlays.reduce((sum, play) => sum + Number(play.billiardAmount || 0), 0) +
      pendingBilliard
  );
  const tableProducts = round2(
    shiftPlays.reduce((sum, play) => sum + Number(play.productsAmount || 0), 0) +
      openTableProducts
  );
  const barSales = round2(
    shiftSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0)
  );
  const totalProducts = round2(tableProducts + customerTabProducts + barSales);
  const grossTotal = round2(totalBilliard + totalProducts);
  const totalWithChange = round2(Number(shift.initial_cash || 0) + grossTotal);
  const totalQr = round2(
    shiftPlays.reduce((sum, play) => sum + Number(play.qrAmount || 0), 0) +
      shiftSales.reduce((sum, sale) => sum + Number(sale.qrAmount || 0), 0)
  );
  const cashCollected = round2(
    shiftPlays.reduce((sum, play) => sum + Number(play.cashAmount || 0), 0) +
      shiftSales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0)
  );
  const totalExpenses = round2(
    shiftExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  );
  // cash_to_qr: entra efectivo a la gaveta y sale QR.
  // qr_to_cash: sale efectivo de la gaveta y entra QR.
  const cashTransfersIn = round2(
    shiftTransfers
      .filter((transfer) => transfer.direction === 'cash_to_qr')
      .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)
  );
  const cashTransfersOut = round2(
    shiftTransfers
      .filter((transfer) => transfer.direction === 'qr_to_cash')
      .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)
  );
  const totalQrNet = round2(totalQr + cashTransfersOut - cashTransfersIn);
  const expectedCash = round2(
    Number(shift.initial_cash || 0) +
      cashCollected -
      totalExpenses +
      cashTransfersIn -
      cashTransfersOut
  );

  const totals = {
    totalBilliard,
    totalProducts,
    tableProducts,
    customerTabProducts,
    barSales,
    grossTotal,
    totalWithChange,
    totalQr,
    totalQrNet,
    totalExpenses,
    cashCollected,
    expectedCash,
    pendingBilliard,
    pendingProducts,
    pendingTotal,
    cashTransfersIn,
    cashTransfersOut,
    transfersCount: shiftTransfers.length,
    playsCount: shiftPlays.length,
    salesCount: shiftSales.length,
    expensesCount: shiftExpenses.length,
    openSessionsCount: openSessions.length,
    openTabsCount: openCustomerTabs.length,
    itemsCount:
      shiftPlays.reduce(
        (sum, play) => sum + play.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      ) +
      shiftSales.reduce(
        (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      ) +
      openSessions.reduce(
        (sum, session) =>
          sum + session.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      ) +
      openCustomerTabs.reduce(
        (sum, tab) => sum + tab.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      ),
  };
  if (!includeExpected) {
    delete totals.expectedCash;
    delete totals.cashCollected;
    delete totals.cashTransfersIn;
    delete totals.cashTransfersOut;
  }

  const productMap = new Map();
  const addProduct = (name, quantity, amount, unitPrice) => {
    const existing = productMap.get(name) || { name, quantity: 0, amount: 0, unitPrice: 0 };
    existing.quantity += Number(quantity || 0);
    existing.amount = round2(existing.amount + Number(amount || 0));
    if (unitPrice !== undefined && unitPrice !== null && Number(unitPrice) > 0) {
      existing.unitPrice = Number(unitPrice);
    } else if (existing.quantity > 0) {
      existing.unitPrice = round2(existing.amount / existing.quantity);
    }
    productMap.set(name, existing);
  };
  for (const play of shiftPlays) {
    for (const item of play.items) {
      addProduct(item.name, item.quantity, item.price * item.quantity, item.price);
    }
  }
  for (const sale of shiftSales) {
    for (const item of sale.items) {
      addProduct(item.name, item.quantity, item.price * item.quantity, item.price);
    }
  }
  for (const session of openSessions) {
    for (const item of session.items) {
      addProduct(item.name, item.quantity, item.price * item.quantity, item.price);
    }
  }
  for (const tab of openCustomerTabs) {
    for (const item of tab.items) {
      addProduct(item.name, item.quantity, item.price * item.quantity, item.price);
    }
  }
  const productSummary = [...productMap.values()]
    .map((item) => ({
      ...item,
      unitPrice:
        item.unitPrice ||
        (item.quantity > 0 ? round2(item.amount / item.quantity) : 0),
    }))
    .sort((a, b) => b.amount - a.amount);

  const tableRows = all(
    `SELECT t.id, t.number, t.name
     FROM tables t
     WHERE t.active = 1
        OR EXISTS (SELECT 1 FROM plays p WHERE p.table_id = t.id AND p.shift_id = ?)
        OR EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.table_id = t.id AND s.shift_id = ? AND s.status = 'open'
        )
     ORDER BY t.number ASC`,
    shiftId,
    shiftId
  );
  const tableSummary = tableRows.map((table) => {
    const tablePlays = shiftPlays.filter((play) => play.tableId === table.id);
    const tableOpenSessions = openSessions.filter(
      (session) => session.tableId === table.id
    );
    const billiard = round2(
      tablePlays.reduce((sum, play) => sum + Number(play.billiardAmount || 0), 0) +
        tableOpenSessions.reduce(
          (sum, session) => sum + Number(session.billiardAmount || 0),
          0
        )
    );
    const products = round2(
      tablePlays.reduce((sum, play) => sum + Number(play.productsAmount || 0), 0) +
        tableOpenSessions.reduce(
          (sum, session) => sum + Number(session.productsAmount || 0),
          0
        )
    );
    return {
      tableId: table.id,
      tableNumber: table.number,
      tableName: table.name,
      playsCount: tablePlays.length,
      openCount: tableOpenSessions.length,
      billiard,
      products,
      total: round2(billiard + products),
    };
  });

  const quickSalesCount = shiftSales.length;
  const quickSalesOpenCount = openCustomerTabs.length;
  const quickSalesProducts = round2(
    shiftSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0) +
      openCustomerTabs.reduce((sum, t) => sum + Number(t.itemsAmount || 0), 0)
  );
  const quickSalesSummary = {
    count: quickSalesCount,
    openCount: quickSalesOpenCount,
    billiard: 0,
    products: quickSalesProducts,
    total: quickSalesProducts,
  };

  const qrPayments = [
    ...shiftPlays
      .filter((play) => Number(play.qrAmount) > 0)
      .map((play) => ({
        id: `play-${play.id}`,
        refId: play.id,
        source: 'mesa',
        description: `${play.tableName} · ${formatDuration(play.durationMinutes)}`,
        amount: play.qrAmount,
        timestamp: play.endTime,
        userName: play.closedByName,
        reference: play.qrReference,
      })),
    ...shiftSales
      .filter((sale) => Number(sale.qrAmount) > 0)
      .map((sale) => ({
        id: `sale-${sale.id}`,
        refId: sale.id,
        source: 'barra',
        description: sale.items.length
          ? sale.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')
          : 'Venta de Productos',
        amount: sale.qrAmount,
        timestamp: sale.createdAt,
        userName: sale.createdByName,
        reference: sale.qrReference,
      })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const attendanceRows = viewer?.role === 'admin'
    ? all(
        `SELECT * FROM staff_attendance
         WHERE shift_id = ? OR closed_shift_id = ?
            OR id = (
              SELECT sa.id FROM staff_attendance sa
              WHERE sa.user_id = ? AND sa.check_out_at IS NULL AND sa.check_in_at <= ?
              ORDER BY sa.check_in_at DESC, sa.id DESC LIMIT 1
            )
         ORDER BY check_in_at ASC, id ASC`,
        shiftId,
        shiftId,
        shift.opened_by,
        shift.opened_at
      )
    : all(
        `SELECT * FROM staff_attendance
         WHERE user_id = ?
           AND (shift_id = ? OR closed_shift_id = ?
                OR id = (
                  SELECT sa.id FROM staff_attendance sa
                  WHERE sa.user_id = ? AND sa.check_out_at IS NULL AND sa.check_in_at <= ?
                  ORDER BY sa.check_in_at DESC, sa.id DESC LIMIT 1
                ))
         ORDER BY check_in_at ASC, id ASC`,
        viewer?.id ?? 0,
        shiftId,
        shiftId,
        viewer?.id ?? 0,
        shift.opened_at
      );
  const attendance = attendanceRows.map(mapAttendance);

  const closed = shift.status === 'closed';
  const closing = closed
    ? {
        expectedCash: shift.expected_cash,
        countedCash: shift.counted_cash,
        difference: shift.difference,
        notes: shift.closing_notes,
        denominations: parseDenominations(shift.denominations),
      }
    : null;

  const audit = viewer?.role === 'admin' && options.includeAudit !== false
    ? all(
        `SELECT id, created_at, user_name, action, entity_type, entity_id, details
         FROM audit_log WHERE shift_id = ? ORDER BY id DESC LIMIT 300`,
        shiftId
      ).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        userName: row.user_name,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: row.details ? safeJson(row.details) : null,
      }))
    : undefined;

  return {
    id: shift.id,
    dateStart: shift.date_start,
    dateEnd: shift.closed_at ? localDateKey(new Date(shift.closed_at)) : null,
    openedAt: shift.opened_at,
    openedByName: shift.opened_by_name,
    closedAt: shift.closed_at,
    closedByName: shift.closed_by_name,
    initialCash: shift.initial_cash,
    status: shift.status,
    totals,
    tablePlays: shiftPlays,
    sales: shiftSales,
    expenses: shiftExpenses,
    cashTransfers: shiftTransfers,
    qrPayments,
    tableSummary,
    quickSalesSummary,
    productSummary,
    openSessions,
    openCustomerTabs,
    outOfRange,
    attendance,
    closing,
    audit,
  };
}

/**
 * Vista del turno para cajeros.
 * Incluye sus propios egresos y traspasos, su asistencia y el historial de
 * partidas/ventas del turno para respaldar la caja. No expone el efectivo
 * esperado, la diferencia de arqueo ni la auditoría.
 */
export function getCashierShiftDetail(shiftId, viewer) {
  const shift = getShiftRow(shiftId);
  if (!shift) return null;

  const window = shiftDateWindow(shift.date_start);
  const userId = viewer?.id ?? 0;
  const expenseRows = all(
    'SELECT * FROM expenses WHERE shift_id = ? AND created_by = ? ORDER BY created_at ASC, id ASC',
    shiftId,
    userId
  );
  const expenseItemRows = all(
    `SELECT ei.*
     FROM expense_items ei
     JOIN expenses e ON e.id = ei.expense_id
     WHERE e.shift_id = ? AND e.created_by = ?
     ORDER BY ei.id ASC`,
    shiftId,
    userId
  );
  const expenseItemsByExpense = new Map();
  for (const row of expenseItemRows) {
    if (!expenseItemsByExpense.has(row.expense_id)) {
      expenseItemsByExpense.set(row.expense_id, []);
    }
    expenseItemsByExpense.get(row.expense_id).push({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      subtotal: round2(Number(row.quantity || 0) * Number(row.unit_price || 0)),
    });
  }
  const expenses = expenseRows
    .map((row) => mapExpense(row, expenseItemsByExpense.get(row.id) || []))
    .filter((expense) => isInsideShiftWindow(expense.createdAt, window));
  const activeExpenses = expenses.filter((expense) => expense.status === 'active');
  const totalExpenses = round2(
    activeExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  );

  const cashTransferRows = all(
    'SELECT * FROM cash_transfers WHERE shift_id = ? AND created_by = ? ORDER BY created_at ASC, id ASC',
    shiftId,
    userId
  );
  const cashTransfers = cashTransferRows.map(mapCashTransfer);
  const activeTransfers = cashTransfers.filter(
    (transfer) => transfer.status === 'active'
  );

  const playsRows = all(
    'SELECT * FROM plays WHERE shift_id = ? ORDER BY start_time ASC, id ASC',
    shiftId
  );
  const sessionItemRows = all(
    `SELECT si.*, p.id AS play_id
     FROM session_items si
     JOIN plays p ON p.session_id = si.session_id
     WHERE p.shift_id = ?
     ORDER BY si.id ASC`,
    shiftId
  );
  const sessionItemsByPlay = new Map();
  for (const row of sessionItemRows) {
    if (!sessionItemsByPlay.has(row.play_id)) sessionItemsByPlay.set(row.play_id, []);
    sessionItemsByPlay.get(row.play_id).push({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
    });
  }
  const plays = playsRows.map((row) =>
    mapPlay(row, sessionItemsByPlay.get(row.id) || [])
  );

  const saleRows = all(
    'SELECT * FROM sales WHERE shift_id = ? ORDER BY created_at ASC, id ASC',
    shiftId
  );
  const saleItemRows = all(
    `SELECT si.*
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.shift_id = ?
     ORDER BY si.id ASC`,
    shiftId
  );
  const saleItemsBySale = new Map();
  for (const row of saleItemRows) {
    if (!saleItemsBySale.has(row.sale_id)) saleItemsBySale.set(row.sale_id, []);
    saleItemsBySale.get(row.sale_id).push({
      id: row.id,
      productId: row.product_id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
    });
  }
  const sales = saleRows.map((row) =>
    mapSale(row, saleItemsBySale.get(row.id) || [])
  );

  const activePlays = plays.filter((play) => play.status === 'active');
  const activeSales = sales.filter((sale) => sale.status === 'active');

  const totalBilliard = round2(
    activePlays.reduce((sum, play) => sum + Number(play.billiardAmount || 0), 0)
  );
  const tableProducts = round2(
    activePlays.reduce((sum, play) => sum + Number(play.productsAmount || 0), 0)
  );
  const barSales = round2(
    activeSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0)
  );
  const totalProducts = round2(tableProducts + barSales);
  const grossTotal = round2(totalBilliard + totalProducts);
  const totalQr = round2(
    activePlays.reduce((sum, play) => sum + Number(play.qrAmount || 0), 0) +
      activeSales.reduce((sum, sale) => sum + Number(sale.qrAmount || 0), 0)
  );
  const cashCollected = round2(
    activePlays.reduce((sum, play) => sum + Number(play.cashAmount || 0), 0) +
      activeSales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0)
  );

  const tableMap = new Map();
  for (const play of activePlays) {
    const current = tableMap.get(play.tableId) || {
      tableId: play.tableId,
      tableNumber: play.tableNumber,
      tableName: play.tableName,
      playsCount: 0,
      billiard: 0,
      products: 0,
      total: 0,
    };
    current.playsCount += 1;
    current.billiard = round2(current.billiard + Number(play.billiardAmount || 0));
    current.products = round2(current.products + Number(play.productsAmount || 0));
    current.total = round2(current.billiard + current.products);
    tableMap.set(play.tableId, current);
  }
  const tableSummary = [...tableMap.values()].sort(
    (a, b) => a.tableNumber - b.tableNumber
  );

  const qrPayments = [
    ...activePlays
      .filter((play) => Number(play.qrAmount) > 0)
      .map((play) => ({
        id: `play-${play.id}`,
        refId: play.id,
        source: 'mesa',
        description: `${play.tableName} · ${formatDuration(play.durationMinutes)}`,
        amount: play.qrAmount,
        timestamp: play.endTime,
        userName: play.closedByName,
        reference: play.qrReference,
      })),
    ...activeSales
      .filter((sale) => Number(sale.qrAmount) > 0)
      .map((sale) => ({
        id: `sale-${sale.id}`,
        refId: sale.id,
        source: 'barra',
        description: sale.items.length
          ? sale.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')
          : 'Venta de barra',
        amount: sale.qrAmount,
        timestamp: sale.createdAt,
        userName: sale.createdByName,
        reference: sale.qrReference,
      })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const attendanceRows = all(
    `SELECT * FROM staff_attendance
     WHERE user_id = ?
       AND (shift_id = ? OR closed_shift_id = ?
            OR id = (
              SELECT sa.id FROM staff_attendance sa
              WHERE sa.user_id = ? AND sa.check_out_at IS NULL AND sa.check_in_at <= ?
              ORDER BY sa.check_in_at DESC, sa.id DESC LIMIT 1
            ))
     ORDER BY check_in_at ASC, id ASC`,
    userId,
    shiftId,
    shiftId,
    userId,
    shift.opened_at
  );

  return {
    id: shift.id,
    dateStart: shift.date_start,
    dateEnd: shift.closed_at ? localDateKey(new Date(shift.closed_at)) : null,
    openedAt: shift.opened_at,
    openedByName: shift.opened_by_name,
    closedAt: shift.closed_at,
    closedByName: shift.closed_by_name,
    initialCash: shift.initial_cash,
    status: shift.status,
    totals: {
      totalBilliard,
      totalProducts,
      tableProducts,
      barSales,
      grossTotal,
      totalQr,
      totalQrNet: totalQr,
      totalExpenses,
      cashCollected,
      transfersCount: activeTransfers.length,
      playsCount: activePlays.length,
      salesCount: activeSales.length,
      expensesCount: activeExpenses.length,
      itemsCount:
        activePlays.reduce(
          (sum, play) =>
            sum + play.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
          0
        ) +
        activeSales.reduce(
          (sum, sale) =>
            sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
          0
        ),
    },
    tablePlays: plays,
    sales,
    expenses,
    cashTransfers,
    qrPayments,
    tableSummary,
    productSummary: [],
    attendance: attendanceRows.map(mapAttendance),
    closing: null,
    audit: undefined,
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function getHistory(viewer = null) {
  const rows = all(`
    SELECT
      s.*,
      (SELECT COALESCE(SUM(billiard_amount), 0) FROM plays WHERE shift_id = s.id AND status = 'active') AS billiard_total,
      (SELECT COALESCE(SUM(products_amount), 0) FROM plays WHERE shift_id = s.id AND status = 'active') AS table_products_total,
      (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE shift_id = s.id AND status = 'active') AS bar_sales_total,
      (SELECT COALESCE(SUM(qr_amount), 0) FROM plays WHERE shift_id = s.id AND status = 'active')
        + (SELECT COALESCE(SUM(qr_amount), 0) FROM sales WHERE shift_id = s.id AND status = 'active') AS qr_total,
      (SELECT COALESCE(SUM(cash_amount), 0) FROM plays WHERE shift_id = s.id AND status = 'active')
        + (SELECT COALESCE(SUM(cash_amount), 0) FROM sales WHERE shift_id = s.id AND status = 'active') AS cash_total,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE shift_id = s.id AND status = 'active') AS expenses_total,
      (SELECT COALESCE(SUM(amount), 0) FROM cash_transfers
        WHERE shift_id = s.id AND status = 'active' AND direction = 'cash_to_qr') AS cash_transfers_in,
      (SELECT COALESCE(SUM(amount), 0) FROM cash_transfers
        WHERE shift_id = s.id AND status = 'active' AND direction = 'qr_to_cash') AS cash_transfers_out,
      (SELECT COUNT(*) FROM cash_transfers WHERE shift_id = s.id AND status = 'active') AS transfers_count,
      (SELECT COUNT(*) FROM plays WHERE shift_id = s.id AND status = 'active') AS plays_count,
      (SELECT COUNT(*) FROM sales WHERE shift_id = s.id AND status = 'active') AS sales_count,
      (SELECT COUNT(*) FROM expenses WHERE shift_id = s.id AND status = 'active') AS expenses_count
    FROM shifts s
    ORDER BY s.opened_at DESC
  `);

  return rows.map((row) => {
    const includeExpected = row.status === 'closed' || viewer?.role === 'admin';
    // Se usa el mismo detalle que la planilla para que el historial, el
    // detalle y la planilla muestren exactamente los mismos totales:
    // una sola fecha por turno y el consumo de mesas abiertas incluido.
    const detail = getShiftDetail(row.id, viewer, {
      includeAudit: false,
      includeExpected,
    });
    const fallbackTotalBilliard = round2(row.billiard_total);
    const fallbackTotalProducts = round2(row.table_products_total + row.bar_sales_total);
    const fallbackCashCollected = round2(row.cash_total);
    const fallbackTotalExpenses = round2(row.expenses_total);
    const fallbackTransfersIn = round2(row.cash_transfers_in);
    const fallbackTransfersOut = round2(row.cash_transfers_out);
    const fallbackExpectedCash = round2(
      Number(row.initial_cash || 0) +
        fallbackCashCollected -
        fallbackTotalExpenses +
        fallbackTransfersIn -
        fallbackTransfersOut
    );
    const totals = detail?.totals ?? {
      totalBilliard: fallbackTotalBilliard,
      totalProducts: fallbackTotalProducts,
      tableProducts: round2(row.table_products_total),
      barSales: round2(row.bar_sales_total),
      grossTotal: round2(fallbackTotalBilliard + fallbackTotalProducts),
      totalQr: round2(row.qr_total),
      totalQrNet: round2(Number(row.qr_total) + fallbackTransfersOut - fallbackTransfersIn),
      totalExpenses: fallbackTotalExpenses,
      cashTransfersIn: fallbackTransfersIn,
      cashTransfersOut: fallbackTransfersOut,
      transfersCount: row.transfers_count,
      ...(includeExpected
        ? { expectedCash: fallbackExpectedCash, cashCollected: fallbackCashCollected }
        : {}),
      playsCount: row.plays_count,
      salesCount: row.sales_count,
      expensesCount: row.expenses_count,
      itemsCount: 0,
    };

    return {
      id: row.id,
      dateStart: row.date_start,
      dateEnd: row.closed_at ? localDateKey(new Date(row.closed_at)) : null,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      openedByName: row.opened_by_name,
      closedByName: row.closed_by_name,
      initialCash: row.initial_cash,
      status: row.status,
      totals,
      closing: {
        expectedCash: row.expected_cash,
        countedCash: row.counted_cash,
        difference: row.difference,
        notes: row.closing_notes,
      },
      hasDiscrepancy:
        row.status === 'closed' &&
        row.difference !== null &&
        Math.abs(Number(row.difference)) > 0.009,
    };
  });
}
