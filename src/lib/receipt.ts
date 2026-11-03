import type { AppState, Play, ReceiptData, Sale, Settings } from '../types';
import {
  durationLabel,
  formatClock,
  formatDateTime,
  formatMoney,
  paymentLabel,
} from './format';

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function receiptNumber(kind: ReceiptData['kind'], id: number) {
  return `${kind === 'table' ? 'M' : 'V'}-${String(id).padStart(6, '0')}`;
}

function paymentExtras(total: number, method: string, received?: number) {
  if (method !== 'efectivo' || !received || received <= 0) return {};
  const receivedAmount = round2(received);
  return {
    received: receivedAmount,
    change: round2(Math.max(0, receivedAmount - total)),
  };
}

export function playToReceipt(
  play: Play,
  settings: Settings,
  received?: number
): ReceiptData {
  return {
    kind: 'table',
    number: receiptNumber('table', play.id),
    businessName: settings.businessName,
    currency: settings.currency,
    createdAt: play.endTime || play.createdAt,
    shiftId: play.shiftId,
    cashier: play.closedByName || play.openedByName,
    tableName: play.tableName,
    durationMinutes: play.durationMinutes,
    startTime: play.startTime,
    endTime: play.endTime,
    items: play.items.map((item) => ({
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity),
    })),
    billiardAmount: Number(play.billiardAmount),
    productsAmount: Number(play.productsAmount),
    totalAmount: Number(play.totalAmount),
    paymentMethod: play.paymentMethod,
    cashAmount: Number(play.cashAmount),
    qrAmount: Number(play.qrAmount),
    qrReference: play.qrReference,
    notes: play.notes,
    ...paymentExtras(Number(play.totalAmount), play.paymentMethod, received),
  };
}

export function saleToReceipt(
  sale: Sale,
  settings: Settings,
  received?: number
): ReceiptData {
  return {
    kind: 'sale',
    number: receiptNumber('sale', sale.id),
    businessName: settings.businessName,
    currency: settings.currency,
    createdAt: sale.createdAt,
    shiftId: sale.shiftId,
    cashier: sale.createdByName,
    items: sale.items.map((item) => ({
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity),
    })),
    billiardAmount: 0,
    productsAmount: Number(sale.totalAmount),
    totalAmount: Number(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    cashAmount: Number(sale.cashAmount),
    qrAmount: Number(sale.qrAmount),
    qrReference: sale.qrReference,
    notes: sale.notes,
    ...paymentExtras(Number(sale.totalAmount), sale.paymentMethod, received),
  };
}

export function findNewPlay(state: AppState | undefined, tableId: number) {
  const plays = state?.currentShift?.tablePlays ?? [];
  for (let index = plays.length - 1; index >= 0; index -= 1) {
    const play = plays[index];
    if (play.tableId === tableId && play.status === 'active') return play;
  }
  return null;
}

export function findNewSale(state: AppState | undefined) {
  const sales = state?.currentShift?.sales ?? [];
  for (let index = sales.length - 1; index >= 0; index -= 1) {
    if (sales[index].status === 'active') return sales[index];
  }
  return null;
}

export const RECEIPT_CSS = `
  .receipt-paper {
    width: 100%;
    max-width: 72mm;
    margin: 0 auto;
    color: #0f172a;
    font-family: "Cascadia Mono", "Consolas", "Courier New", monospace;
    font-size: 10.5px;
    line-height: 1.5;
  }
  .receipt-paper * { box-sizing: border-box; }
  .receipt-paper .receipt-header { text-align: center; }
  .receipt-paper .receipt-business {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.03em;
    line-height: 1.2;
  }
  .receipt-paper .receipt-sub {
    margin-top: 2px;
    color: #475569;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .receipt-paper .receipt-rule {
    margin: 8px 0;
    border-top: 1px dashed #94a3b8;
  }
  .receipt-paper .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .receipt-paper .receipt-row > span:last-child { text-align: right; }
  .receipt-paper .receipt-strong { font-weight: 700; }
  .receipt-paper .receipt-center { text-align: center; }
  .receipt-paper .receipt-title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .receipt-paper .receipt-items {
    width: 100%;
    border-collapse: collapse;
  }
  .receipt-paper .receipt-items th,
  .receipt-paper .receipt-items td {
    padding: 2px 0;
    vertical-align: top;
  }
  .receipt-paper .receipt-items th {
    border-bottom: 1px solid #cbd5e1;
    color: #64748b;
    font-size: 8.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .receipt-paper .receipt-qty { width: 11%; text-align: left; }
  .receipt-paper .receipt-amount {
    width: 30%;
    text-align: right;
    white-space: nowrap;
  }
  .receipt-paper .receipt-items td.receipt-amount { text-align: right; }
  .receipt-paper .receipt-item-name { word-break: break-word; }
  .receipt-paper .receipt-total {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #0f172a;
    font-size: 13px;
    font-weight: 800;
  }
  .receipt-paper .receipt-small {
    margin-top: 3px;
    color: #475569;
    font-size: 9px;
  }
  .receipt-paper .receipt-note {
    margin-top: 8px;
    font-size: 9.5px;
    line-height: 1.4;
  }
  .receipt-paper .receipt-thanks {
    margin-top: 4px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
  }
  .receipt-paper .receipt-legal {
    margin-top: 2px;
    color: #64748b;
    font-size: 8px;
    letter-spacing: 0.04em;
    text-align: center;
  }
`;

