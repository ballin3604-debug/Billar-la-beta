import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HELPER_PATH = path.join(__dirname, 'bin', 'rawprint.ps1');
const COLS = 32;

const ESC = 0x1b;
const GS = 0x1d;

// CP850 mapping for required characters (and common Latin-1 accents) beyond ASCII
const CP850_MAP = new Map([
  ['á', 0xa0], ['í', 0xa1], ['ó', 0xa2], ['ú', 0xa3], ['ñ', 0xa4], ['Ñ', 0xa5],
  ['Á', 0xb5], ['É', 0x90], ['Í', 0xd6], ['Ó', 0xe0], ['Ú', 0xe9],
  ['ü', 0x81], ['Ü', 0x9a], ['¿', 0xa8], ['¡', 0xad],
  ['é', 0x82], ['è', 0x8a], ['ê', 0x88], ['ë', 0x89],
  ['à', 0x85], ['â', 0x83], ['ä', 0x84],
  ['ì', 0x8d], ['î', 0x8c], ['ï', 0x8b],
  ['ò', 0x95], ['ô', 0x93], ['ö', 0x94],
  ['ù', 0x97], ['û', 0x96],
  ['ç', 0x87], ['Ç', 0x80],
  ['º', 0xa7], ['ª', 0xa6], ['°', 0xf8],
  ['€', 0xd5], ['£', 0x9c],
]);

function encodeCp850(text) {
  const str = String(text ?? '');
  const out = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code <= 0x7f) {
      out.push(code);
    } else if (CP850_MAP.has(ch)) {
      out.push(CP850_MAP.get(ch));
    } else {
      out.push(0x3f); // '?'
    }
  }
  return Buffer.from(out);
}

function pushText(chunks, text) {
  chunks.push(encodeCp850(text));
}

function pushBytes(chunks, ...bytes) {
  chunks.push(Buffer.from(bytes));
}

function lf(chunks, n = 1) {
  for (let i = 0; i < n; i++) pushBytes(chunks, 0x0a);
}

function hr(chunks, char = '-') {
  pushText(chunks, char.repeat(COLS));
  lf(chunks);
}

function padRight(str, len) {
  const s = String(str ?? '');
  if (s.length >= len) return s.slice(0, len);
  return s + ' '.repeat(len - s.length);
}

function padLeft(str, len) {
  const s = String(str ?? '');
  if (s.length >= len) return s.slice(s.length - len);
  return ' '.repeat(len - s.length) + s;
}

