import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import type { ShiftDetail, ShiftHistoryItem } from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  cn,
  formatDateShort,
  formatDateTime,
  formatMoney,
  plural,
} from '../lib/format';
import { StatCard } from './ui/StatCard';
import { EmptyState } from './ui/EmptyState';
import { ShiftDetailModal } from './ShiftDetailModal';
import { ShiftReportModal } from './ShiftReport';

type StatusFilter = 'todos' | 'abiertos' | 'cerrados';

export const HistoryView: React.FC = () => {
  const { settings, user, handleError, notify } = useApp();
  const [shifts, setShifts] = useState<ShiftHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [reportShift, setReportShift] = useState<ShiftDetail | null>(null);
  const [exporting, setExporting] = useState<'plays' | 'shifts' | null>(null);

  const currency = settings?.currency || 'Bs';
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.history();
      setShifts(response.shifts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return shifts.filter((shift) => {
      if (statusFilter === 'abiertos' && shift.status !== 'open') return false;
      if (statusFilter === 'cerrados' && shift.status !== 'closed') return false;
      if (!term) return true;
      return (
        String(shift.id).includes(term) ||
        shift.dateStart.toLowerCase().includes(term) ||
        shift.openedByName.toLowerCase().includes(term) ||
        (shift.closedByName || '').toLowerCase().includes(term)
      );
    });
  }, [query, shifts, statusFilter]);

  const summary = useMemo(() => {
    const closed = shifts.filter((shift) => shift.status === 'closed');
    const totalSales = shifts.reduce((sum, shift) => sum + Number(shift.totals.grossTotal || 0), 0);
    const totalQr = shifts.reduce((sum, shift) => sum + Number(shift.totals.totalQr || 0), 0);
    const discrepancies = closed.filter((shift) => shift.hasDiscrepancy).length;
    return {
      total: shifts.length,
      closed: closed.length,
      totalSales,
      totalQr,
      discrepancies,
    };
  }, [shifts]);

  const counts = {
    todos: shifts.length,
    abiertos: shifts.filter((shift) => shift.status === 'open').length,
    cerrados: shifts.filter((shift) => shift.status === 'closed').length,
  };

  const exportFile = async (kind: 'plays' | 'shifts') => {
    setExporting(kind);
    try {
      if (kind === 'plays') await api.exportPlaysCsv();
      else await api.exportShiftsCsv();
      notify('Archivo exportado correctamente.', 'success');
    } catch (err) {
      handleError(err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Historial de turnos</h1>
          <p className="mt-1 text-xs text-slate-500">
            Consulta cierres anteriores, diferencias de caja y planillas firmadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => exportFile('plays')}
                disabled={Boolean(exporting)}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                {exporting === 'plays' ? 'Exportando…' : 'Partidas CSV'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => exportFile('shifts')}
                disabled={Boolean(exporting)}
              >
                <Download className="h-4 w-4 text-sky-400" />
                {exporting === 'shifts' ? 'Exportando…' : 'Turnos CSV'}
              </button>
            </>
          ) : null}
          <button type="button" className="btn-ghost border border-slate-800" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Turnos registrados"
          value={summary.total}
          hint={plural(summary.closed, 'cerrado', 'cerrados')}
          icon={<History className="h-4 w-4" />}
          tone="slate"
        />
        <StatCard
          label="Ventas acumuladas"
          value={formatMoney(summary.totalSales, currency)}
          hint="Billar + productos"
          icon={<Wallet className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Cobrado por QR"
          value={formatMoney(summary.totalQr, currency)}
          hint="En todos los turnos"
          icon={<CalendarRange className="h-4 w-4" />}
          tone="sky"
        />
        {isAdmin ? (
          <StatCard
            label="Turnos con diferencia"
            value={summary.discrepancies}
            hint={
              summary.discrepancies === 1
                ? 'Requiere revisión del dueño'
                : 'Requieren revisión del dueño'
            }
            icon={<ShieldAlert className="h-4 w-4" />}
            tone={summary.discrepancies > 0 ? 'amber' : 'emerald'}
          />
        ) : (
          <StatCard
            label="Turnos cerrados"
            value={summary.closed}
            hint="Planillas disponibles"
            icon={<History className="h-4 w-4" />}
            tone="violet"
          />
        )}
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {(['todos', 'abiertos', 'cerrados'] as StatusFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                className={cn(
                  'chip capitalize',
                  statusFilter === item && 'chip-active'
                )}
              >
                {item}
                <span className="rounded bg-slate-800 px-1 py-0.5 text-[8px] text-slate-400">
                  {counts[item]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-8"
              placeholder="Buscar por fecha, turno o encargado…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <EmptyState
            title="No se pudo cargar el historial"
            description={error}
            icon={<AlertTriangle className="h-6 w-6" />}
            className="m-4"
            action={
              <button type="button" className="btn-secondary" onClick={load}>
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </button>
            }
          />
        ) : loading ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <p className="text-xs">Cargando turnos…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No hay turnos para mostrar"
            description={
              shifts.length === 0
                ? 'Cuando abras y cierres la primera caja, aparecerá aquí.'
                : 'Prueba con otro filtro o término de búsqueda.'
            }
            icon={<History className="h-6 w-6" />}
            className="m-4"
          />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="data-table min-w-[960px]">
              <thead className="table-head">
                <tr>
                  <th>Turno</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Encargado</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">QR</th>
                  <th className="text-right">Gastos</th>
                  {isAdmin ? <th className="text-right">Diferencia</th> : null}
                  <th>Estado</th>
                  <th className="text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((shift) => {
                  const difference = shift.closing?.difference;
                  const hasDifference =
                    shift.status === 'closed' &&
                    difference !== null &&
                    Math.abs(Number(difference)) > 0.009;
                  return (
                    <tr key={shift.id} className={shift.status === 'open' ? 'bg-emerald-500/[0.025]' : ''}>
                      <td>
                        <p className="font-bold text-slate-200">#{shift.id}</p>
                        <p className="text-[10px] text-slate-500">{formatDateShort(shift.dateStart)}</p>
                      </td>
                      <td className="num text-[10px] text-slate-400">{formatDateTime(shift.openedAt)}</td>
                      <td className="num text-[10px] text-slate-400">
                        {shift.closedAt ? formatDateTime(shift.closedAt) : '—'}
                      </td>
                      <td>
                        <p className="text-slate-300">{shift.openedByName}</p>
                        {shift.closedByName && shift.closedByName !== shift.openedByName ? (
                          <p className="text-[10px] text-slate-500">Cerró: {shift.closedByName}</p>
                        ) : null}
                      </td>
                      <td className="num text-right font-semibold text-slate-200">
                        {formatMoney(shift.totals.grossTotal, currency)}
                      </td>
                      <td className="num text-right text-sky-300">
                        {formatMoney(shift.totals.totalQr, currency)}
                      </td>
                      <td className="num text-right text-rose-300">
                        {formatMoney(shift.totals.totalExpenses, currency)}
                      </td>
                      {isAdmin ? (
                        <td className="text-right">
                          {shift.status === 'open' ? (
                            <span className="text-[10px] text-slate-600">En curso</span>
                          ) : difference === null || difference === undefined ? (
                            <span className="text-[10px] text-slate-600">—</span>
                          ) : (
                            <span
                              className={cn(
                                'num rounded-md border px-1.5 py-0.5 text-[10px] font-bold',
                                hasDifference
                                  ? Number(difference) > 0
                                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                                    : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                              )}
                              title={
                                !hasDifference
                                  ? 'Caja cuadrada'
                                  : Number(difference) > 0
                                    ? 'Sobrante de caja'
                                    : 'Faltante de caja'
                              }
                            >
                              {Number(difference) > 0 ? '+' : ''}
                              {formatMoney(difference, currency)}
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td>
                        {shift.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                            <span className="h-1 w-1 rounded-full bg-emerald-400" />
                            Abierto
                          </span>
                        ) : hasDifference ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Revisar
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                            Cerrado
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn-ghost inline-flex border border-slate-800 px-2 py-1 text-[10px]"
                          onClick={() => setDetailId(shift.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] text-slate-500">
          <span>
            {plural(filtered.length, 'turno', 'turnos')}{' '}
            {filtered.length === 1 ? 'visible' : 'visibles'} de {shifts.length}
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-slate-600" />
            Los turnos cerrados no se pueden modificar
          </span>
        </div>
      </section>

      <ShiftDetailModal
        shiftId={detailId}
        onClose={() => setDetailId(null)}
        onPrint={(shift) => {
          setDetailId(null);
          setReportShift(shift);
        }}
      />
      <ShiftReportModal
        open={Boolean(reportShift)}
        shift={reportShift}
        onClose={() => setReportShift(null)}
      />
    </div>
  );
};
