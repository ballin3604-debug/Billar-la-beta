import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Printer, ReceiptText } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatMoney, plural } from '../lib/format';
import { printReceiptSmart, receiptBodyHtml, RECEIPT_CSS } from '../lib/receipt';
import { Modal } from './ui/Modal';

export const ReceiptModal: React.FC = () => {
  const { receipt, closeReceipt, settings } = useApp();
  const lastAutoPrint = useRef<string | null>(null);
  const autoPrintTimer = useRef<number | null>(null);
  // El refresco de estado cada 30 s no debe reiniciar el temporizador de
  // auto-impresión; se lee la configuración más reciente desde una ref.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!receipt) {
      lastAutoPrint.current = null;
      return;
    }
    if (lastAutoPrint.current === receipt.number) return;
    lastAutoPrint.current = receipt.number;
    autoPrintTimer.current = window.setTimeout(() => {
      autoPrintTimer.current = null;
      void printReceiptSmart(receipt, settingsRef.current);
    }, 450);
    return () => {
      if (autoPrintTimer.current !== null) {
        window.clearTimeout(autoPrintTimer.current);
        autoPrintTimer.current = null;
      }
    };
  }, [receipt]);

  if (!receipt) return null;

  const reprint = () => {
    // Si el usuario imprime antes del auto-impreso, se cancela el pendiente
    // para no sacar dos tickets.
    if (autoPrintTimer.current !== null) {
      window.clearTimeout(autoPrintTimer.current);
      autoPrintTimer.current = null;
    }
    lastAutoPrint.current = receipt.number;
    void printReceiptSmart(receipt, settingsRef.current);
  };

  const itemCount = receipt.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Modal
      open
      title="Comprobante de cobro"
      subtitle={`${receipt.number} · ${receipt.customerName ? `${receipt.customerName} · ` : ''}${formatMoney(receipt.totalAmount, receipt.currency)}`}
      icon={<ReceiptText className="h-4 w-4" />}
      onClose={closeReceipt}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={closeReceipt}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={reprint}
          >
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
              {receipt.kind === 'table' ? receipt.tableName : 'Venta de barra'} A�{' '}
              {plural(itemCount, 'producto', 'productos')}. El comprobante se enviA3 a la impresora;
              si no saliA3, usa el botA3n.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[240px] rounded-lg bg-white px-4 py-4 text-slate-900 shadow-[0_12px_48px_rgba(0,0,0,0.4)]">
          <style>{RECEIPT_CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: receiptBodyHtml(receipt) }} />
        </div>

        <p className="text-center text-[10px] leading-relaxed text-slate-500">
          Formato tAcrmico de 58 mm. Si la impresora imprime en hoja normal, elige el tamaA�o de papel
          correcto en el diA�logo de impresiA3n.
        </p>
      </div>
    </Modal>
  );
};
