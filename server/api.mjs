import express from 'express';
import { randomBytes } from 'node:crypto';
import {
  all,
  get,
  run,
  transaction,
  nowIso,
  getSettings,
  saveSettings,
  hashPin,
  verifyPin,
  pinIsValid,
  pinInUse,
  createBackup,
  listBackups,
  logAudit,
  localDateKey,
  isTableColor,
  pickTableColor,
} from './database.mjs';
import {
  buildReceiptEscPos,
  buildTestEscPos,
  listPrinters,
  printRaw,
} from './print-raw.mjs';
import {
  HttpError,
  round2,
  buildState,
  getShiftDetail,
  getCashierShiftDetail,
  getSaleDetail,
  getHistory,
  getOpenShiftRow,
  getOpenSessionForTable,
  getSessionItems,
  getCustomerTabItems,
  itemsTotal,
  computeSessionCost,
  normalizePayment,
  normalizePlayerType,
  applyPlayerTypeDiscount,
  playerTypeLabel,
  publicUser,
  getAttendance,
  recordStaffCheckIn,
  recordStaffCheckOut,
} from './domain.mjs';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 60 * 1000;
const tokens = new Map();
const loginAttempts = new Map();

const EXPENSE_CATEGORIES = new Set(['comida', 'personal', 'compras', 'servicios', 'otro']);
const PRODUCT_CATEGORIES = new Set(['cervezas', 'bebidas', 'snacks', 'multas', 'otros']);
const TRANSFER_DIRECTIONS = new Set(['qr_to_cash', 'cash_to_qr']);

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'local';
}

function issueToken(user) {
  const token = randomBytes(32).toString('hex');
  tokens.set(token, {
    userId: user.id,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    createdAt: Date.now(),
  });
  return token;
}

function authRequired(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const session = token ? tokens.get(token) : null;

  if (!session || session.expiresAt < Date.now()) {
    if (token) tokens.delete(token);
    return res.status(401).json({ ok: false, error: 'Tu sesión expiró. Ingresa tu PIN nuevamente.' });
  }

  const user = get('SELECT * FROM users WHERE id = ?', session.userId);
  if (!user || !user.active) {
    tokens.delete(token);
    return res.status(401).json({ ok: false, error: 'Este usuario ya no está activo.' });
  }

  session.expiresAt = Date.now() + TOKEN_TTL_MS;
  req.user = user;
  req.token = token;
  req.ipAddress = clientIp(req);
  next();
}

function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo el administrador puede realizar esta acción.' });
  }
  next();
}

function requireOpenShift() {
  const shift = getOpenShiftRow();
  if (!shift) {
    throw new HttpError(409, 'No hay una caja abierta. Abre la caja para continuar.');
  }
  return shift;
}

function requireTable(tableId) {
  const table = get('SELECT * FROM tables WHERE id = ?', tableId);
  if (!table) throw new HttpError(404, 'La mesa no existe.');
  if (!table.active) throw new HttpError(409, 'Esta mesa está desactivada.');
  return table;
}

function requireOpenSession(tableId, shiftId) {
  const session = getOpenSessionForTable(tableId, shiftId);
  if (!session) {
    throw new HttpError(409, 'La mesa no está ocupada.');
  }
  return session;
}

function ensureSessionEditable(session) {
  if (session.checkout_started_at) {
    throw new HttpError(
      409,
      'El cobro de esta mesa está en curso. Cancela el cobro para modificar el consumo.'
    );
  }
}