function receiptRow(label: string, value: string) {
  return `<div class="receipt-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

export function receiptBodyHtml(receipt: ReceiptData) {
  const money = (value: number) => formatMoney(value, receipt.currency);
  const itemsRows = receipt.items
    .map(
      (item) => `<tr>
        <td class="receipt-qty">${item.quantity}×</td>
        <td class="receipt-item-name">${escapeHtml(item.name)}</td>
        <td class="receipt-amount">${escapeHtml(money(item.price * item.quantity))}</td>
      </tr>`
    )
    .join('');

  const title =
    receipt.kind === 'table' ? escapeHtml(receipt.tableName || 'Mesa') : 'VENTA DE BARRA';
  const detail =
    receipt.kind === 'table'
      ? `<div class="receipt-center">${escapeHtml(
          durationLabel(receipt.durationMinutes || 0)
        )} · ${formatClock(receipt.startTime)} → ${formatClock(receipt.endTime)}</div>`
      : '<div class="receipt-center">Consumo en barra</div>';

  let payment = '';
  if (receipt.paymentMethod === 'efectivo') {
    payment += receiptRow('Efectivo', money(receipt.totalAmount));
    if (receipt.received) {
      payment += receiptRow('Recibido', money(receipt.received));
      payment += receiptRow('Vuelto', money(receipt.change || 0));
    }
  } else if (receipt.paymentMethod === 'qr') {
    payment += receiptRow('QR', money(receipt.qrAmount || receipt.totalAmount));
  } else {
    payment += receiptRow('Efectivo', money(receipt.cashAmount));
    payment += receiptRow('QR', money(receipt.qrAmount));
  }
  if (receipt.qrReference && receipt.paymentMethod !== 'efectivo') {
    payment += `<div class="receipt-small">Ref. QR: ${escapeHtml(receipt.qrReference)}</div>`;
  }

  return `<div class="receipt-paper">
    <div class="receipt-header">
      <div class="receipt-business">${escapeHtml(receipt.businessName)}</div>
      <div class="receipt-sub">Comprobante de caja</div>
    </div>
    <div class="receipt-rule"></div>
    ${receiptRow('Comprobante', receipt.number)}
    ${receiptRow('Fecha', formatDateTime(receipt.createdAt))}
    ${receiptRow('Turno', `#${receipt.shiftId}`)}
    ${receiptRow('Atendió', receipt.cashier)}
    <div class="receipt-rule"></div>
    <div class="receipt-center receipt-title">${title}</div>
    ${detail}
    <div class="receipt-rule"></div>
    ${
      receipt.items.length > 0
        ? `<table class="receipt-items">
            <thead>
              <tr>
                <th class="receipt-qty">Cant</th>
                <th>Descripción</th>
                <th class="receipt-amount">Importe</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>`
        : '<div class="receipt-center receipt-small">Sin consumo registrado</div>'
    }
    <div class="receipt-rule"></div>
    ${
      receipt.kind === 'table'
        ? `${receiptRow('Billar', money(receipt.billiardAmount))}${receiptRow(
            'Consumo',
            money(receipt.productsAmount)
          )}`
        : receiptRow('Productos', money(receipt.productsAmount))
    }
    <div class="receipt-total"><span>TOTAL</span><span>${escapeHtml(
      money(receipt.totalAmount)
    )}</span></div>
    <div class="receipt-rule"></div>
    ${receiptRow('Forma de pago', paymentLabel(receipt.paymentMethod))}
    ${payment}
    ${receipt.notes ? `<div class="receipt-note">Nota: ${escapeHtml(receipt.notes)}</div>` : ''}
    <div class="receipt-rule"></div>
    <div class="receipt-thanks">¡Gracias por su visita!</div>
    <div class="receipt-legal">Comprobante interno · No constituye factura fiscal</div>
  </div>`;
}

function receiptDocumentHtml(receipt: ReceiptData) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante ${escapeHtml(receipt.number)}</title>
  <style>
    @page { size: 80mm 297mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body {
      box-sizing: border-box;
      width: 80mm;
      padding: 4mm 4mm 6mm;
      color: #000000;
    }
    ${RECEIPT_CSS}
    .receipt-paper { max-width: none; width: 72mm; color: #000000; }
    .receipt-paper .receipt-rule { border-top-color: #000000; }
    .receipt-paper .receipt-sub,
    .receipt-paper .receipt-small,
    .receipt-paper .receipt-legal { color: #000000; }
    .receipt-paper .receipt-items th { border-bottom-color: #000000; color: #000000; }
    .receipt-paper .receipt-total { border-top-color: #000000; }
  </style>
</head>
<body>${receiptBodyHtml(receipt)}</body>
</html>`;
}

export function printReceipt(receipt: ReceiptData) {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '80mm';
  iframe.style.height = '600px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return;
  }

  frameDocument.open();
  frameDocument.write(receiptDocumentHtml(receipt));
  frameDocument.close();

  let printed = false;
  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    iframe.remove();
  };
  const trigger = () => {
    if (printed) return;
    printed = true;
    try {
      const contentHeight = Math.max(120, frameDocument.body.scrollHeight);
      const pageHeightMm = Math.ceil((contentHeight * 25.4) / 96) + 4;
      const pageStyle = frameDocument.createElement('style');
      pageStyle.textContent = `@page { size: 80mm ${pageHeightMm}mm; margin: 0; }`;
      frameDocument.head.appendChild(pageStyle);
      frameWindow.focus();
      frameWindow.print();
    } catch {
      cleanup();
    }
  };

  frameWindow.addEventListener('afterprint', cleanup);
  iframe.addEventListener('load', () => window.setTimeout(trigger, 120));
  window.setTimeout(() => {
    if (!printed) trigger();
  }, 500);
  window.setTimeout(cleanup, 60_000);
}
