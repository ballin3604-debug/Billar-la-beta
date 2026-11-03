import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(currentDir, '..');
export const DATA_DIR = process.env.BILLAR_DATA_DIR
  ? path.resolve(process.env.BILLAR_DATA_DIR)
  : path.join(ROOT_DIR, 'data');
export const DB_PATH = path.join(DATA_DIR, 'billar.db');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(BACKUP_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA synchronous = NORMAL;');

export const nowIso = () => new Date().toISOString();

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDateTimeKey(date = new Date()) {
  const datePart = localDateKey(date);
  const timePart = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('-');
  return `${datePart}_${timePart}`;
}

export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

export function get(sql, ...params) {
  const row = db.prepare(sql).get(...params);
  return row ? { ...row } : null;
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params).map((row) => ({ ...row }));
}

export function transaction(callback) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = callback();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}

export function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(pin), salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPin(pin, hash, salt) {
  try {
    const expected = Buffer.from(hash, 'hex');
    const candidate = scryptSync(String(pin), salt, 64);
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  } catch {
    return false;
  }
}

export function pinIsValid(pin) {
  return /^\d{4,6}$/.test(String(pin || ''));
}

export function pinInUse(pin, exceptUserId = null) {
  const users = all('SELECT id, pin_hash, pin_salt FROM users WHERE active = 1');
  return users.some(
    (user) =>
      user.id !== exceptUserId &&
      verifyPin(pin, user.pin_hash, user.pin_salt)
  );
}

const DEFAULT_SETTINGS = {
  businessName: 'Billar & Bar',
  currency: 'Bs',
  defaultRatePerHour: '15',
  minimumPlayCharge: '5',
  autoLockMinutes: '15',
};

const DEFAULT_TABLES = [
  { number: 1, name: 'Mesa 1', rate: 15 },
  { number: 2, name: 'Mesa 2', rate: 15 },
  { number: 3, name: 'Mesa 3', rate: 15 },
  { number: 4, name: 'Mesa 4', rate: 15 },
  { number: 5, name: 'Mesa 5', rate: 20 },
  { number: 6, name: 'Mesa 6', rate: 20 },
  { number: 7, name: 'Mesa 7', rate: 20 },
];

