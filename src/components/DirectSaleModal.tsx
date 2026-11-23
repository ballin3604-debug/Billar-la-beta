import React, { useState } from 'react';
import { Receipt, Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { BarSaleModal } from './BarSaleModal';
import { CustomerTabsModal } from './CustomerTabsModal';

interface DirectSaleModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = 'immediate' | 'tab';

export const DirectSaleModal: React.FC<DirectSaleModalProps> = ({ open, onClose }) => {
  const [mode, setMode] = useState<Mode>('immediate');

  const handleClose = () => {
    setMode('immediate');
    onClose();
  };

  if (mode === 'tab') {
    return <CustomerTabsModal open={open} onClose={handleClose} />;
  }

  return (
    <Modal
      open={open}
      title="Venta directa / Cliente"
      subtitle="Elige si el cobro es inmediato o si queda en cuenta abierta."
      icon={<Receipt className="h-4 w-4" />}
      onClose={handleClose}
      size="xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-[#08111d] p-1.5">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-[11px] font-bold transition bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            onClick={() => setMode('immediate')}
          >
            Cobro inmediato
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-[11px] font-bold transition text-slate-400 hover:text-slate-200 border border-transparent"
            onClick={() => setMode('tab')}
          >
            <span className="inline-flex items-center gap-1.5 justify-center">
              <Users className="h-3.5 w-3.5" />
              Cuenta abierta a cliente
            </span>
          </button>
        </div>

        <BarSaleModal open={open} embedded onClose={handleClose} />
      </div>
    </Modal>
  );
};