function numberField(value, label, { min = 0, max = 10000000 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${label} no es válido.`);
  }
  return parsed;
}

function textField(value, label, min = 1, max = 120) {
  const text = String(value ?? '').trim();
  if (text.length < min || text.length > max) {
    throw new HttpError(400, `${label} debe tener entre ${min} y ${max} caracteres.`);
  }
  return text;
}

function tableColorField(value) {
  const color = String(value ?? '').trim();
  if (!isTableColor(color)) {
    throw new HttpError(400, 'El color de la mesa no es válido.');
  }
  return color;
}

function takeStock(product, quantity) {
  if (product.stock === null || product.stock === undefined) return;
  if (Number(product.stock) < quantity) {
    throw new HttpError(409, `Stock insuficiente de ${product.name}. Quedan ${product.stock}.`);
  }
  run('UPDATE products SET stock = stock - ? WHERE id = ?', quantity, product.id);
}

function restoreStock(productId, quantity) {
  if (!productId) return;
  const product = get('SELECT id, stock FROM products WHERE id = ?', productId);
  if (!product || product.stock === null) return;
  run('UPDATE products SET stock = stock + ? WHERE id = ?', quantity, productId);
}

function findUsersByPin(pin) {
  return all('SELECT * FROM users WHERE active = 1').filter((user) =>
    verifyPin(pin, user.pin_hash, user.pin_salt)
  );
}

function publicState(req) {
  return buildState(req.user);
}

function summarizeItems(items) {
  return items.map((item) => `${item.quantity}x ${item.name}`).join(', ');
}

function parsePositiveId(value, label = 'identificador') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `El ${label} no es válido.`);
  }
  return id;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRows(rows) {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

function csvDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value) => String(value).padStart(2, '0');
  return `${localDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function createApiRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      app: 'billar-caja',
      version: '0.9.0',
      time: nowIso(),
    });
  });

  router.get('/auth/status', (req, res) => {
    const count = get('SELECT COUNT(*) AS count FROM users');
    const firstUser = get('SELECT must_change_pin FROM users ORDER BY id ASC LIMIT 1');
    const settings = getSettings();
    res.json({
      ok: true,
      businessName: settings.businessName,
      needsSetup: count?.count === 1 && Boolean(firstUser?.must_change_pin),
      version: '0.9.0',
    });
  });

  router.post('/auth/login', (req, res) => {
    const ip = clientIp(req);
    const now = Date.now();
    const attempt = loginAttempts.get(ip);
    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      const retryAfter = Math.ceil((attempt.lockedUntil - now) / 1000);
      return res.status(429).json({
        ok: false,
        error: `Demasiados intentos. Espera ${retryAfter} segundos.`,
        retryAfter,
      });
    }
    if (attempt?.lockedUntil && attempt.lockedUntil <= now) {
      loginAttempts.delete(ip);
    }

    const pin = String(req.body?.pin ?? '').trim();
    if (!pinIsValid(pin)) {
      return res.status(400).json({ ok: false, error: 'El PIN debe tener entre 4 y 6 dígitos.' });
    }

    const matches = findUsersByPin(pin);
    if (matches.length === 0) {
      const record = loginAttempts.get(ip) || { count: 0 };
      record.count += 1;
      let remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - record.count);
      if (record.count >= MAX_LOGIN_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOGIN_LOCK_MS;
        record.count = 0;
        remaining = 0;
      }
      loginAttempts.set(ip, record);
      logAudit({
        action: 'login_failed',
        details: { attempts: record.count || MAX_LOGIN_ATTEMPTS },
        ip,
        shiftId: getOpenShiftRow()?.id ?? null,
      });
      return res.status(401).json({
        ok: false,
        error: remaining > 0
          ? `PIN incorrecto. Te quedan ${remaining} intento${remaining === 1 ? '' : 's'}.`
          : 'Demasiados intentos. Espera un minuto e intenta de nuevo.',
        remaining,
      });
    }

    if (matches.length > 1) {
      logAudit({ action: 'login_failed_duplicate_pin', ip });
      return res.status(409).json({
        ok: false,
        error: 'Hay dos usuarios con el mismo PIN. Pide al administrador que cambie uno.',
      });
    }

    const user = matches[0];
    loginAttempts.delete(ip);
    const shift = getOpenShiftRow();
    const attendance = recordStaffCheckIn({
      user,
      shiftId: shift?.id ?? null,
      ip,
    });
    if (attendance.created) {
      logAudit({
        user,
        action: 'staff_check_in',
        entityType: 'user',
        entityId: user.id,
        shiftId: shift?.id ?? null,
        details: { checkInAt: attendance.attendance.checkInAt },
        ip,
      });
    }

    for (const closed of attendance.closed || []) {
      logAudit({
        user,
        action: 'staff_check_out',
        entityType: 'user',
        entityId: user.id,
        shiftId: closed.shiftId ?? null,
        details: {
          checkInAt: closed.checkInAt,
          checkOutAt: closed.checkOutAt,
          auto: true,
          reason: 'Cierre automático de una jornada anterior sin salida',
        },
        ip,
      });
    }

    const token = issueToken(user);
    logAudit({
      user,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      shiftId: shift?.id ?? null,
      details: { role: user.role },
      ip,
    });

    res.json({
      ok: true,
      token,
      user: publicUser(user),
      state: buildState(user),
      message: `Bienvenido, ${user.name}.`,
    });
  });

  router.post('/auth/logout', authRequired, (req, res) => {
    const shift = getOpenShiftRow();
    const attendance = recordStaffCheckOut({
      user: req.user,
      shift,
      ip: req.ipAddress,
      createIfMissing: false,
    });
    if (attendance) {
      logAudit({
        user: req.user,
        action: 'staff_check_out',
        entityType: 'user',
        entityId: req.user.id,
        shiftId: shift?.id ?? null,
        details: {
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
          reason: 'Cierre de sesión',
        },
        ip: req.ipAddress,
      });
    }
    logAudit({
      user: req.user,
      action: 'logout',
      shiftId: shift?.id ?? null,
      ip: req.ipAddress,
    });
    tokens.delete(req.token);
    res.json({ ok: true, message: 'Sesión cerrada.' });
  });

  router.post('/auth/change-pin', authRequired, (req, res) => {
    const currentPin = String(req.body?.currentPin ?? '').trim();
    const newPin = String(req.body?.newPin ?? '').trim();

    if (!verifyPin(currentPin, req.user.pin_hash, req.user.pin_salt)) {
      throw new HttpError(403, 'El PIN actual no es correcto.');
    }
    if (!pinIsValid(newPin)) {
      throw new HttpError(400, 'El PIN nuevo debe tener entre 4 y 6 dígitos.');
    }
    if (currentPin === newPin) {
      throw new HttpError(400, 'El PIN nuevo debe ser diferente al actual.');
    }
    if (pinInUse(newPin, req.user.id)) {
      throw new HttpError(409, 'Ese PIN ya está en uso por otro usuario.');
    }

    const { hash, salt } = hashPin(newPin);
    run(
      'UPDATE users SET pin_hash = ?, pin_salt = ?, must_change_pin = 0 WHERE id = ?',
      hash,
      salt,
      req.user.id
    );

    for (const [token, session] of tokens.entries()) {
      if (session.userId === req.user.id && token !== req.token) {
        tokens.delete(token);
      }
    }

    const updatedUser = get('SELECT * FROM users WHERE id = ?', req.user.id);
    req.user = updatedUser;
    logAudit({
      user: updatedUser,
      action: 'change_pin',
      entityType: 'user',
      entityId: updatedUser.id,
      shiftId: getOpenShiftRow()?.id ?? null,
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: buildState(updatedUser),
      message: 'PIN actualizado.',
    });
  });

  router.get('/state', authRequired, (req, res) => {
    res.json({ ok: true, state: publicState(req) });
  });

  router.get('/history', authRequired, adminRequired, (req, res) => {
    res.json({ ok: true, shifts: getHistory(req.user) });
  });

  router.get('/attendance', authRequired, adminRequired, (req, res) => {
    res.json({ ok: true, entries: getAttendance(req.user, req.query.limit) });
  });

  router.get('/shifts/:id', authRequired, adminRequired, (req, res) => {
    const shiftId = parsePositiveId(req.params.id, 'turno');
    const shift = getShiftDetail(shiftId, req.user, { includeAudit: true });
    if (!shift) throw new HttpError(404, 'El turno no existe.');
    res.json({ ok: true, shift });
  });

  router.post('/shifts/open', authRequired, (req, res) => {
    if (getOpenShiftRow()) {
      throw new HttpError(409, 'Ya hay una caja abierta. Ciérrala antes de abrir otra.');
    }
    const settings = getSettings();
    // El fondo inicial es fijo para todos los usuarios. Solo se cambia
    // desde Ajustes > Informacion general.
    const initialCash = round2(Number(settings.defaultInitialCash || 0));
    const openedAt = nowIso();

    const result = transaction(() => {
      const insert = run(
        `INSERT INTO shifts
         (date_start, opened_at, opened_by, opened_by_name, initial_cash, status)
         VALUES (?, ?, ?, ?, ?, 'open')`,
        localDateKey(new Date(openedAt)),
        openedAt,
        req.user.id,
        req.user.name,
        initialCash
      );
      return Number(insert.lastInsertRowid);
    });

    logAudit({
      user: req.user,
      action: 'shift_open',
      entityType: 'shift',
      entityId: result,
      shiftId: result,
      details: { initialCash },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Caja abierta con ${initialCash} ${getSettings().currency} de fondo.`,
    });
  });

  router.post('/shifts/close', authRequired, (req, res) => {
    const shift = getOpenShiftRow();
    if (!shift) throw new HttpError(409, 'No hay una caja abierta.');

    const openSessions = all(
      `SELECT s.id, t.name
       FROM sessions s JOIN tables t ON t.id = s.table_id
       WHERE s.shift_id = ? AND s.status = 'open'
       ORDER BY t.number`,
      shift.id
    );
    if (openSessions.length > 0) {
      throw new HttpError(
        409,
        `Hay mesas abiertas (${openSessions.map((session) => session.name).join(', ')}). Cóbralas o anúlalas antes de cerrar la caja.`
      );
    }

    const detail = getShiftDetail(shift.id, req.user, { includeExpected: true, includeAudit: false });
    const expectedCash = round2(detail?.totals?.expectedCash ?? 0);
    const countedCash = round2(numberField(req.body?.countedCash, 'El efectivo contado', { max: 1000000 }));
    const difference = round2(countedCash - expectedCash);
    const notes = String(req.body?.notes ?? '').trim().slice(0, 500);
    const denominations = req.body?.denominations && typeof req.body.denominations === 'object'
      ? req.body.denominations
      : null;

    if (req.user.role === 'admin' && Math.abs(difference) > 0.009 && !notes) {
      throw new HttpError(400, 'Explica la diferencia de caja antes de cerrar el turno.');
    }

    const closedAt = nowIso();
    let attendance = null;

    transaction(() => {
      run(
        `UPDATE shifts
         SET status = 'closed', closed_at = ?, closed_by = ?, closed_by_name = ?,
             expected_cash = ?, counted_cash = ?, difference = ?, closing_notes = ?, denominations = ?
         WHERE id = ?`,
        closedAt,
        req.user.id,
        req.user.name,
        expectedCash,
        countedCash,
        difference,
        notes || null,
        denominations ? JSON.stringify(denominations) : null,
        shift.id
      );
      attendance = recordStaffCheckOut({
        user: req.user,
        shift,
        ip: req.ipAddress,
        at: closedAt,
      });
    });

    logAudit({
      user: req.user,
      action: 'shift_close',
      entityType: 'shift',
      entityId: shift.id,
      shiftId: shift.id,
      details: { expectedCash, countedCash, difference, notes },
      ip: req.ipAddress,
    });

    if (attendance) {
      logAudit({
        user: req.user,
        action: 'staff_check_out',
        entityType: 'user',
        entityId: req.user.id,
        shiftId: shift.id,
        details: {
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
        },
        ip: req.ipAddress,
      });
    }

    try {
      createBackup('cierre');
    } catch (error) {
      console.error('No se pudo crear el respaldo automático:', error);
    }

    const closedShift = req.user.role === 'admin'
      ? getShiftDetail(shift.id, req.user, {
          includeExpected: true,
          includeAudit: false,
        })
      : getCashierShiftDetail(shift.id, req.user);

    res.json({
      ok: true,
      state: publicState(req),
      closedShift,
      message: 'Caja cerrada y guardada.',
    });
  });

  router.post('/tables/:id/start', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    if (getOpenSessionForTable(tableId)) {
      throw new HttpError(409, 'La mesa ya está ocupada.');
    }
    const playerType = normalizePlayerType(req.body?.playerType);
    const startTime = nowIso();
    const inserted = transaction(() => {
      const result = run(
        `INSERT INTO sessions
         (shift_id, table_id, opened_by, opened_by_name, start_time, rate_per_hour, player_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
        shift.id,
        table.id,
        req.user.id,
        req.user.name,
        startTime,
        table.rate_per_hour,
        playerType
      );
      return Number(result.lastInsertRowid);
    });

    logAudit({
      user: req.user,
      action: 'table_start',
      entityType: 'session',
      entityId: inserted,
      shiftId: shift.id,
      details: { table: table.name, ratePerHour: table.rate_per_hour, playerType },
      ip: req.ipAddress,
    });

    const typeNote =
      playerType === 'staff'
        ? ' (encargados, sin cobro de mesa)'
        : playerType === 'mixed'
        ? ' (encargado + cliente, 50% de mesa)'
        : '';
    res.json({
      ok: true,
      state: publicState(req),
      message: `${table.name} iniciada${typeNote}.`,
    });
  });

  router.post('/tables/:id/items', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);
    ensureSessionEditable(session);
    const productId = parsePositiveId(req.body?.productId, 'producto');
    const quantity = Math.floor(Number(req.body?.quantity ?? 1));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw new HttpError(400, 'La cantidad debe estar entre 1 y 50.');
    }
    const product = get('SELECT * FROM products WHERE id = ?', productId);
    if (!product || !product.active) {
      throw new HttpError(404, 'El producto no está disponible.');
    }

    transaction(() => {
      const existing = get(
        'SELECT * FROM session_items WHERE session_id = ? AND product_id = ? LIMIT 1',
        session.id,
        product.id
      );
      takeStock(product, quantity);
      if (existing) {
        run(
          'UPDATE session_items SET quantity = quantity + ? WHERE id = ?',
          quantity,
          existing.id
        );
      } else {
        run(
          `INSERT INTO session_items
           (session_id, product_id, name, price, quantity, created_by, created_by_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          session.id,
          product.id,
          product.name,
          product.price,
          quantity,
          req.user.id,
          req.user.name,
          nowIso()
        );
      }
    });

    logAudit({
      user: req.user,
      action: 'table_item_add',
      entityType: 'session',
      entityId: session.id,
      shiftId: shift.id,
      details: { table: table.name, product: product.name, quantity, price: product.price },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `${quantity}× ${product.name} agregado a ${table.name}.`,
    });
  });

  router.delete('/tables/:id/items/:itemId', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);
    ensureSessionEditable(session);
    const itemId = parsePositiveId(req.params.itemId, 'ítem');
    const item = get(
      'SELECT * FROM session_items WHERE id = ? AND session_id = ?',
      itemId,
      session.id
    );
    if (!item) throw new HttpError(404, 'Ese producto ya no está en la mesa.');

    transaction(() => {
      if (item.quantity > 1) {
        run('UPDATE session_items SET quantity = quantity - 1 WHERE id = ?', item.id);
      } else {
        run('DELETE FROM session_items WHERE id = ?', item.id);
      }
      restoreStock(item.product_id, 1);
    });

    logAudit({
      user: req.user,
      action: 'table_item_remove',
      entityType: 'session',
      entityId: session.id,
      shiftId: shift.id,
      details: { table: table.name, product: item.name, quantity: 1 },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Se quitó 1× ${item.name} de ${table.name}.`,
    });
  });

  router.post('/tables/:id/checkout/start', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);
    let checkoutStartedAt = session.checkout_started_at;
    let frozenNow = false;

    if (!checkoutStartedAt) {
      const startedAt = nowIso();
      const result = run(
        `UPDATE sessions
         SET checkout_started_at = ?
         WHERE id = ? AND status = 'open' AND checkout_started_at IS NULL`,
        startedAt,
        session.id
      );
      const updated = get(
        'SELECT checkout_started_at FROM sessions WHERE id = ?',
        session.id
      );
      checkoutStartedAt = updated?.checkout_started_at || startedAt;
      frozenNow = result.changes > 0;

      if (frozenNow) {
        logAudit({
          user: req.user,
          action: 'table_checkout_start',
          entityType: 'session',
          entityId: session.id,
          shiftId: shift.id,
          details: { table: table.name, checkoutStartedAt },
          ip: req.ipAddress,
        });
      }
    }

    res.json({
      ok: true,
      state: publicState(req),
      ...(frozenNow
        ? { message: `Tiempo detenido. El cobro de ${table.name} quedó congelado.` }
        : {}),
    });
  });

  router.post('/tables/:id/checkout/cancel', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);

    if (!session.checkout_started_at) {
      return res.json({ ok: true, state: publicState(req) });
    }

    const startedMs = new Date(session.checkout_started_at).getTime();
    const pausedSeconds = Number.isFinite(startedMs)
      ? Math.max(0, Math.floor((Date.now() - startedMs) / 1000))
      : 0;

    transaction(() => {
      run(
        `UPDATE sessions
         SET paused_seconds = COALESCE(paused_seconds, 0) + ?,
             checkout_started_at = NULL
         WHERE id = ?`,
        pausedSeconds,
        session.id
      );
    });

    logAudit({
      user: req.user,
      action: 'table_checkout_cancel',
      entityType: 'session',
      entityId: session.id,
      shiftId: shift.id,
      details: { table: table.name, pausedSeconds },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Cobro cancelado. El tiempo de ${table.name} se reanudó.`,
    });
  });

  router.patch('/tables/:id/note', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);
    const note = String(req.body?.note ?? '').trim().slice(0, 300);

    run('UPDATE sessions SET notes = ? WHERE id = ?', note || null, session.id);

    logAudit({
      user: req.user,
      action: 'table_note_update',
      entityType: 'session',
      entityId: session.id,
      shiftId: shift.id,
      details: { table: table.name, hasNote: Boolean(note) },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
    });
  });

  router.post('/tables/:id/charge', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);
    const settings = getSettings();
    const items = getSessionItems(session.id);
    const productsAmount = itemsTotal(items);
    const endTime = session.checkout_started_at || nowIso();
    const endMs = new Date(endTime).getTime();
    const computed = computeSessionCost(
      session.start_time,
      session.rate_per_hour,
      settings.minimumPlayCharge,
      Number.isFinite(endMs) ? endMs : Date.now(),
      session.paused_seconds
    );

    const playerType = normalizePlayerType(session.player_type);
    let baseBilliard = computed.cost;
    let manualAdjustment = false;
    if (req.body?.billiardAmount !== undefined && req.body?.billiardAmount !== null && req.body?.billiardAmount !== '') {
      if (req.user.role !== 'admin') {
        throw new HttpError(403, 'Solo el administrador puede modificar el monto del billar.');
      }
      baseBilliard = round2(numberField(req.body.billiardAmount, 'El monto de billar'));
      manualAdjustment = Math.abs(baseBilliard - computed.cost) > 0.009;
    }
    const billiardAmount = applyPlayerTypeDiscount(baseBilliard, playerType);

    const totalAmount = round2(billiardAmount + productsAmount);
    const payment = normalizePayment(
      totalAmount,
      req.body?.paymentMethod,
      req.body?.cashAmount,
      req.body?.qrAmount,
      req.body?.qrReference
    );
    const noteInput = String(req.body?.notes ?? '').trim().slice(0, 300);
    const notes = noteInput || String(session.notes || '').trim().slice(0, 300) || null;
    const itemNumber = (get(
      'SELECT COUNT(*) AS count FROM plays WHERE shift_id = ? AND table_id = ?',
      shift.id,
      table.id
    )?.count || 0) + 1;

    const playId = transaction(() => {
      const result = run(
        `INSERT INTO plays
         (shift_id, session_id, table_id, table_number, table_name, item_number,
          opened_by, opened_by_name, closed_by, closed_by_name, start_time, end_time,
          duration_minutes, billiard_amount, computed_billiard_amount, products_amount,
          total_amount, payment_method, cash_amount, qr_amount, qr_reference, notes,
          player_type, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        shift.id,
        session.id,
        table.id,
        table.number,
        table.name,
        itemNumber,
        session.opened_by,
        session.opened_by_name,
        req.user.id,
        req.user.name,
        session.start_time,
        endTime,
        computed.minutes,
        billiardAmount,
        computed.cost,
        productsAmount,
        totalAmount,
        payment.paymentMethod,
        payment.cashAmount,
        payment.qrAmount,
        payment.qrReference,
        notes,
        playerType,
        endTime
      );
      const insertedId = Number(result.lastInsertRowid);
      run(
        "UPDATE sessions SET status = 'charged', closed_at = ?, closed_by = ?, closed_by_name = ?, checkout_started_at = NULL WHERE id = ?",
        endTime,
        req.user.id,
        req.user.name,
        session.id
      );
      return insertedId;
    });

    logAudit({
      user: req.user,
      action: 'table_charge',
      entityType: 'play',
      entityId: playId,
      shiftId: shift.id,
      details: {
        table: table.name,
        minutes: computed.minutes,
        computedBilliard: computed.cost,
        billiardAmount,
        manualAdjustment,
        playerType,
        products: summarizeItems(items),
        productsAmount,
        totalAmount,
        paymentMethod: payment.paymentMethod,
        cashAmount: payment.cashAmount,
        qrAmount: payment.qrAmount,
      },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `${table.name} cobrada: ${totalAmount} ${settings.currency}.`,
    });
  });

  router.post('/tables/:id/cancel', authRequired, adminRequired, (req, res) => {
    const shift = requireOpenShift();
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = requireTable(tableId);
    const session = requireOpenSession(tableId, shift.id);
    const reason = textField(req.body?.reason, 'El motivo de anulación', 3, 200);
    const items = getSessionItems(session.id);

    transaction(() => {
      run(
        "UPDATE sessions SET status = 'cancelled', closed_at = ?, closed_by = ?, closed_by_name = ? WHERE id = ?",
        nowIso(),
        req.user.id,
        req.user.name,
        session.id
      );
      for (const item of items) {
        restoreStock(item.productId, item.quantity);
      }
    });

    logAudit({
      user: req.user,
      action: 'table_cancel',
      entityType: 'session',
      entityId: session.id,
      shiftId: shift.id,
      details: { table: table.name, reason, items: summarizeItems(items) },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `${table.name} anulada. Quedó registrada en auditoría.`,
    });
  });

  router.post('/sales', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) throw new HttpError(400, 'La venta no tiene productos.');

    const merged = new Map();
    for (const rawItem of rawItems) {
      const productId = parsePositiveId(rawItem?.productId, 'producto');
      const quantity = Math.floor(Number(rawItem?.quantity ?? 0));
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new HttpError(400, 'Hay una cantidad inválida en la venta.');
      }
      merged.set(productId, (merged.get(productId) || 0) + quantity);
      if (merged.get(productId) > 99) {
        throw new HttpError(400, 'La cantidad máxima por producto es 99.');
      }
    }

    const items = [];
    for (const [productId, quantity] of merged.entries()) {
      const product = get('SELECT * FROM products WHERE id = ?', productId);
      if (!product || !product.active) {
        throw new HttpError(404, `El producto ${productId} no está disponible.`);
      }
      items.push({ product, quantity });
    }

    const totalAmount = round2(
      items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0)
    );
    if (totalAmount <= 0) throw new HttpError(400, 'El total de la venta debe ser mayor a cero.');

    const payment = normalizePayment(
      totalAmount,
      req.body?.paymentMethod,
      req.body?.cashAmount,
      req.body?.qrAmount,
      req.body?.qrReference
    );
    const notes = String(req.body?.notes ?? '').trim().slice(0, 300) || null;
    const createdAt = nowIso();
    const settings = getSettings();

    const saleId = transaction(() => {
      for (const item of items) takeStock(item.product, item.quantity);
      const result = run(
        `INSERT INTO sales
         (shift_id, created_by, created_by_name, created_at, total_amount, payment_method,
          cash_amount, qr_amount, qr_reference, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        shift.id,
        req.user.id,
        req.user.name,
        createdAt,
        totalAmount,
        payment.paymentMethod,
        payment.cashAmount,
        payment.qrAmount,
        payment.qrReference,
        notes
      );
      const insertedId = Number(result.lastInsertRowid);
      for (const item of items) {
        run(
          `INSERT INTO sale_items (sale_id, product_id, name, price, quantity)
           VALUES (?, ?, ?, ?, ?)`,
          insertedId,
          item.product.id,
          item.product.name,
          item.product.price,
          item.quantity
        );
      }
      return insertedId;
    });

    logAudit({
      user: req.user,
      action: 'sale',
      entityType: 'sale',
      entityId: saleId,
      shiftId: shift.id,
      details: {
        items: items.map((item) => `${item.quantity}x ${item.product.name}`).join(', '),
        totalAmount,
        paymentMethod: payment.paymentMethod,
        cashAmount: payment.cashAmount,
        qrAmount: payment.qrAmount,
      },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      sale: getSaleDetail(saleId),
      message: `Venta registrada: ${totalAmount} ${settings.currency}.`,
    });
  });

  router.post('/customer-tabs', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const customerName = textField(req.body?.customerName, 'El nombre del cliente', 2, 60);
    const createdAt = nowIso();

    const result = run(
      `INSERT INTO customer_tabs
       (shift_id, opened_by, opened_by_name, created_at, customer_name, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      shift.id,
      req.user.id,
      req.user.name,
      createdAt,
      customerName
    );
    const tabId = Number(result.lastInsertRowid);

    logAudit({
      user: req.user,
      action: 'customer_tab_open',
      entityType: 'customer_tab',
      entityId: tabId,
      shiftId: shift.id,
      details: { customerName },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Cuenta abierta para ${customerName}.`,
    });
  });

  router.post('/customer-tabs/:id/items', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tabId = parsePositiveId(req.params.id, 'cuenta');
    const tab = get('SELECT * FROM customer_tabs WHERE id = ?', tabId);
    if (!tab) throw new HttpError(404, 'La cuenta no existe.');
    if (tab.shift_id !== shift.id || tab.status !== 'open') {
      throw new HttpError(409, 'Esta cuenta ya no está abierta.');
    }

    const productId = parsePositiveId(req.body?.productId, 'producto');
    const quantity = Math.floor(Number(req.body?.quantity ?? 1));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw new HttpError(400, 'La cantidad debe estar entre 1 y 50.');
    }
    const product = get('SELECT * FROM products WHERE id = ?', productId);
    if (!product || !product.active) {
      throw new HttpError(404, 'El producto no está disponible.');
    }

    transaction(() => {
      const existing = get(
        'SELECT * FROM customer_tab_items WHERE tab_id = ? AND product_id = ? LIMIT 1',
        tabId,
        product.id
      );
      takeStock(product, quantity);
      if (existing) {
        run(
          'UPDATE customer_tab_items SET quantity = quantity + ? WHERE id = ?',
          quantity,
          existing.id
        );
      } else {
        run(
          `INSERT INTO customer_tab_items
           (tab_id, product_id, name, price, quantity, created_by, created_by_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          tabId,
          product.id,
          product.name,
          product.price,
          quantity,
          req.user.id,
          req.user.name,
          nowIso()
        );
      }
    });

    logAudit({
      user: req.user,
      action: 'customer_tab_item_add',
      entityType: 'customer_tab',
      entityId: tabId,
      shiftId: shift.id,
      details: { customerName: tab.customer_name, product: product.name, quantity, price: product.price },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `${quantity}× ${product.name} agregado a ${tab.customer_name}.`,
    });
  });

  router.delete('/customer-tabs/:id/items/:itemId', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tabId = parsePositiveId(req.params.id, 'cuenta');
    const tab = get('SELECT * FROM customer_tabs WHERE id = ?', tabId);
    if (!tab) throw new HttpError(404, 'La cuenta no existe.');
    if (tab.shift_id !== shift.id || tab.status !== 'open') {
      throw new HttpError(409, 'Esta cuenta ya no está abierta.');
    }

    const itemId = parsePositiveId(req.params.itemId, 'ítem');
    const item = get(
      'SELECT * FROM customer_tab_items WHERE id = ? AND tab_id = ?',
      itemId,
      tabId
    );
    if (!item) throw new HttpError(404, 'Ese producto ya no está en la cuenta.');

    transaction(() => {
      if (item.quantity > 1) {
        run('UPDATE customer_tab_items SET quantity = quantity - 1 WHERE id = ?', item.id);
      } else {
        run('DELETE FROM customer_tab_items WHERE id = ?', item.id);
      }
      restoreStock(item.product_id, 1);
    });

    logAudit({
      user: req.user,
      action: 'customer_tab_item_remove',
      entityType: 'customer_tab',
      entityId: tabId,
      shiftId: shift.id,
      details: { customerName: tab.customer_name, product: item.name, quantity: 1 },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Se quitó 1× ${item.name} de ${tab.customer_name}.`,
    });
  });

  router.post('/customer-tabs/:id/charge', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const tabId = parsePositiveId(req.params.id, 'cuenta');
    const tab = get('SELECT * FROM customer_tabs WHERE id = ?', tabId);
    if (!tab) throw new HttpError(404, 'La cuenta no existe.');
    if (tab.shift_id !== shift.id || tab.status !== 'open') {
      throw new HttpError(409, 'Esta cuenta ya no está abierta.');
    }

    const items = getCustomerTabItems(tabId);
    if (items.length === 0) {
      throw new HttpError(400, 'La cuenta no tiene productos para cobrar.');
    }

    const totalAmount = round2(
      items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
    );
    if (totalAmount <= 0) {
      throw new HttpError(400, 'El total de la cuenta debe ser mayor a cero.');
    }

    const payment = normalizePayment(
      totalAmount,
      req.body?.paymentMethod,
      req.body?.cashAmount,
      req.body?.qrAmount,
      req.body?.qrReference
    );
    const notes = String(req.body?.notes ?? '').trim().slice(0, 300) || null;
    const createdAt = nowIso();
    const settings = getSettings();

    const saleId = transaction(() => {
      const result = run(
        `INSERT INTO sales
         (shift_id, created_by, created_by_name, created_at, total_amount, payment_method,
          cash_amount, qr_amount, qr_reference, notes, customer_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        shift.id,
        req.user.id,
        req.user.name,
        createdAt,
        totalAmount,
        payment.paymentMethod,
        payment.cashAmount,
        payment.qrAmount,
        payment.qrReference,
        notes,
        tab.customer_name
      );
      const insertedId = Number(result.lastInsertRowid);
      for (const item of items) {
        run(
          `INSERT INTO sale_items (sale_id, product_id, name, price, quantity)
           VALUES (?, ?, ?, ?, ?)`,
          insertedId,
          item.productId,
          item.name,
          item.price,
          item.quantity
        );
      }
      run(
        `UPDATE customer_tabs
         SET status = 'charged', charged_at = ?, closed_by = ?, closed_by_name = ?, sale_id = ?, notes = ?
         WHERE id = ?`,
        createdAt,
        req.user.id,
        req.user.name,
        insertedId,
        notes,
        tabId
      );
      return insertedId;
    });

    logAudit({
      user: req.user,
      action: 'customer_tab_charge',
      entityType: 'customer_tab',
      entityId: tabId,
      shiftId: shift.id,
      details: {
        customerName: tab.customer_name,
        saleId,
        items: items.map((item) => `${item.quantity}x ${item.name}`).join(', '),
        totalAmount,
        paymentMethod: payment.paymentMethod,
        cashAmount: payment.cashAmount,
        qrAmount: payment.qrAmount,
      },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      sale: getSaleDetail(saleId),
      message: `Cuenta de ${tab.customer_name} cobrada: ${totalAmount} ${settings.currency}.`,
    });
  });

  router.post('/customer-tabs/:id/cancel', authRequired, adminRequired, (req, res) => {
    const shift = requireOpenShift();
    const tabId = parsePositiveId(req.params.id, 'cuenta');
    const tab = get('SELECT * FROM customer_tabs WHERE id = ?', tabId);
    if (!tab) throw new HttpError(404, 'La cuenta no existe.');
    if (tab.shift_id !== shift.id) throw new HttpError(409, 'No se puede modificar un turno cerrado.');
    if (tab.status !== 'open') throw new HttpError(409, 'Esta cuenta ya no está abierta.');
    const reason = textField(req.body?.reason, 'El motivo de anulación', 3, 200);

    const items = getCustomerTabItems(tabId);
    transaction(() => {
      for (const item of items) restoreStock(item.productId, item.quantity);
      run(
        `UPDATE customer_tabs
         SET status = 'cancelled', charged_at = ?, closed_by = ?, closed_by_name = ?, notes = ?
         WHERE id = ?`,
        nowIso(),
        req.user.id,
        req.user.name,
        reason,
        tabId
      );
    });

    logAudit({
      user: req.user,
      action: 'customer_tab_cancel',
      entityType: 'customer_tab',
      entityId: tabId,
      shiftId: shift.id,
      details: { customerName: tab.customer_name, reason, items: items.map((item) => `${item.quantity}x ${item.name}`).join(', ') },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Cuenta de ${tab.customer_name} anulada. Quedó registrada en auditoría.`,
    });
  });

  router.post('/expenses', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const concept = textField(req.body?.concept, 'El concepto', 2, 120);
    const category = String(req.body?.category ?? 'otro');
    if (!EXPENSE_CATEGORIES.has(category)) throw new HttpError(400, 'La categoría del gasto no es válida.');

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length > 50) {
      throw new HttpError(400, 'El gasto admite hasta 50 productos.');
    }
    const items = rawItems.map((rawItem, index) => {
      const position = index + 1;
      const quantity = Math.floor(Number(rawItem?.quantity ?? 0));
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
        throw new HttpError(400, `La cantidad del producto #${position} no es válida.`);
      }
      let productId = null;
      let product = null;
      if (rawItem?.productId !== null && rawItem?.productId !== undefined && rawItem?.productId !== '') {
        productId = parsePositiveId(rawItem.productId, `producto del gasto #${position}`);
        product = get('SELECT id, name, price FROM products WHERE id = ?', productId);
        if (!product) {
          throw new HttpError(400, `El producto #${position} no existe en el catálogo.`);
        }
      }
      // El costo de un producto del inventario se toma del catálogo y no
      // se acepta el valor enviado por el cliente.
      const unitPrice = product
        ? round2(Number(product.price))
        : round2(
            numberField(rawItem?.unitPrice, `El costo unitario del producto #${position}`, {
              min: 0.01,
              max: 1000000,
            })
          );
      const name = product
        ? product.name
        : textField(rawItem?.name, `El nombre del producto #${position}`, 1, 80);
      return {
        productId,
        name,
        quantity,
        unitPrice,
        subtotal: round2(quantity * unitPrice),
      };
    });

    const itemsTotal = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
    const amount = items.length > 0
      ? itemsTotal
      : round2(numberField(req.body?.amount, 'El monto del gasto', { min: 0.01, max: 1000000 }));
    if (amount <= 0 || amount > 1000000) {
      throw new HttpError(400, 'El monto del gasto no es válido.');
    }
    const createdAt = nowIso();

    const expenseId = transaction(() => {
      const result = run(
        `INSERT INTO expenses
         (shift_id, created_by, created_by_name, created_at, amount, concept, category, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        shift.id,
        req.user.id,
        req.user.name,
        createdAt,
        amount,
        concept,
        category
      );
      const id = Number(result.lastInsertRowid);
      for (const item of items) {
        run(
          `INSERT INTO expense_items (expense_id, product_id, name, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?)`,
          id,
          item.productId,
          item.name,
          item.quantity,
          item.unitPrice
        );
      }
      return id;
    });

    logAudit({
      user: req.user,
      action: 'expense_add',
      entityType: 'expense',
      entityId: expenseId,
      shiftId: shift.id,
      details: {
        amount,
        concept,
        category,
        items: items.map((item) => `${item.quantity}x ${item.name}`).join(', ') || undefined,
      },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Gasto registrado: ${amount} ${getSettings().currency}.`,
    });
  });

  router.post('/transfers', authRequired, (req, res) => {
    const shift = requireOpenShift();
    const direction = String(req.body?.direction ?? '');
    if (!TRANSFER_DIRECTIONS.has(direction)) {
      throw new HttpError(400, 'El sentido del traspaso no es válido.');
    }
    const amount = round2(
      numberField(req.body?.amount, 'El monto del traspaso', { min: 0.01, max: 1000000 })
    );
    const concept = textField(req.body?.concept, 'El concepto del traspaso', 2, 120);
    const reference = String(req.body?.reference ?? '').trim().slice(0, 80) || null;
    const createdAt = nowIso();

    const inserted = run(
      `INSERT INTO cash_transfers
       (shift_id, created_by, created_by_name, created_at, direction, amount, concept, reference, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      shift.id,
      req.user.id,
      req.user.name,
      createdAt,
      direction,
      amount,
      concept,
      reference
    );
    const transferId = Number(inserted.lastInsertRowid);

    logAudit({
      user: req.user,
      action: 'cash_transfer_create',
      entityType: 'cash_transfer',
      entityId: transferId,
      shiftId: shift.id,
      details: { direction, amount, concept, reference },
      ip: req.ipAddress,
    });

    const currency = getSettings().currency;
    const message = direction === 'qr_to_cash'
      ? `Traspaso registrado: recibiste ${amount} ${currency} por QR y entregaste ${amount} ${currency} en efectivo.`
      : `Traspaso registrado: recibiste ${amount} ${currency} en efectivo y entregaste ${amount} ${currency} por QR.`;

    res.json({ ok: true, state: publicState(req), message });
  });

  router.post('/transfers/:id/void', authRequired, adminRequired, (req, res) => {
    const shift = requireOpenShift();
    const transferId = parsePositiveId(req.params.id, 'traspaso');
    const reason = textField(req.body?.reason, 'El motivo de anulación', 3, 200);
    const transfer = get('SELECT * FROM cash_transfers WHERE id = ?', transferId);
    if (!transfer) throw new HttpError(404, 'El traspaso no existe.');
    if (transfer.shift_id !== shift.id) {
      throw new HttpError(409, 'No se puede modificar un turno cerrado.');
    }
    if (transfer.status !== 'active') {
      throw new HttpError(409, 'Este traspaso ya fue anulado.');
    }

    run(
      `UPDATE cash_transfers SET status = 'voided', voided_by = ?, voided_by_name = ?,
       voided_at = ?, void_reason = ? WHERE id = ?`,
      req.user.id,
      req.user.name,
      nowIso(),
      reason,
      transferId
    );

    logAudit({
      user: req.user,
      action: 'cash_transfer_void',
      entityType: 'cash_transfer',
      entityId: transferId,
      shiftId: shift.id,
      details: {
        direction: transfer.direction,
        amount: transfer.amount,
        concept: transfer.concept,
        reason,
      },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: 'Traspaso anulado y registrado en auditoría.',
    });
  });

  router.post('/plays/:id/void', authRequired, adminRequired, (req, res) => {
    const shift = requireOpenShift();
    const playId = parsePositiveId(req.params.id, 'partida');
    const reason = textField(req.body?.reason, 'El motivo de anulación', 3, 200);
    const play = get('SELECT * FROM plays WHERE id = ?', playId);
    if (!play) throw new HttpError(404, 'La partida no existe.');
    if (play.shift_id !== shift.id) throw new HttpError(409, 'No se puede modificar un turno cerrado.');
    if (play.status !== 'active') throw new HttpError(409, 'Esta partida ya fue anulada.');

    transaction(() => {
      const items = getSessionItems(play.session_id);
      for (const item of items) restoreStock(item.product_id, item.quantity);
      run(
        `UPDATE plays SET status = 'voided', voided_by = ?, voided_by_name = ?,
         voided_at = ?, void_reason = ? WHERE id = ?`,
        req.user.id,
        req.user.name,
        nowIso(),
        reason,
        playId
      );
    });

    logAudit({
      user: req.user,
      action: 'play_void',
      entityType: 'play',
      entityId: playId,
      shiftId: shift.id,
      details: { table: play.table_name, total: play.total_amount, reason },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Partida anulada y registrada en auditoría.' });
  });

  router.post('/sales/:id/void', authRequired, adminRequired, (req, res) => {
    const shift = requireOpenShift();
    const saleId = parsePositiveId(req.params.id, 'venta');
    const reason = textField(req.body?.reason, 'El motivo de anulación', 3, 200);
    const sale = get('SELECT * FROM sales WHERE id = ?', saleId);
    if (!sale) throw new HttpError(404, 'La venta no existe.');
    if (sale.shift_id !== shift.id) throw new HttpError(409, 'No se puede modificar un turno cerrado.');
    if (sale.status !== 'active') throw new HttpError(409, 'Esta venta ya fue anulada.');

    transaction(() => {
      const items = all('SELECT * FROM sale_items WHERE sale_id = ?', saleId);
      for (const item of items) restoreStock(item.product_id, item.quantity);
      run(
        `UPDATE sales SET status = 'voided', voided_by = ?, voided_by_name = ?,
         voided_at = ?, void_reason = ? WHERE id = ?`,
        req.user.id,
        req.user.name,
        nowIso(),
        reason,
        saleId
      );
    });

    logAudit({
      user: req.user,
      action: 'sale_void',
      entityType: 'sale',
      entityId: saleId,
      shiftId: shift.id,
      details: { total: sale.total_amount, reason },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Venta anulada y registrada en auditoría.' });
  });

  router.post('/expenses/:id/void', authRequired, adminRequired, (req, res) => {
    const shift = requireOpenShift();
    const expenseId = parsePositiveId(req.params.id, 'gasto');
    const reason = textField(req.body?.reason, 'El motivo de anulación', 3, 200);
    const expense = get('SELECT * FROM expenses WHERE id = ?', expenseId);
    if (!expense) throw new HttpError(404, 'El gasto no existe.');
    if (expense.shift_id !== shift.id) throw new HttpError(409, 'No se puede modificar un turno cerrado.');
    if (expense.status !== 'active') throw new HttpError(409, 'Este gasto ya fue anulado.');

    run(
      `UPDATE expenses SET status = 'voided', voided_by = ?, voided_by_name = ?,
       voided_at = ?, void_reason = ? WHERE id = ?`,
      req.user.id,
      req.user.name,
      nowIso(),
      reason,
      expenseId
    );

    logAudit({
      user: req.user,
      action: 'expense_void',
      entityType: 'expense',
      entityId: expenseId,
      shiftId: shift.id,
      details: { amount: expense.amount, concept: expense.concept, reason },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Gasto anulado y registrado en auditoría.' });
  });

  router.get('/admin/users', authRequired, adminRequired, (req, res) => {
    const users = all('SELECT * FROM users ORDER BY active DESC, name ASC').map(publicUser);
    res.json({ ok: true, users });
  });

  router.post('/admin/users', authRequired, adminRequired, (req, res) => {
    const name = textField(req.body?.name, 'El nombre', 2, 60);
    const pin = String(req.body?.pin ?? '').trim();
    const role = req.body?.role === 'admin' ? 'admin' : 'cashier';
    if (!pinIsValid(pin)) throw new HttpError(400, 'El PIN debe tener entre 4 y 6 dígitos.');
    if (pinInUse(pin)) throw new HttpError(409, 'Ese PIN ya está en uso.');

    const { hash, salt } = hashPin(pin);
    const inserted = run(
      `INSERT INTO users (name, pin_hash, pin_salt, role, active, must_change_pin, created_at)
       VALUES (?, ?, ?, ?, 1, 1, ?)`,
      name,
      hash,
      salt,
      role,
      nowIso()
    );

    logAudit({
      user: req.user,
      action: 'user_create',
      entityType: 'user',
      entityId: Number(inserted.lastInsertRowid),
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name, role },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `Usuario ${name} creado. Debe cambiar su PIN al ingresar.`,
    });
  });

  router.patch('/admin/users/:id', authRequired, adminRequired, (req, res) => {
    const userId = parsePositiveId(req.params.id, 'usuario');
    const target = get('SELECT * FROM users WHERE id = ?', userId);
    if (!target) throw new HttpError(404, 'El usuario no existe.');

    const name = req.body?.name !== undefined
      ? textField(req.body.name, 'El nombre', 2, 60)
      : target.name;
    const role = req.body?.role !== undefined
      ? (req.body.role === 'admin' ? 'admin' : 'cashier')
      : target.role;
    const active = req.body?.active !== undefined ? Boolean(req.body.active) : Boolean(target.active);

    if (!active && userId === req.user.id) {
      throw new HttpError(400, 'No puedes desactivar tu propio usuario.');
    }

    const activeAdmins = get(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1"
    )?.count || 0;
    const targetIsActiveAdmin = target.role === 'admin' && Boolean(target.active);
    const removesAdmin = targetIsActiveAdmin && (role !== 'admin' || !active);
    if (removesAdmin && activeAdmins <= 1) {
      throw new HttpError(400, 'Debe quedar al menos un administrador activo.');
    }

    run(
      'UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?',
      name,
      role,
      active ? 1 : 0,
      userId
    );

    if (!active) {
      for (const [token, session] of tokens.entries()) {
        if (session.userId === userId) tokens.delete(token);
      }
    }

    logAudit({
      user: req.user,
      action: 'user_update',
      entityType: 'user',
      entityId: userId,
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name, role, active },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Usuario actualizado.' });
  });

  router.post('/admin/users/:id/reset-pin', authRequired, adminRequired, (req, res) => {
    const userId = parsePositiveId(req.params.id, 'usuario');
    if (userId === req.user.id) {
      throw new HttpError(400, 'Para tu propio usuario usa la opción “Cambiar mi PIN”.');
    }
    const target = get('SELECT * FROM users WHERE id = ?', userId);
    if (!target) throw new HttpError(404, 'El usuario no existe.');

    const pin = String(req.body?.pin ?? '').trim();
    if (!pinIsValid(pin)) throw new HttpError(400, 'El PIN debe tener entre 4 y 6 dígitos.');
    if (pinInUse(pin, userId)) throw new HttpError(409, 'Ese PIN ya está en uso.');

    const { hash, salt } = hashPin(pin);
    run(
      'UPDATE users SET pin_hash = ?, pin_salt = ?, must_change_pin = 1 WHERE id = ?',
      hash,
      salt,
      userId
    );

    for (const [token, session] of tokens.entries()) {
      if (session.userId === userId) tokens.delete(token);
    }

    logAudit({
      user: req.user,
      action: 'user_reset_pin',
      entityType: 'user',
      entityId: userId,
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name: target.name },
      ip: req.ipAddress,
    });

    res.json({
      ok: true,
      state: publicState(req),
      message: `PIN temporal asignado a ${target.name}. Deberá cambiarlo al ingresar.`,
    });
  });

  router.post('/admin/products', authRequired, adminRequired, (req, res) => {
    const name = textField(req.body?.name, 'El nombre del producto', 2, 60);
    const category = String(req.body?.category ?? 'otros');
    if (!PRODUCT_CATEGORIES.has(category)) throw new HttpError(400, 'La categoría no es válida.');
    const price = round2(numberField(req.body?.price, 'El precio', { min: 0.01, max: 1000000 }));
    const stock = req.body?.stock === null || req.body?.stock === undefined || req.body?.stock === ''
      ? null
      : Math.floor(numberField(req.body.stock, 'El stock', { min: 0, max: 1000000 }));
    const favorite = req.body?.favorite ? 1 : 0;

    const inserted = run(
      `INSERT INTO products (name, category, price, stock, favorite, active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      name,
      category,
      price,
      stock,
      favorite,
      nowIso()
    );

    logAudit({
      user: req.user,
      action: 'product_create',
      entityType: 'product',
      entityId: Number(inserted.lastInsertRowid),
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name, category, price, stock, favorite: Boolean(favorite) },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: `Producto ${name} creado.` });
  });

  router.patch('/admin/products/:id', authRequired, adminRequired, (req, res) => {
    const productId = parsePositiveId(req.params.id, 'producto');
    const product = get('SELECT * FROM products WHERE id = ?', productId);
    if (!product) throw new HttpError(404, 'El producto no existe.');

    const name = req.body?.name !== undefined
      ? textField(req.body.name, 'El nombre del producto', 2, 60)
      : product.name;
    const category = req.body?.category !== undefined
      ? String(req.body.category)
      : product.category;
    if (!PRODUCT_CATEGORIES.has(category)) throw new HttpError(400, 'La categoría no es válida.');
    const price = req.body?.price !== undefined
      ? round2(numberField(req.body.price, 'El precio', { min: 0.01, max: 1000000 }))
      : product.price;
    const stock = req.body?.stock !== undefined
      ? (req.body.stock === null || req.body.stock === ''
          ? null
          : Math.floor(numberField(req.body.stock, 'El stock', { min: 0, max: 1000000 })))
      : product.stock;
    const favorite = req.body?.favorite !== undefined ? (req.body.favorite ? 1 : 0) : product.favorite;
    const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : product.active;
    const priceChanged = Number(product.price) !== Number(price);

    run(
      `UPDATE products SET name = ?, category = ?, price = ?, stock = ?, favorite = ?, active = ?
       WHERE id = ?`,
      name,
      category,
      price,
      stock,
      favorite,
      active,
      productId
    );

    logAudit({
      user: req.user,
      action: priceChanged ? 'price_change' : 'product_update',
      entityType: 'product',
      entityId: productId,
      shiftId: getOpenShiftRow()?.id ?? null,
      details: {
        kind: 'product',
        name,
        before: {
          name: product.name,
          category: product.category,
          price: product.price,
          stock: product.stock,
          favorite: Boolean(product.favorite),
          active: Boolean(product.active),
        },
        after: { name, category, price, stock, favorite: Boolean(favorite), active: Boolean(active) },
        ...(priceChanged
          ? { price: { before: product.price, after: price } }
          : {}),
      },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Producto actualizado.' });
  });

  router.post('/admin/tables', authRequired, adminRequired, (req, res) => {
    const name = textField(req.body?.name, 'El nombre de la mesa', 2, 40);
    const rate = round2(numberField(req.body?.ratePerHour, 'La tarifa', { min: 0, max: 100000 }));
    const color = req.body?.color !== undefined ? tableColorField(req.body.color) : pickTableColor();
    const maxNumber = get('SELECT COALESCE(MAX(number), 0) AS number FROM tables')?.number || 0;

    const inserted = run(
      'INSERT INTO tables (number, name, rate_per_hour, color, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      maxNumber + 1,
      name,
      rate,
      color,
      nowIso()
    );

    logAudit({
      user: req.user,
      action: 'table_create',
      entityType: 'table',
      entityId: Number(inserted.lastInsertRowid),
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name, ratePerHour: rate, color },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: `Mesa ${name} creada.` });
  });

  router.patch('/admin/tables/:id', authRequired, adminRequired, (req, res) => {
    const tableId = parsePositiveId(req.params.id, 'mesa');
    const table = get('SELECT * FROM tables WHERE id = ?', tableId);
    if (!table) throw new HttpError(404, 'La mesa no existe.');

    const name = req.body?.name !== undefined
      ? textField(req.body.name, 'El nombre de la mesa', 2, 40)
      : table.name;
    const rate = req.body?.ratePerHour !== undefined
      ? round2(numberField(req.body.ratePerHour, 'La tarifa', { min: 0, max: 100000 }))
      : table.rate_per_hour;
    const color = req.body?.color !== undefined
      ? tableColorField(req.body.color)
      : isTableColor(table.color)
      ? table.color
      : 'blue';
    const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : table.active;
    const rateChanged = Number(table.rate_per_hour) !== Number(rate);

    if (!active && getOpenSessionForTable(tableId)) {
      throw new HttpError(409, 'No puedes desactivar una mesa que está ocupada.');
    }

    run(
      'UPDATE tables SET name = ?, rate_per_hour = ?, color = ?, active = ? WHERE id = ?',
      name,
      rate,
      color,
      active,
      tableId
    );

    logAudit({
      user: req.user,
      action: rateChanged ? 'price_change' : 'table_update',
      entityType: 'table',
      entityId: tableId,
      shiftId: getOpenShiftRow()?.id ?? null,
      details: {
        kind: 'table',
        name,
        before: {
          name: table.name,
          ratePerHour: table.rate_per_hour,
          color: table.color,
          active: Boolean(table.active),
        },
        after: { name, ratePerHour: rate, color, active: Boolean(active) },
        ...(rateChanged
          ? { ratePerHour: { before: table.rate_per_hour, after: rate } }
          : {}),
      },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Mesa actualizada.' });
  });

  router.patch('/admin/settings', authRequired, adminRequired, (req, res) => {
    const before = getSettings();
    const patch = {};

    if (req.body?.businessName !== undefined) {
      patch.businessName = textField(req.body.businessName, 'El nombre del negocio', 2, 60);
    }
    if (req.body?.currency !== undefined) {
      patch.currency = textField(req.body.currency, 'La moneda', 1, 4);
    }
    if (req.body?.defaultRatePerHour !== undefined) {
      patch.defaultRatePerHour = round2(
        numberField(req.body.defaultRatePerHour, 'La tarifa por defecto', { min: 0, max: 10000 })
      );
    }
    if (req.body?.minimumPlayCharge !== undefined) {
      patch.minimumPlayCharge = round2(
        numberField(req.body.minimumPlayCharge, 'El cobro mínimo', { min: 0, max: 10000 })
      );
    }
    if (req.body?.defaultInitialCash !== undefined) {
      patch.defaultInitialCash = round2(
        numberField(req.body.defaultInitialCash, 'La caja inicial', { min: 0, max: 1000000 })
      );
    }
    if (req.body?.autoLockMinutes !== undefined) {
      patch.autoLockMinutes = Math.floor(
        numberField(req.body.autoLockMinutes, 'El bloqueo automático', { min: 0, max: 240 })
      );
    }
    if (req.body?.receiptPromotions !== undefined) {
      patch.receiptPromotions = String(req.body.receiptPromotions ?? '').trim().slice(0, 600);
    }
    if (req.body?.thermalPrinterName !== undefined) {
      const name = String(req.body.thermalPrinterName ?? '').trim().slice(0, 120);
      if (/[\x00-\x1F\x7F]/.test(name)) {
        throw new HttpError(400, 'El nombre de la impresora contiene caracteres no válidos.');
      }
      patch.thermalPrinterName = name;
    }
    if (req.body?.rawPrintingEnabled !== undefined) {
      const value = req.body.rawPrintingEnabled;
      if (typeof value === 'boolean') {
        patch.rawPrintingEnabled = value;
      } else if (value === 'true' || value === '1' || value === 1) {
        patch.rawPrintingEnabled = true;
      } else if (value === 'false' || value === '0' || value === 0) {
        patch.rawPrintingEnabled = false;
      } else {
        throw new HttpError(400, 'El valor de impresión directa (RAW) no es válido.');
      }
    }

    const after = saveSettings(patch);
    const priceChanged =
      Number(before.defaultRatePerHour) !== Number(after.defaultRatePerHour) ||
      Number(before.minimumPlayCharge) !== Number(after.minimumPlayCharge);
    logAudit({
      user: req.user,
      action: priceChanged ? 'price_change' : 'settings_update',
      entityType: 'settings',
      entityId: 'general',
      shiftId: getOpenShiftRow()?.id ?? null,
      details: {
        kind: 'settings',
        before,
        after,
        ...(priceChanged
          ? {
              prices: {
                before: {
                  defaultRatePerHour: before.defaultRatePerHour,
                  minimumPlayCharge: before.minimumPlayCharge,
                },
                after: {
                  defaultRatePerHour: after.defaultRatePerHour,
                  minimumPlayCharge: after.minimumPlayCharge,
                },
              },
            }
          : {}),
      },
      ip: req.ipAddress,
    });

    res.json({ ok: true, state: publicState(req), message: 'Configuración guardada.' });
  });

  router.get('/admin/audit', authRequired, adminRequired, (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const shiftId = req.query.shiftId ? Number(req.query.shiftId) : null;
    const clauses = [];
    const params = [];
    if (userId) {
      clauses.push('user_id = ?');
      params.push(userId);
    }
    if (shiftId) {
      clauses.push('shift_id = ?');
      params.push(shiftId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = all(
      `SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ?`,
      ...params,
      limit
    );
    res.json({
      ok: true,
      entries: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        userId: row.user_id,
        userName: row.user_name,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        shiftId: row.shift_id,
        details: row.details ? safeJson(row.details) : null,
      })),
    });
  });

  router.get('/admin/backups', authRequired, adminRequired, (req, res) => {
    res.json({ ok: true, backups: listBackups() });
  });

  router.post('/admin/backups', authRequired, adminRequired, (req, res) => {
    const backup = createBackup('manual');
    logAudit({
      user: req.user,
      action: 'backup_create',
      entityType: 'backup',
      entityId: backup.name,
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name: backup.name, size: backup.size },
      ip: req.ipAddress,
    });
    res.json({ ok: true, backup, backups: listBackups(), message: 'Copia de seguridad creada.' });
  });

  router.get('/admin/backup/download', authRequired, adminRequired, (req, res) => {
    const backup = createBackup('descarga');
    logAudit({
      user: req.user,
      action: 'backup_download',
      entityType: 'backup',
      entityId: backup.name,
      shiftId: getOpenShiftRow()?.id ?? null,
      details: { name: backup.name, size: backup.size },
      ip: req.ipAddress,
    });
    res.download(backup.path, backup.name);
  });

  router.get('/admin/export/plays.csv', authRequired, adminRequired, (req, res) => {
    const rows = all(`
      SELECT p.*, s.date_start
      FROM plays p JOIN shifts s ON s.id = p.shift_id
      ORDER BY p.start_time DESC, p.id DESC
    `);
    const data = [
      ['Turno', 'Fecha', 'Mesa', 'N°', 'Entrada', 'Salida', 'Minutos', 'Billar', 'Consumo', 'Total', 'Método', 'Efectivo', 'QR', 'Ref. QR', 'Encargado', 'Estado', 'Anulada por', 'Motivo'],
      ...rows.map((row) => [
        row.shift_id,
        row.date_start,
        row.table_name,
        row.item_number,
        csvDateTime(row.start_time),
        csvDateTime(row.end_time),
        row.duration_minutes,
        row.billiard_amount,
        row.products_amount,
        row.total_amount,
        row.payment_method,
        row.cash_amount,
        row.qr_amount,
        row.qr_reference || '',
        row.closed_by_name,
        row.status === 'active' ? 'Cobrada' : 'Anulada',
        row.voided_by_name || '',
        row.void_reason || '',
      ]),
    ];
    logAudit({
      user: req.user,
      action: 'export_plays',
      entityType: 'export',
      shiftId: getOpenShiftRow()?.id ?? null,
      ip: req.ipAddress,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="partidas-billar.csv"');
    res.send(csvRows(data));
  });

  router.get('/admin/export/shifts.csv', authRequired, adminRequired, (req, res) => {
    const shifts = getHistory(req.user);
    const data = [
      ['Turno', 'Apertura', 'Cierre', 'Encargado apertura', 'Encargado cierre', 'Fondo', 'Billar', 'Productos', 'Total', 'QR ventas', 'Traspasos a caja', 'Traspasos desde caja', 'QR neto', 'Gastos', 'Esperado', 'Contado', 'Diferencia', 'Traspasos', 'Estado', 'Notas'],
      ...shifts.map((shift) => [
        shift.id,
        csvDateTime(shift.openedAt),
        csvDateTime(shift.closedAt),
        shift.openedByName,
        shift.closedByName || '',
        shift.initialCash,
        shift.totals.totalBilliard,
        shift.totals.totalProducts,
        shift.totals.grossTotal,
        shift.totals.totalQr,
        shift.totals.cashTransfersIn ?? 0,
        shift.totals.cashTransfersOut ?? 0,
        shift.totals.totalQrNet ?? shift.totals.totalQr,
        shift.totals.totalExpenses,
        shift.closing.expectedCash ?? shift.totals.expectedCash ?? '',
        shift.closing.countedCash ?? '',
        shift.closing.difference ?? '',
        shift.totals.transfersCount ?? 0,
        shift.status === 'open' ? 'Abierto' : 'Cerrado',
        shift.closing.notes || '',
      ]),
    ];
    logAudit({
      user: req.user,
      action: 'export_shifts',
      entityType: 'export',
      shiftId: getOpenShiftRow()?.id ?? null,
      ip: req.ipAddress,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="turnos-billar.csv"');
    res.send(csvRows(data));
  });

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function validateReceiptPayload(receipt) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
      throw new HttpError(400, 'El comprobante no es válido.');
    }
    if (!Array.isArray(receipt.items)) {
      throw new HttpError(400, 'Los ítems del comprobante no son válidos.');
    }
    for (const item of receipt.items) {
      if (!item || typeof item !== 'object') {
        throw new HttpError(400, 'Un ítem del comprobante no es válido.');
      }
      if (!isFiniteNumber(item.price) || !isFiniteNumber(item.quantity)) {
        throw new HttpError(400, 'Los valores de los ítems no son válidos.');
      }
      if (typeof item.name !== 'string') {
        throw new HttpError(400, 'El nombre de un ítem no es válido.');
      }
    }
    for (const key of ['billiardAmount', 'productsAmount', 'totalAmount', 'cashAmount', 'qrAmount']) {
      if (receipt[key] !== undefined && !isFiniteNumber(receipt[key])) {
        throw new HttpError(400, `El campo ${key} del comprobante no es válido.`);
      }
    }
    for (const key of ['number', 'businessName', 'currency', 'createdAt', 'cashier']) {
      if (receipt[key] !== undefined && typeof receipt[key] !== 'string') {
        throw new HttpError(400, `El campo ${key} del comprobante no es válido.`);
      }
    }
    if (receipt.kind !== undefined && receipt.kind !== 'table' && receipt.kind !== 'sale') {
      throw new HttpError(400, 'El tipo de comprobante no es válido.');
    }
    if (receipt.shiftId !== undefined && !Number.isFinite(Number(receipt.shiftId))) {
      throw new HttpError(400, 'El turno del comprobante no es válido.');
    }
    if (receipt.tableName !== undefined && receipt.tableName !== null && typeof receipt.tableName !== 'string') {
      throw new HttpError(400, 'El nombre de mesa del comprobante no es válido.');
    }
    if (receipt.customerName !== undefined && receipt.customerName !== null && typeof receipt.customerName !== 'string') {
      throw new HttpError(400, 'El nombre de cliente del comprobante no es válido.');
    }
    if (receipt.notes !== undefined && receipt.notes !== null && typeof receipt.notes !== 'string') {
      throw new HttpError(400, 'La nota del comprobante no es válida.');
    }
    if (receipt.qrReference !== undefined && receipt.qrReference !== null && typeof receipt.qrReference !== 'string') {
      throw new HttpError(400, 'La referencia QR del comprobante no es válida.');
    }
  }

  router.get('/print/printers', authRequired, async (req, res) => {
    try {
      const printers = await listPrinters();
      res.json({ ok: true, printers });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || 'No se pudieron obtener las impresoras.' });
    }
  });

  router.post('/print/test', authRequired, adminRequired, async (req, res) => {
    try {
      const settings = getSettings();
      const requested = String(req.body?.printerName ?? '').trim();
      if (/[\x00-\x1F\x7F]/.test(requested)) {
        throw new HttpError(400, 'El nombre de la impresora contiene caracteres no válidos.');
      }
      const printerName = requested || String(settings.thermalPrinterName || '').trim();
      if (!printerName) {
        throw new HttpError(400, 'No hay una impresora configurada para la prueba.');
      }
      const buffer = buildTestEscPos();
      await printRaw(buffer, printerName);
      res.json({ ok: true, message: 'Ticket de prueba enviado a la impresora.' });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      res.status(status).json({ ok: false, error: error?.message || 'No se pudo imprimir el ticket de prueba.' });
    }
  });

  router.post('/print/receipt', authRequired, async (req, res) => {
    try {
      const settings = getSettings();
      if (!settings.rawPrintingEnabled) {
        throw new HttpError(409, 'La impresión directa (RAW) no está activada.');
      }
      const printerName = String(settings.thermalPrinterName || '').trim();
      if (!printerName) {
        throw new HttpError(409, 'No hay una impresora térmica configurada.');
      }
      const receipt = req.body;
      validateReceiptPayload(receipt);
      const buffer = buildReceiptEscPos(receipt);
      await printRaw(buffer, printerName);
      res.json({ ok: true });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      res.status(status).json({ ok: false, error: error?.message || 'No se pudo imprimir el comprobante.' });
    }
  });

  router.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Ruta no encontrada.' });
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ ok: false, error: 'Los datos enviados no son JSON válido.' });
    }
    const status = error instanceof HttpError ? error.status : (error.status || 500);
    if (status >= 500) {
      console.error(error);
    }
    res.status(status).json({
      ok: false,
      error: status >= 500 && !(error instanceof HttpError)
        ? 'Ocurrió un error inesperado en el servidor.'
        : error.message,
    });
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, session] of tokens.entries()) {
      if (session.expiresAt < now) tokens.delete(token);
    }
  }, 10 * 60 * 1000);
  cleanupTimer.unref?.();

  return router;
}