function centerText(str, width = COLS) {
  const s = String(str ?? '');
  if (s.length >= width) return s.slice(0, width);
  const left = Math.floor((width - s.length) / 2);
  const right = width - s.length - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

function wrapText(text, width = COLS) {
  const raw = String(text ?? '').replace(/\r/g, '').split('\n');
  const lines = [];
  for (const paragraph of raw) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      if (word.length > width) {
        if (current) {
          lines.push(current);
          current = '';
        }
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        continue;
      }
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

function rowLR(chunks, left, right, width = COLS) {
  const l = String(left ?? '');
  const r = String(right ?? '');
  const space = 1;
  const maxLeft = Math.max(0, width - r.length - space);
  const lOut = l.length > maxLeft ? l.slice(0, maxLeft) : l;
  const gap = Math.max(space, width - lOut.length - r.length);
  pushText(chunks, lOut + ' '.repeat(gap) + r);
  lf(chunks);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatMoney(value, currency = 'Bs') {
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value) {
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

function formatClock(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function durationLabel(minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`;
}

function paymentLabel(method) {
  if (method === 'qr') return 'QR';
  if (method === 'mixto') return 'Mixto';
  return 'Efectivo';
}

export function buildReceiptEscPos(receipt) {
  const chunks = [];
  const currency = receipt?.currency || 'Bs';
  const money = (v) => formatMoney(v, currency);

  // Init: reset + CP850
  pushBytes(chunks, ESC, 0x40);
  pushBytes(chunks, ESC, 0x74, 2);

  // Header
  pushBytes(chunks, ESC, 0x61, 1); // center
  pushBytes(chunks, ESC, 0x45, 1); // bold on
  for (const line of wrapText(receipt?.businessName || 'Negocio', COLS)) {
    pushText(chunks, line);
    lf(chunks);
  }
  pushBytes(chunks, ESC, 0x45, 0); // bold off
  pushText(chunks, 'Comprobante de caja');
  lf(chunks);
  if (receipt?.reprint) {
    pushBytes(chunks, ESC, 0x45, 1);
    pushText(chunks, '*** REIMPRESION ***');
    pushBytes(chunks, ESC, 0x45, 0);
    lf(chunks);
  }
  pushBytes(chunks, ESC, 0x61, 0); // left
  hr(chunks, '-');

  rowLR(chunks, 'Nro', String(receipt?.number || ''));
  rowLR(chunks, 'Fecha', formatDateTime(receipt?.createdAt));
  hr(chunks, '-');

  const isTable = receipt?.kind === 'table';
  const title = isTable
    ? (receipt?.tableName || 'Mesa')
    : (receipt?.customerName ? 'VENTA POR CLIENTE' : 'VENTA DE BARRA');
  pushBytes(chunks, ESC, 0x61, 1);
  pushBytes(chunks, ESC, 0x45, 1);
  for (const line of wrapText(title, COLS)) {
    pushText(chunks, line);
    lf(chunks);
  }
  pushBytes(chunks, ESC, 0x45, 0);
  if (isTable) {
    const detail = `${durationLabel(receipt?.durationMinutes || 0)} ${formatClock(receipt?.startTime)}-${formatClock(receipt?.endTime)}`;
    for (const line of wrapText(detail, COLS)) {
      pushText(chunks, line);
      lf(chunks);
    }
    if (receipt?.playerType === 'staff') {
      for (const line of wrapText('Encargados (sin cobro de billar)', COLS)) {
        pushText(chunks, line);
        lf(chunks);
      }
    } else if (receipt?.playerType === 'mixed') {
      for (const line of wrapText('Encargado + cliente (50% billar)', COLS)) {
        pushText(chunks, line);
        lf(chunks);
      }
    }
  } else {
    pushText(chunks, receipt?.customerName ? `Cliente: ${receipt.customerName}` : 'Consumo en barra');
    lf(chunks);
  }
  pushBytes(chunks, ESC, 0x61, 0);
  hr(chunks, '-');

  const items = Array.isArray(receipt?.items) ? receipt.items : [];
  if (items.length > 0) {
    for (const item of items) {
      const qty = Number(item?.quantity || 0);
      const name = String(item?.name || '');
      const amount = money(round2(Number(item?.price || 0) * qty));
      const prefix = `${qty}x `;
      const nameWidth = Math.max(8, COLS - prefix.length);
      const nameLines = wrapText(name, nameWidth);
      if (nameLines.length === 0) nameLines.push('');
      for (let i = 0; i < nameLines.length; i++) {
        const lineText = (i === 0 ? prefix : '  ') + nameLines[i];
        const isLast = i === nameLines.length - 1;
        if (isLast && lineText.length + 1 + amount.length <= COLS) {
          const gap = COLS - lineText.length - amount.length;
          pushText(chunks, lineText + ' '.repeat(Math.max(1, gap)) + amount);
          lf(chunks);
        } else {
          pushText(chunks, lineText);
          lf(chunks);
          if (isLast) {
            rowLR(chunks, '', amount, COLS);
          }
        }
      }
    }
  } else {
    pushBytes(chunks, ESC, 0x61, 1);
    pushText(chunks, 'Sin consumo registrado');
    lf(chunks);
    pushBytes(chunks, ESC, 0x61, 0);
  }
  hr(chunks, '-');

  if (isTable) {
    const billar = `Billar ${money(receipt?.billiardAmount)}`;
    const consumo = `Consumo ${money(receipt?.productsAmount)}`;
    if (billar.length + 1 + consumo.length <= COLS) {
      pushText(chunks, billar + ' '.repeat(COLS - billar.length - consumo.length) + consumo);
      lf(chunks);
    } else {
      rowLR(chunks, 'Billar', money(receipt?.billiardAmount));
      rowLR(chunks, 'Consumo', money(receipt?.productsAmount));
    }
  } else {
    rowLR(chunks, 'Productos', money(receipt?.productsAmount));
  }

  // TOTAL: bold + double height (GS ! 0x01), not double width
  const pm = receipt?.paymentMethod;
  pushBytes(chunks, ESC, 0x45, 1);
  pushBytes(chunks, GS, 0x21, 0x01);
  rowLR(chunks, 'TOTAL', `${paymentLabel(pm)} ${money(receipt?.totalAmount)}`, COLS);
  pushBytes(chunks, GS, 0x21, 0x00);
  pushBytes(chunks, ESC, 0x45, 0);

  const hasPaymentDetail =
    (pm === 'efectivo' && Boolean(receipt?.received)) || pm === 'mixto';
  const hasQrReference = Boolean(receipt?.qrReference && pm !== 'efectivo');
  const hasNotes = Boolean(receipt?.notes);
  if (hasPaymentDetail || hasQrReference || hasNotes) {
    hr(chunks, '-');
    if (pm === 'efectivo') {
      if (receipt?.received) {
        rowLR(chunks, 'Recibido', money(receipt.received));
        rowLR(chunks, 'Vuelto', money(receipt.change || 0));
      }
    } else if (pm === 'mixto') {
      rowLR(chunks, 'Efectivo', money(receipt?.cashAmount));
      rowLR(chunks, 'QR', money(receipt?.qrAmount));
    }
    if (hasQrReference) {
      for (const line of wrapText(`Ref. QR: ${receipt.qrReference}`, COLS)) {
        pushText(chunks, line);
        lf(chunks);
      }
    }
    if (hasNotes) {
      for (const line of wrapText(`Nota: ${receipt.notes}`, COLS)) {
        pushText(chunks, line);
        lf(chunks);
      }
    }
  }

  hr(chunks, '-');
  pushBytes(chunks, ESC, 0x61, 1);
  pushText(chunks, '¡Gracias por su visita!');
  lf(chunks);
  pushBytes(chunks, ESC, 0x61, 0);

  const promotions = String(receipt?.promotions || '').trim();
  if (promotions) {
    hr(chunks, '-');
    pushBytes(chunks, ESC, 0x61, 1);
    for (const rawLine of promotions.replace(/\r/g, '').split('\n')) {
      for (const line of wrapText(rawLine, COLS)) {
        pushText(chunks, line);
        lf(chunks);
      }
    }
    pushBytes(chunks, ESC, 0x61, 0);
  }

  // Feed and partial cut
  pushBytes(chunks, ESC, 0x64, 4);
  pushBytes(chunks, GS, 0x56, 66, 0);

  return Buffer.concat(chunks);
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function formatHelperError(error) {
  const stderr = String(error?.stderr || '').trim();
  if (stderr) return stderr;
  const stdout = String(error?.stdout || '').trim();
  if (stdout) return stdout;
  if (error?.killed) return 'La impresión excedió el tiempo de espera.';
  return error?.message || 'Error desconocido al imprimir.';
}

export async function printRaw(buffer, printerName) {
  const name = String(printerName || '').trim();
  if (!name) throw new Error('No se especificó la impresora.');
  const tmpFile = path.join(os.tmpdir(), `billar-receipt-${randomUUID()}.bin`);
  try {
    await fs.writeFile(tmpFile, buffer);
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        HELPER_PATH,
        '-PrinterName',
        name,
        '-FilePath',
        tmpFile,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024 }
    );
    return { ok: true };
  } catch (error) {
    throw new Error(formatHelperError(error));
  } finally {
    try {
      await fs.unlink(tmpFile);
    } catch {
      // ignore
    }
  }
}

export async function listPrinters() {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', HELPER_PATH, '-List'],
      { timeout: 15000, maxBuffer: 1024 * 1024 }
    );
    const text = String(stdout || '').trim();
    if (!text) return [];
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch (error) {
    throw new Error(formatHelperError(error));
  }
}

export function buildTestEscPos() {
  const receipt = {
    kind: 'sale',
    number: 'TEST-0001',
    businessName: 'Billar Bar la Beta',
    currency: 'Bs',
    createdAt: new Date().toISOString(),
    shiftId: 0,
    cashier: 'Prueba',
    items: [{ name: 'Prueba áéíóú ñ ¿¡', price: 1.5, quantity: 1 }],
    billiardAmount: 0,
    productsAmount: 1.5,
    totalAmount: 1.5,
    paymentMethod: 'efectivo',
    cashAmount: 1.5,
    qrAmount: 0,
    qrReference: null,
    notes: 'Ticket de prueba de impresión RAW',
    promotions: '01234567890123456789012345678901',
  };
  const buffer = buildReceiptEscPos(receipt);
  // Ensure a 32-char line is present: already included via promotions line above.
  // Also add a bold-only marker is implicit in header/total; buildReceiptEscPos is sufficient.
  return buffer;
}
