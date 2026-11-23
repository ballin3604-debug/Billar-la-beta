import React from 'react';
import type { StaffAttendance } from '../types';
import { useApp } from '../context/AppContext';
import {
  durationLabel,
  formatClock,
  formatDateShort,
  formatDateTime,
  plural,
  todayInputDate,
} from '../lib/format';
import { Modal } from './ui/Modal';
import { Printer } from 'lucide-react';

interface AttendanceReportProps {
  entries: StaffAttendance[];
  filterLabel?: string | null;
}

const thClass = 'border border-slate-300 bg-slate-100 px-1.5 py-1 text-left font-bold';
const tdClass = 'border border-slate-300 px-1.5 py-1 align-top';
const numClass = 'border border-slate-300 px-1.5 py-1 text-right align-top whitespace-nowrap';

const entryMinutes = (entry: StaffAttendance) => {
  if (!entry.checkOutAt) return null;
  const start = new Date(entry.checkInAt).getTime();
  const end = new Date(entry.checkOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 60000);
};

export const AttendanceReport: React.FC<AttendanceReportProps> = ({ entries, filterLabel }) => {
  const { settings } = useApp();
  const today = todayInputDate();
  const completed = entries.filter((entry) => Boolean(entry.checkOutAt));
  const open = entries.filter((entry) => !entry.checkOutAt);
  const totalMinutes = completed.reduce((sum, entry) => sum + (entryMinutes(entry) ?? 0), 0);
  const dates = entries.map((entry) => entry.date).sort();

  const peopleMap = new Map<
    number,
    { id: number; name: string; total: number; completed: number; open: number; minutes: number }
  >();
  for (const entry of entries) {
    const current = peopleMap.get(entry.userId) || {
      id: entry.userId,
      name: entry.userName,
      total: 0,
      completed: 0,
      open: 0,
      minutes: 0,
    };
    current.total += 1;
    if (entry.checkOutAt) {
      current.completed += 1;
      current.minutes += entryMinutes(entry) ?? 0;
    } else {
      current.open += 1;
    }
    peopleMap.set(entry.userId, current);
  }
  const people = [...peopleMap.values()].sort(
    (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)
  );

  return (
    <div className="bg-white p-4 text-[10px] leading-snug text-slate-900 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {settings?.businessName || 'Billar Bar la Beta'}
          </p>
          <h1 className="mt-0.5 text-lg font-black uppercase tracking-tight">
            Planilla de asistencia del personal
          </h1>
          <p className="mt-0.5 text-[9px] text-slate-600">
            Entradas y salidas registradas
            {dates.length > 0
              ? ` · ${formatDateShort(dates[0])} → ${formatDateShort(dates[dates.length - 1])}`
              : ''}
          </p>
        </div>
        <div className="text-right text-[9px] leading-relaxed text-slate-600">
          <p>
            <span className="font-bold text-slate-900">Registros:</span> {entries.length}
          </p>
          <p>
            <span className="font-bold text-slate-900">Emitido:</span>{' '}
            {formatDateTime(new Date().toISOString())}
          </p>
          <p>
            <span className="font-bold text-slate-900">Filtros:</span>{' '}
            {filterLabel || 'Todos los registros'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Registros
          </p>
          <p className="num mt-0.5 text-sm font-black">{entries.length}</p>
          <p className="text-[8px] text-slate-500">{plural(entries.length, 'jornada', 'jornadas')}</p>
        </div>
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Completas
          </p>
          <p className="num mt-0.5 text-sm font-black">{completed.length}</p>
          <p className="text-[8px] text-slate-500">con salida registrada</p>
        </div>
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Sin salida
          </p>
          <p className="num mt-0.5 text-sm font-black">{open.length}</p>
          <p className="text-[8px] text-slate-500">requieren revisión</p>
        </div>
        <div className="border border-slate-300 px-2 py-1.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
            Tiempo registrado
          </p>
          <p className="num mt-0.5 text-sm font-black">{durationLabel(totalMinutes)}</p>
          <p className="text-[8px] text-slate-500">solo jornadas completas</p>
        </div>
      </div>

      <div className="mt-3 print-break">
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">Resumen por persona</h2>
        {people.length === 0 ? (
          <p className="border border-slate-300 px-2 py-2 text-[9px] text-slate-500">
            No hay registros para mostrar.
          </p>
        ) : (
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={thClass}>Personal</th>
                <th className={thClass}>Jornadas</th>
                <th className={thClass}>Completas</th>
                <th className={thClass}>Sin salida</th>
                <th className={thClass}>Tiempo registrado</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td className={tdClass}>{person.name}</td>
                  <td className={`${tdClass} text-center`}>{person.total}</td>
                  <td className={`${tdClass} text-center`}>{person.completed}</td>
                  <td className={`${tdClass} text-center`}>
                    {person.open > 0 ? person.open : '—'}
                  </td>
                  <td className={numClass}>{durationLabel(person.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 print-break">
        <h2 className="mb-1 text-[10px] font-black uppercase tracking-wider">
          Detalle de entradas y salidas
        </h2>
        {entries.length === 0 ? (
          <p className="border border-slate-300 px-2 py-2 text-[9px] text-slate-500">
            No hay registros de entrada y salida para los filtros seleccionados.
          </p>
        ) : (
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Personal</th>
                <th className={thClass}>Entrada</th>
                <th className={thClass}>Salida</th>
                <th className={thClass}>Duración</th>
                <th className={thClass}>Turno</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const minutes = entryMinutes(entry);
                const isOpen = !entry.checkOutAt;
                const isToday = entry.date === today;
                const shiftRef = entry.closedShiftId ?? entry.shiftId;
                return (
                  <tr key={entry.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {formatDateShort(entry.date)}
                    </td>
                    <td className={tdClass}>{entry.userName}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {formatClock(entry.checkInAt)}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {entry.checkOutAt ? formatClock(entry.checkOutAt) : 'Sin salida'}
                    </td>
                    <td className={numClass}>
                      {minutes === null ? (isOpen ? 'En curso' : '—') : durationLabel(minutes)}
                    </td>
                    <td className={numClass}>{shiftRef ? `#${shiftRef}` : '—'}</td>
                    <td className={tdClass}>
                      {isOpen ? (isToday ? 'En turno' : 'Sin salida') : 'Completa'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-10 text-center text-[9px]">
        <div className="border-t border-slate-500 pt-1">Firma del responsable</div>
        <div className="border-t border-slate-500 pt-1">Firma del administrador</div>
      </div>

      <p className="mt-4 border-t border-slate-200 pt-1 text-center text-[8px] text-slate-400">
        Documento generado por el sistema local · {settings?.businessName || 'Billar Bar la Beta'} ·
        Entrada = inicio de sesión · Salida = cierre de sesión o de caja.
      </p>
    </div>
  );
};

interface AttendanceReportModalProps {
  open: boolean;
  entries: StaffAttendance[];
  filterLabel?: string | null;
  onClose: () => void;
}

export const AttendanceReportModal: React.FC<AttendanceReportModalProps> = ({
  open,
  entries,
  filterLabel,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      title="Planilla de asistencia del personal"
      subtitle={`${plural(entries.length, 'registro', 'registros')} · ${
        filterLabel || 'Todos los registros'
      }`}
      icon={<Printer className="h-4 w-4" />}
      onClose={onClose}
      size="full"
      bodyClassName="print-area bg-white"
      footer={
        <>
          <p className="mr-auto hidden text-[10px] text-slate-500 sm:block">
            En el diálogo de impresión elige “Guardar como PDF”.
          </p>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.print()}
            disabled={entries.length === 0}
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </>
      }
    >
      <AttendanceReport entries={entries} filterLabel={filterLabel} />
    </Modal>
  );
};
