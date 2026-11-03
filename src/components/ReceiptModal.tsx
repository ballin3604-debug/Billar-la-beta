import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Printer, ReceiptText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatMoney, plural } from '../lib/format';
import { printReceipt, receiptBodyHtml, RECEIPT_CSS } from '../lib/receipt';
import { Modal } from './ui/Modal';

export const ReceiptModal: React.FC = () => {
  const { receipt, closeReceipt } = useApp();
  const lastAutoPrint = useRef<string | null>(null);

  useEffect(() => {
    if (!receipt) return;
    if (lastAutoPrint.current === receipt.number) return;
    lastAutoPrint.current = receipt.number;
    const timer = window.setTimeout(() => printReceipt(receipt), 450);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  if (!receipt) return null;

  const itemCount = receipt.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Modal
      open
      title="Comprobante de cobro"
      subtitle={`${receipt.number} · ${formatMoney(receipt.totalAmount, receipt.currency)}`}
      icon={<ReceiptText className="h-4 w-4" />}
      onClose={closeReceipt}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={closeReceipt}>
            Cerrar
          </button>
          <button type="button" className="btn-primary" onClick={() => printReceipt(receipt)}>
            <Printer className="h-4 w-4" />
            Imprimir de nuevo
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-xs font-bold text-emerald-300">Cobro registrado correctamente</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              {receipt.kind === 'table' ? receipt.tableName : 'Venta de barra'} ·{' '}
              {plural(itemCount, 'producto', 'productos')}. El comprobante se envió a la impresora;
              si no salió, usa el botón.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[320px] rounded-lg bg-white px-4 py-4 text-slate-900 shadow-[0_12px_48px_rgba(0,0,0,0.4)]">
          <style>{RECEIPT_CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: receiptBodyHtml(receipt) }} />
        </div>

        <p className="text-center text-[10px] leading-relaxed text-slate-500">
          Formato térmico de 80 mm. Si la impresora imprime en hoja normal, elige el tamaño de papel
          correcto en el diálogo de impresión.
        </p>
      </div>
    </Modal>
  );
};