const DEFAULT_PRODUCTS = [
  { name: 'Macanuda', category: 'cervezas', price: 22, favorite: 1 },
  { name: 'Estrella de Oro', category: 'cervezas', price: 15, favorite: 1 },
  { name: 'Paceña 620 ml', category: 'cervezas', price: 15, favorite: 0 },
  { name: 'Huari 620 ml', category: 'cervezas', price: 18, favorite: 0 },
  { name: 'Agua 2 L', category: 'bebidas', price: 12, favorite: 1 },
  { name: 'Coca-Cola 2 L', category: 'bebidas', price: 15, favorite: 1 },
  { name: 'Coca-Cola Personal', category: 'bebidas', price: 5, favorite: 0 },
  { name: 'Maní', category: 'snacks', price: 12, favorite: 1 },
  { name: 'Frescol', category: 'bebidas', price: 10, favorite: 0 },
  { name: 'Monster', category: 'bebidas', price: 15, favorite: 0 },
  { name: 'Papas Fritas', category: 'snacks', price: 8, favorite: 0 },
  { name: 'Galletas Oreo', category: 'snacks', price: 4, favorite: 0 },
  { name: 'Bolo', category: 'snacks', price: 1, favorite: 0 },
  { name: 'Vaso Roto', category: 'multas', price: 10, favorite: 1 },
  { name: 'Silla Rota', category: 'multas', price: 50, favorite: 0 },
  { name: 'Tiza de Billar', category: 'otros', price: 3, favorite: 0 },
];

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'cashier')),
      active INTEGER NOT NULL DEFAULT 1,
      must_change_pin INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      rate_per_hour REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER,
      favorite INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_start TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      opened_by INTEGER NOT NULL REFERENCES users(id),
      opened_by_name TEXT NOT NULL,
      closed_at TEXT,
      closed_by INTEGER REFERENCES users(id),
      closed_by_name TEXT,
      initial_cash REAL NOT NULL DEFAULT 0,
      expected_cash REAL,
      counted_cash REAL,
      difference REAL,
      closing_notes TEXT,
      denominations TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      table_id INTEGER NOT NULL REFERENCES tables(id),
      opened_by INTEGER NOT NULL REFERENCES users(id),
      opened_by_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      rate_per_hour REAL NOT NULL,
      closed_at TEXT,
      closed_by INTEGER REFERENCES users(id),
      closed_by_name TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'charged', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS session_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      product_id INTEGER REFERENCES products(id),
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      table_id INTEGER NOT NULL REFERENCES tables(id),
      table_number INTEGER NOT NULL,
      table_name TEXT NOT NULL,
      item_number INTEGER NOT NULL,
      opened_by INTEGER NOT NULL REFERENCES users(id),
      opened_by_name TEXT NOT NULL,
      closed_by INTEGER NOT NULL REFERENCES users(id),
      closed_by_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      billiard_amount REAL NOT NULL,
      computed_billiard_amount REAL NOT NULL,
      products_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'qr', 'mixto')),
      cash_amount REAL NOT NULL,
      qr_amount REAL NOT NULL,
      qr_reference TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
      voided_by INTEGER REFERENCES users(id),
      voided_by_name TEXT,
      voided_at TEXT,
      void_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'qr', 'mixto')),
      cash_amount REAL NOT NULL,
      qr_amount REAL NOT NULL,
      qr_reference TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
      voided_by INTEGER REFERENCES users(id),
      voided_by_name TEXT,
      voided_at TEXT,
      void_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      product_id INTEGER REFERENCES products(id),
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      amount REAL NOT NULL,
      concept TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
      voided_by INTEGER REFERENCES users(id),
      voided_by_name TEXT,
      voided_at TEXT,
      void_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      shift_id INTEGER,
      details TEXT,
      ip TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift
      ON shifts(status) WHERE status = 'open';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session
      ON sessions(table_id) WHERE status = 'open';

    CREATE INDEX IF NOT EXISTS idx_sessions_shift ON sessions(shift_id);
    CREATE INDEX IF NOT EXISTS idx_plays_shift ON plays(shift_id);
    CREATE INDEX IF NOT EXISTS idx_plays_table ON plays(table_id);
    CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_shift ON expenses(shift_id);
    CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_audit_shift ON audit_log(shift_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  `);
}

function seedDatabase() {
  const settingsCount = get('SELECT COUNT(*) AS count FROM settings');
  if (!settingsCount || settingsCount.count === 0) {
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insert.run(key, value);
    }
  }

  const userCount = get('SELECT COUNT(*) AS count FROM users');
  if (!userCount || userCount.count === 0) {
    const { hash, salt } = hashPin('1234');
    run(
      `INSERT INTO users (name, pin_hash, pin_salt, role, active, must_change_pin, created_at)
       VALUES (?, ?, ?, 'admin', 1, 1, ?)`,
      'Dueño',
      hash,
      salt,
      nowIso()
    );
  }

  const tableCount = get('SELECT COUNT(*) AS count FROM tables');
  if (!tableCount || tableCount.count === 0) {
    const insert = db.prepare(
      'INSERT INTO tables (number, name, rate_per_hour, active, created_at) VALUES (?, ?, ?, 1, ?)'
    );
    for (const table of DEFAULT_TABLES) {
      insert.run(table.number, table.name, table.rate, nowIso());
    }
  }

  const productCount = get('SELECT COUNT(*) AS count FROM products');
  if (!productCount || productCount.count === 0) {
    const insert = db.prepare(
      `INSERT INTO products (name, category, price, stock, favorite, active, created_at)
       VALUES (?, ?, ?, NULL, ?, 1, ?)`
    );
    for (const product of DEFAULT_PRODUCTS) {
      insert.run(product.name, product.category, product.price, product.favorite, nowIso());
    }
  }
}

createSchema();
seedDatabase();

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    businessName: map.businessName || DEFAULT_SETTINGS.businessName,
    currency: map.currency || DEFAULT_SETTINGS.currency,
    defaultRatePerHour: Number(map.defaultRatePerHour ?? DEFAULT_SETTINGS.defaultRatePerHour),
    minimumPlayCharge: Number(map.minimumPlayCharge ?? DEFAULT_SETTINGS.minimumPlayCharge),
    autoLockMinutes: Number(map.autoLockMinutes ?? DEFAULT_SETTINGS.autoLockMinutes),
  };
}

export function saveSettings(patch) {
  const allowed = new Set([
    'businessName',
    'currency',
    'defaultRatePerHour',
    'minimumPlayCharge',
    'autoLockMinutes',
  ]);
  const update = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.has(key) && value !== undefined && value !== null) {
      update.run(key, String(value));
    }
  }
  return getSettings();
}

export function logAudit({
  user = null,
  action,
  entityType = null,
  entityId = null,
  shiftId = null,
  details = null,
  ip = null,
}) {
  try {
    run(
      `INSERT INTO audit_log
       (created_at, user_id, user_name, action, entity_type, entity_id, shift_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      nowIso(),
      user?.id ?? null,
      user?.name ?? 'Sistema',
      action,
      entityType,
      entityId === null || entityId === undefined ? null : String(entityId),
      shiftId,
      details === null || details === undefined ? null : JSON.stringify(details),
      ip
    );
  } catch (error) {
    console.error('No se pudo guardar la auditoría:', error);
  }
}

function pruneBackups(keep = 40) {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter((name) => name.endsWith('.db'))
      .map((name) => {
        const filePath = path.join(BACKUP_DIR, name);
        return { name, filePath, mtime: statSync(filePath).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files.slice(keep)) {
      try {
        unlinkSync(file.filePath);
      } catch {
        // ignore a file that is currently locked
      }
    }
  } catch {
    // backups are best-effort
  }
}

export function createBackup(reason = 'manual') {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = `billar-${localDateTimeKey()}.db`;
  const filePath = path.join(BACKUP_DIR, filename);

  if (existsSync(filePath)) {
    return { name: filename, path: filePath, size: statSync(filePath).size, reason };
  }

  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const sqlPath = filePath.replace(/\\/g, '/').replace(/'/g, "''");
  db.exec(`VACUUM INTO '${sqlPath}';`);
  pruneBackups();
  const info = statSync(filePath);
  return { name: filename, path: filePath, size: info.size, reason };
}

export function listBackups() {
  try {
    return readdirSync(BACKUP_DIR)
      .filter((name) => name.endsWith('.db'))
      .map((name) => {
        const filePath = path.join(BACKUP_DIR, name);
        const info = statSync(filePath);
        return { name, size: info.size, modifiedAt: new Date(info.mtimeMs).toISOString() };
      })
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  } catch {
    return [];
  }
}

export function createDailyBackupIfNeeded() {
  const today = localDateKey();
  const alreadyExists = listBackups().some((backup) => backup.name.includes(today));
  if (!alreadyExists) {
    return createBackup('automatico');
  }
  return null;
}
