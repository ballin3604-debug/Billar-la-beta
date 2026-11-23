import type { AppState, Play, ReceiptData, Sale, Settings } from '../types';
import { api } from './api';
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
    promotions: String(settings.receiptPromotions || '').trim() || undefined,
    playerType: play.playerType,
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
    customerName: sale.customerName || undefined,
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
    promotions: String(settings.receiptPromotions || '').trim() || undefined,
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
    max-width: 48mm;
    margin: 0 auto;
    color: #000;
    font-family: "Cascadia Mono", "Consolas", "Courier New", monospace;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0;
  }
  .receipt-paper * { box-sizing: border-box; }
  .receipt-paper .receipt-header { text-align: center; margin-bottom: 1px; }
  .receipt-paper .receipt-business {
    font-size: 12.5px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: 0.01em;
  }
  .receipt-paper .receipt-sub {
    color: #000;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .receipt-paper .receipt-reprint {
    display: inline-block;
    margin-top: 1px;
    border: 1px solid #000;
    padding: 0 3px;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .receipt-paper .receipt-rule {
    margin: 2px 0;
    border-top: 1px dashed #000;
  }
  .receipt-paper .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }
  .receipt-paper .receipt-row > span:first-child { min-width: 0; }
  .receipt-paper .receipt-row > span:last-child {
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .receipt-paper .receipt-strong { font-weight: 800; }
  .receipt-paper .receipt-center { text-align: center; }
  .receipt-paper .receipt-title {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.02em;
  }
  .receipt-paper .receipt-meta {
    font-size: 9px;
    font-weight: 700;
    line-height: 1.2;
  }
  .receipt-paper .receipt-items {
    width: 100%;
    border-collapse: collapse;
  }
  .receipt-paper .receipt-items th,
  .receipt-paper .receipt-items td {
    padding: 1px 0;
    vertical-align: top;
  }
  .receipt-paper .receipt-items th {
    border-bottom: 1px solid #000;
    color: #000;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .receipt-paper .receipt-qty { width: 12%; text-align: left; white-space: nowrap; }
  .receipt-paper .receipt-amount {
    width: 36%;
    text-align: right;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 700;
  }
  .receipt-paper .receipt-items td.receipt-amount { text-align: right; }
  .receipt-paper .receipt-item-name { word-break: break-word; padding-right: 2px; }
  .receipt-paper .receipt-total {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    margin-top: 2px;
    padding-top: 2px;
    border-top: 1.5px solid #000;
    font-size: 13px;
    font-weight: 900;
    line-height: 1.1;
  }
  .receipt-paper .receipt-total > span:last-child { white-space: nowrap; }
  .receipt-paper .receipt-total-value {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .receipt-paper .receipt-pay-tag {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .receipt-paper .receipt-split {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 5px;
    font-size: 8.5px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }
  .receipt-paper .receipt-split-bar { font-weight: 500; }
  .receipt-paper .receipt-small {
    color: #000;
    font-size: 8.5px;
    font-weight: 600;
    line-height: 1.2;
  }
  .receipt-paper .receipt-note {
    margin-top: 2px;
    font-size: 9px;
    font-weight: 600;
    line-height: 1.2;
  }
  .receipt-paper .receipt-thanks {
    margin-top: 2px;
    text-align: center;
    font-size: 10px;
    font-weight: 900;
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
        <td class="receipt-qty">${item.quantity}x</td>
        <td class="receipt-item-name">${escapeHtml(item.name)}</td>
        <td class="receipt-amount">${escapeHtml(money(item.price * item.quantity))}</td>
      </tr>`
    )
    .join('');

  const title =
    receipt.kind === 'table'
      ? escapeHtml(receipt.tableName || 'Mesa')
      : receipt.customerName
      ? 'VENTA POR CLIENTE'
      : 'VENTA DE BARRA';
  const playerTypeNote =
    receipt.kind === 'table' && receipt.playerType === 'staff'
      ? '<div class="receipt-center receipt-small receipt-strong">Encargados (sin cobro de billar)</div>'
      : receipt.kind === 'table' && receipt.playerType === 'mixed'
      ? '<div class="receipt-center receipt-small receipt-strong">Encargado + cliente (50% billar)</div>'
      : '';
  const detail =
    receipt.kind === 'table'
      ? `<div class="receipt-center receipt-meta">${escapeHtml(
          durationLabel(receipt.durationMinutes || 0)
        )} · ${formatClock(receipt.startTime)}-${formatClock(receipt.endTime)}</div>${playerTypeNote}`
      : receipt.customerName
      ? `<div class="receipt-center receipt-meta">Cliente: ${escapeHtml(receipt.customerName)}</div>`
      : '<div class="receipt-center receipt-meta">Consumo en barra</div>';

  let payment = '';
  if (receipt.paymentMethod === 'efectivo') {
    if (receipt.received) {
      payment += receiptRow('Recibido', money(receipt.received));
      payment += receiptRow('Vuelto', money(receipt.change || 0));
    }
  } else if (receipt.paymentMethod === 'mixto') {
    payment += receiptRow('Efectivo', money(receipt.cashAmount));
    payment += receiptRow('QR', money(receipt.qrAmount));
  }
  if (receipt.qrReference && receipt.paymentMethod !== 'efectivo') {
    payment += `<div class="receipt-small">Ref. QR: ${escapeHtml(receipt.qrReference)}</div>`;
  }

  const promotions = String(receipt.promotions || '').trim();
  const promotionsHtml = promotions
    ? `<div class="receipt-rule"></div><div class="receipt-note receipt-center">${escapeHtml(promotions).replace(/\n/g, '<br />')}</div>`
    : '';

  return `<div class="receipt-paper">
    <div class="receipt-header">
      <div class="receipt-business">${escapeHtml(receipt.businessName)}</div>
      <div class="receipt-sub">Comprobante de caja</div>
      ${receipt.reprint ? '<div class="receipt-reprint">Reimpresión</div>' : ''}
    </div>
    <div class="receipt-rule"></div>
    ${receiptRow('Nro', receipt.number)}
    ${receiptRow('Fecha', formatDateTime(receipt.createdAt))}
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
                <th>Desc.</th>
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
        ? `<div class="receipt-split"><span>Billar ${escapeHtml(
            money(receipt.billiardAmount)
          )}</span><span class="receipt-split-bar">|</span><span>Consumo ${escapeHtml(
            money(receipt.productsAmount)
          )}</span></div>`
        : receiptRow('Productos', money(receipt.productsAmount))
    }
    <div class="receipt-total"><span>TOTAL</span><span class="receipt-total-value"><span class="receipt-pay-tag">${escapeHtml(
      paymentLabel(receipt.paymentMethod)
    )}</span><span>${escapeHtml(money(receipt.totalAmount))}</span></span></div>
    ${payment}
    ${receipt.notes ? `<div class="receipt-note">Nota: ${escapeHtml(receipt.notes)}</div>` : ''}
    <div class="receipt-rule"></div>
    <div class="receipt-thanks">¡Gracias por su visita!</div>
    ${promotionsHtml}
  </div>`;
}

function receiptDocumentHtml(receipt: ReceiptData) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Comprobante ${escapeHtml(receipt.number)}</title>
  <style>
    @page { margin: 0; }
    html {
      margin: 0;
      padding: 0;
      background: #ffffff;
      height: auto;
      min-height: 0;
      overflow: hidden;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      height: auto;
      min-height: 0;
      box-sizing: border-box;
      width: 58mm;
      padding: 1.5mm 3mm 2mm;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${RECEIPT_CSS}
    .receipt-paper { max-width: none; width: 48mm; color: #000000; }
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
  iframe.style.width = '58mm';
  iframe.style.height = '800px';
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
    void (async () => {
      try {
        if (frameDocument.fonts?.ready) {
          await Promise.race([
            frameDocument.fonts.ready,
            new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
          ]);
        }
        const paper = frameDocument.querySelector('.receipt-paper') as HTMLElement | null;
        const paperHeightPx = paper
          ? paper.getBoundingClientRect().height
          : frameDocument.body.scrollHeight;
        const bodyPaddingPx = (3.5 * 96) / 25.4; // 1.5mm arriba + 2mm abajo (igual que el CSS)
        const contentHeightPx = Math.max(120, paperHeightPx + bodyPaddingPx);
        const pageHeightMm = Math.ceil((contentHeightPx * 25.4) / 96 + 2);
        const pageStyle = frameDocument.createElement('style');
        pageStyle.textContent = `@page { size: 58mm ${pageHeightMm}mm; margin: 0; }`;
        frameDocument.head.appendChild(pageStyle);
        console.log('[RECEIPT-PRINT]', {
          measuredHeightPx: contentHeightPx,
          paperHeightPx,
          bodyPaddingPx,
          pageHeightMm,
          devicePixelRatio: window.devicePixelRatio,
          frameInnerWidth: frameWindow.innerWidth,
          userAgent: navigator.userAgent,
        });
        frameWindow.requestAnimationFrame(() => {
          frameWindow.requestAnimationFrame(() => {
            frameWindow.focus();
            frameWindow.print();
          });
        });
      } catch {
        cleanup();
      }
    })();
  };

  frameWindow.addEventListener('afterprint', cleanup);
  iframe.addEventListener('load', () => window.setTimeout(trigger, 120));
  window.setTimeout(() => {
    if (!printed) trigger();
  }, 500);
  window.setTimeout(cleanup, 60_000);
}

export async function printReceiptSmart(receipt: ReceiptData, settings: Settings | null | undefined) {
  const rawEnabled = Boolean(settings?.rawPrintingEnabled);
  const printerName = String(settings?.thermalPrinterName || '').trim();
  if (rawEnabled && printerName) {
    try {
      await api.printReceiptRaw(receipt);
      return;
    } catch (error) {
      console.warn('[RECEIPT-PRINT] RAW falló, usando fallback', error);
    }
  }
  printReceipt(receipt);
}
