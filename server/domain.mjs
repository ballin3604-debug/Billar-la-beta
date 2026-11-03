import {
  all,
  get,
  getSettings,
  localDateKey,
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

export function formatDuration(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  return `${mins}m`;
}

export function computeSessionCost(startTime, ratePerHour, minimumCharge, nowMs = Date.now()) {
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

  let cash = cashAmount === null || cashAmount === undefined || cashAmount === ''
    ? null
    : round2(Number(cashAmount));
  let qr = qrAmount === null || qrAmount === undefined || qrAmount === ''
    ? null
    : round2(Number(qrAmount));

  if (cash === null && qr === null) {
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

function mapTable(row) {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    ratePerHour: row.rate_per_hour,
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
    status: row.status,
    voidedByName: row.voided_by_name,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    items,
  };
}

function mapExpense(row) {
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
            openedByName: session.opened_by_name,
            items,
            itemsAmount: itemsTotal(items),
          }
        : null,
    };
  });

  const openShift = getOpenShiftRow();
  const currentShift = openShift
    ? getShiftDetail(openShift.id, viewer, { includeAudit: false })
    : null;

  const users = viewer?.role === 'admin'
    ? all('SELECT * FROM users ORDER BY active DESC, name ASC').map(publicUser)
    : undefined;

  return {
    user: publicUser(viewer),
    settings,
    tables,
    products: productsRows.map(mapProduct),
    currentShift,
    users,
    serverTime: new Date().toISOString(),
  };
}

export function getShiftDetail(shiftId, viewer = null, options = {}) {
  const shift = getShiftRow(shiftId);
  if (!shift) return null;

  const includeExpected = options.includeExpected !== undefined
    ? Boolean(options.includeExpected)
    : viewer?.role === 'admin' || shift.status === 'closed';

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

  const expenses = all(
    'SELECT * FROM expenses WHERE shift_id = ? ORDER BY created_at ASC, id ASC',
    shiftId
  ).map(mapExpense);

  const activePlays = plays.filter((play) => play.status === 'active');
  const activeSales = sales.filter((sale) => sale.status === 'active');
  const activeExpenses = expenses.filter((expense) => expense.status === 'active');

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
  const totalExpenses = round2(
    activeExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  );
  const expectedCash = round2(
    Number(shift.initial_cash || 0) + cashCollected - totalExpenses
  );

  const totals = {
    totalBilliard,
    totalProducts,
    tableProducts,
    barSales,
    grossTotal,
    totalQr,
    totalExpenses,
    cashCollected,
    expectedCash,
    playsCount: activePlays.length,
    salesCount: activeSales.length,
    expensesCount: activeExpenses.length,
    itemsCount: activePlays.reduce(
      (sum, play) => sum + play.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ) + activeSales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    ),
  };
  if (!includeExpected) {
    delete totals.expectedCash;
    delete totals.cashCollected;
  }

  const productMap = new Map();
  const addProduct = (name, quantity, amount) => {
    const existing = productMap.get(name) || { name, quantity: 0, amount: 0 };
    existing.quantity += Number(quantity || 0);
    existing.amount = round2(existing.amount + Number(amount || 0));
    productMap.set(name, existing);
  };
  for (const play of activePlays) {
    for (const item of play.items) {
      addProduct(item.name, item.quantity, item.price * item.quantity);
    }
  }
  for (const sale of activeSales) {
    for (const item of sale.items) {
      addProduct(item.name, item.quantity, item.price * item.quantity);
    }
  }
  const productSummary = [...productMap.values()]
    .map((item) => ({ ...item }))
    .sort((a, b) => b.amount - a.amount);

  const tableRows = all(
    `SELECT t.id, t.number, t.name
     FROM tables t
     WHERE t.active = 1
        OR EXISTS (SELECT 1 FROM plays p WHERE p.table_id = t.id AND p.shift_id = ?)
     ORDER BY t.number ASC`,
    shiftId
  );
  const tableSummary = tableRows.map((table) => {
    const tablePlays = activePlays.filter((play) => play.tableId === table.id);
    const billiard = round2(
      tablePlays.reduce((sum, play) => sum + Number(play.billiardAmount || 0), 0)
    );
    const products = round2(
      tablePlays.reduce((sum, play) => sum + Number(play.productsAmount || 0), 0)
    );
    return {
      tableId: table.id,
      tableNumber: table.number,
      tableName: table.name,
      playsCount: tablePlays.length,
      billiard,
      products,
      total: round2(billiard + products),
    };
  });

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
    tablePlays: plays,
    sales,
    expenses,
    qrPayments,
    tableSummary,
    productSummary,
    closing,
    audit,
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
      (SELECT COUNT(*) FROM plays WHERE shift_id = s.id AND status = 'active') AS plays_count,
      (SELECT COUNT(*) FROM sales WHERE shift_id = s.id AND status = 'active') AS sales_count,
      (SELECT COUNT(*) FROM expenses WHERE shift_id = s.id AND status = 'active') AS expenses_count
    FROM shifts s
    ORDER BY s.opened_at DESC
  `);

  return rows.map((row) => {
    const totalBilliard = round2(row.billiard_total);
    const totalProducts = round2(row.table_products_total + row.bar_sales_total);
    const cashCollected = round2(row.cash_total);
    const totalExpenses = round2(row.expenses_total);
    const expectedCash = round2(Number(row.initial_cash || 0) + cashCollected - totalExpenses);
    const includeExpected = row.status === 'closed' || viewer?.role === 'admin';

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
      totals: {
        totalBilliard,
        totalProducts,
        grossTotal: round2(totalBilliard + totalProducts),
        totalQr: round2(row.qr_total),
        totalExpenses,
        ...(includeExpected ? { expectedCash, cashCollected } : {}),
        playsCount: row.plays_count,
        salesCount: row.sales_count,
        expensesCount: row.expenses_count,
      },
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
