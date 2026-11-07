import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  HardDrive,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Store,
  TableProperties,
  Users,
  UserRoundPlus,
} from 'lucide-react';
import type {
  AuditEntry,
  BackupInfo,
  Product,
  ProductCategory,
  Role,
  StaffAttendance,
  Table,
  User,
} from '../types';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import {
  actionLabel,
  cn,
  durationLabel,
  formatBackupDate,
  formatBytes,
  formatClock,
  formatDateShort,
  formatDateTime,
  formatMoney,
  plural,
  productCategoryLabel,
  roleLabel,
  todayInputDate,
} from '../lib/format';
import { Modal } from './ui/Modal';
import { EmptyState } from './ui/EmptyState';
import { ChangePinModal } from './ChangePinModal';
import { AttendanceReportModal } from './AttendanceReport';

type Section = 'negocio' | 'mesas' | 'productos' | 'usuarios' | 'personal' | 'respaldos' | 'auditoria';

const SECTIONS: Array<{ id: Section; label: string; icon: React.ReactNode; hint: string }> = [
  { id: 'negocio', label: 'Negocio', icon: <Store className="h-4 w-4" />, hint: 'Nombre, tarifas y bloqueo' },
  { id: 'mesas', label: 'Mesas', icon: <TableProperties className="h-4 w-4" />, hint: 'Mesas y tarifas' },
  { id: 'productos', label: 'Productos', icon: <Package className="h-4 w-4" />, hint: 'Barra, stock y precios' },
  { id: 'usuarios', label: 'Usuarios', icon: <Users className="h-4 w-4" />, hint: 'Cajeros y PINs' },
  { id: 'personal', label: 'Personal', icon: <Clock3 className="h-4 w-4" />, hint: 'Entradas y salidas' },
  { id: 'respaldos', label: 'Respaldos', icon: <DatabaseBackup className="h-4 w-4" />, hint: 'Copias y exportaciones' },
  { id: 'auditoria', label: 'Auditoría', icon: <ShieldCheck className="h-4 w-4" />, hint: 'Registro de acciones' },
];

const PRODUCT_CATEGORIES: ProductCategory[] = ['cervezas', 'bebidas', 'snacks', 'multas', 'otros'];

export const SettingsView: React.FC = () => {
  const {
    settings,
    tables,
    products,
    users,
    user,
    runAction,
    handleError,
    notify,
  } = useApp();
  const [section, setSection] = useState<Section>('negocio');
  const [changePinOpen, setChangePinOpen] = useState(false);

  const [tableModal, setTableModal] = useState<
    { mode: 'new' } | { mode: 'edit'; table: Table } | null
  >(null);
  const [productModal, setProductModal] = useState<
    { mode: 'new' } | { mode: 'edit'; product: Product } | null
  >(null);
  const [userModal, setUserModal] = useState<
    { mode: 'new' } | { mode: 'edit'; user: User } | null
  >(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const [businessForm, setBusinessForm] = useState({
    businessName: '',
    currency: 'Bs',
    defaultRatePerHour: '0',
    minimumPlayCharge: '0',
    autoLockMinutes: '15',
  });
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState<'todas' | ProductCategory>('todas');

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState<'create' | 'download' | 'plays' | 'shifts' | null>(null);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditUser, setAuditUser] = useState('');
  const [auditSensitiveOnly, setAuditSensitiveOnly] = useState(false);

  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceQuery, setAttendanceQuery] = useState('');
  const [attendanceOnlyOpen, setAttendanceOnlyOpen] = useState(false);
  const [attendanceReportOpen, setAttendanceReportOpen] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBusinessForm({
      businessName: settings.businessName,
      currency: settings.currency,
      defaultRatePerHour: String(settings.defaultRatePerHour),
      minimumPlayCharge: String(settings.minimumPlayCharge),
      autoLockMinutes: String(settings.autoLockMinutes),
    });
  }, [settings]);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    setBackupsError(null);
    try {
      const response = await api.backups();
      setBackups(response.backups);
    } catch (err) {
      setBackupsError(err instanceof Error ? err.message : 'No se pudieron cargar los respaldos.');
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await api.audit(400);
      setAuditEntries(response.entries);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría.');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const response = await api.attendance(400);
      setAttendance(response.entries);
    } catch (err) {
      setAttendanceError(
        err instanceof Error ? err.message : 'No se pudo cargar el registro de personal.'
      );
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'respaldos') loadBackups();
    if (section === 'auditoria') loadAudit();
    if (section === 'personal') loadAttendance();
  }, [section, loadBackups, loadAudit, loadAttendance]);

  const currency = settings?.currency || 'Bs';

  const saveBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings || savingBusiness) return;
    setBusinessError(null);
    const rate = Number(businessForm.defaultRatePerHour.replace(',', '.'));
    const minimum = Number(businessForm.minimumPlayCharge.replace(',', '.'));
    const autoLock = Number(businessForm.autoLockMinutes);
    if (businessForm.businessName.trim().length < 2) {
      return setBusinessError('El nombre del negocio es obligatorio.');
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return setBusinessError('La tarifa por defecto no es válida.');
    }
    if (!Number.isFinite(minimum) || minimum < 0) {
      return setBusinessError('El cobro mínimo no es válido.');
    }
    if (!Number.isFinite(autoLock) || autoLock < 0 || autoLock > 240) {
      return setBusinessError('El bloqueo automático debe estar entre 0 y 240 minutos.');
    }

    setSavingBusiness(true);
    try {
      await runAction(() =>
        api.updateSettings({
          businessName: businessForm.businessName.trim(),
          currency: businessForm.currency.trim() || 'Bs',
          defaultRatePerHour: rate,
          minimumPlayCharge: minimum,
          autoLockMinutes: autoLock,
        })
      );
    } finally {
      setSavingBusiness(false);
    }
  };

  const createBackup = async () => {
    setBackupBusy('create');
    try {
      const response = await api.createBackup();
      setBackups(response.backups || []);
      notify(response.message || 'Copia de seguridad creada.', 'success');
    } catch (err) {
      handleError(err);
    } finally {
      setBackupBusy(null);
    }
  };

  const downloadDatabase = async () => {
    setBackupBusy('download');
    try {
      await api.downloadBackup();
      notify('Respaldo descargado. Guárdalo fuera de esta computadora.', 'success');
      await loadBackups();
    } catch (err) {
      handleError(err);
    } finally {
      setBackupBusy(null);
    }
  };

  const exportFile = async (kind: 'plays' | 'shifts') => {
    setBackupBusy(kind);
    try {
      if (kind === 'plays') await api.exportPlaysCsv();
      else await api.exportShiftsCsv();
      notify('Archivo exportado.', 'success');
    } catch (err) {
      handleError(err);
    } finally {
      setBackupBusy(null);
    }
  };

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (productCategory !== 'todas' && product.category !== productCategory) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        productCategoryLabel(product.category).toLowerCase().includes(term)
      );
    });
  }, [productCategory, productSearch, products]);

  const filteredAudit = useMemo(() => {
    const term = auditQuery.trim().toLowerCase();
    return auditEntries.filter((entry) => {
      if (auditUser && entry.userName !== auditUser) return false;
      if (auditSensitiveOnly) {
        const sensitive = ['void', 'cancel', 'login_failed', 'shift_close', 'expense'];
        if (!sensitive.some((token) => entry.action.includes(token))) return false;
      }
      if (!term) return true;
      const details = entry.details ? JSON.stringify(entry.details) : '';
      return (
        actionLabel(entry.action).toLowerCase().includes(term) ||
        entry.action.toLowerCase().includes(term) ||
        entry.userName.toLowerCase().includes(term) ||
        details.toLowerCase().includes(term)
      );
    });
  }, [auditEntries, auditQuery, auditSensitiveOnly, auditUser]);

  const filteredAttendance = useMemo(() => {
    const term = attendanceQuery.trim().toLowerCase();
    return attendance.filter((entry) => {
      if (attendanceOnlyOpen && entry.checkOutAt) return false;
      if (!term) return true;
      return (
        entry.userName.toLowerCase().includes(term) ||
        entry.date.includes(term)
      );
    });
  }, [attendance, attendanceOnlyOpen, attendanceQuery]);

  const today = todayInputDate();
  const openAttendance = attendance.filter((entry) => !entry.checkOutAt);
  const todayAttendance = attendance.filter((entry) => entry.date === today);
  const attendanceFilterLabel =
    [
      attendanceQuery.trim() ? `Búsqueda: “${attendanceQuery.trim()}”` : null,
      attendanceOnlyOpen ? 'Solo jornadas sin salida' : null,
    ]
      .filter(Boolean)
      .join(' · ') || null;

  const sectionInfo = SECTIONS.find((item) => item.id === section);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">Ajustes del sistema</h1>
          <p className="mt-1 text-xs text-slate-500">
            Configuración local del negocio. Los cambios quedan registrados en auditoría.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setChangePinOpen(true)}>
          <KeyRound className="h-4 w-4 text-amber-400" />
          Cambiar mi PIN
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="panel h-fit overflow-hidden lg:sticky lg:top-[7.75rem]">
          <div className="scroll-thin flex overflow-x-auto p-1.5 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full',
                  section === item.id
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                )}
              >
                <span className={cn('shrink-0', section === item.id ? 'text-emerald-400' : 'text-slate-500')}>
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{item.label}</span>
                  <span className="hidden text-[9px] font-normal text-slate-500 lg:block">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="hidden border-t border-slate-800/80 px-3.5 py-3 lg:block">
            <p className="text-[9px] uppercase tracking-wider text-slate-600">Sesión actual</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-300">{user?.name}</p>
            <p className="text-[9px] text-slate-500">{roleLabel(user?.role || '')}</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">{sectionInfo?.label}</h2>
            <span className="text-[10px] text-slate-500">· {sectionInfo?.hint}</span>
          </div>

          {section === 'negocio' ? (
            <div className="space-y-4">
              <div className="panel overflow-hidden">
                <div className="panel-head">
                  <div>
                    <h3 className="text-xs font-bold text-white">Datos del negocio</h3>
                    <p className="text-[10px] text-slate-500">Aparecen en la cabecera y en las planillas impresas.</p>
                  </div>
                  <Store className="h-4 w-4 text-slate-500" />
                </div>
                <form onSubmit={saveBusiness} className="space-y-4 px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="business-name">
                        Nombre del negocio
                      </label>
                      <input
                        id="business-name"
                        className="input"
                        maxLength={60}
                        value={businessForm.businessName}
                        onChange={(event) =>
                          setBusinessForm((previous) => ({
                            ...previous,
                            businessName: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="business-currency">
                        Moneda
                      </label>
                      <input
                        id="business-currency"
                        className="input"
                        maxLength={4}
                        value={businessForm.currency}
                        onChange={(event) =>
                          setBusinessForm((previous) => ({ ...previous, currency: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="default-rate">
                        Tarifa por hora por defecto ({currency})
                      </label>
                      <input
                        id="default-rate"
                        className="input num"
                        inputMode="decimal"
                        value={businessForm.defaultRatePerHour}
                        onChange={(event) =>
                          setBusinessForm((previous) => ({
                            ...previous,
                            defaultRatePerHour: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="minimum-charge">
                        Cobro mínimo de una partida ({currency})
                      </label>
                      <input
                        id="minimum-charge"
                        className="input num"
                        inputMode="decimal"
                        value={businessForm.minimumPlayCharge}
                        onChange={(event) =>
                          setBusinessForm((previous) => ({
                            ...previous,
                            minimumPlayCharge: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="auto-lock">
                        Bloqueo automático por inactividad (minutos)
                      </label>
                      <input
                        id="auto-lock"
                        className="input num"
                        inputMode="numeric"
                        value={businessForm.autoLockMinutes}
                        onChange={(event) => {
                          if (!/^\d{0,3}$/.test(event.target.value)) return;
                          setBusinessForm((previous) => ({
                            ...previous,
                            autoLockMinutes: event.target.value,
                          }));
                        }}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        0 desactiva el bloqueo. Recomendado: 5 a 15 minutos.
                      </p>
                    </div>
                  </div>

                  {businessError ? (
                    <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
                      {businessError}
                    </div>
                  ) : null}

                  <div className="flex justify-end border-t border-slate-800/80 pt-3">
                    <button type="submit" className="btn-primary" disabled={savingBusiness}>
                      {savingBusiness ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="kpi">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                  <p className="mt-2 text-[11px] font-bold text-slate-200">Datos locales</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    La base SQLite vive en la carpeta <span className="num">data/</span> de esta
                    computadora. No se envía nada a internet.
                  </p>
                </div>
                <div className="kpi">
                  <ShieldCheck className="h-4 w-4 text-sky-400" />
                  <p className="mt-2 text-[11px] font-bold text-slate-200">Seguridad</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    PINs con hash, sesiones de 12 horas y auditoría de cada acción sensible.
                  </p>
                </div>
                <div className="kpi">
                  <DatabaseBackup className="h-4 w-4 text-amber-400" />
                  <p className="mt-2 text-[11px] font-bold text-slate-200">Respaldos</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    Se crea una copia automática al cerrar cada caja. Descarga una fuera del local.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {section === 'mesas' ? (
            <div className="panel overflow-hidden">
              <div className="panel-head">
                <div>
                  <h3 className="text-xs font-bold text-white">Mesas del salón</h3>
                  <p className="text-[10px] text-slate-500">
                    {plural(
                      tables.filter((table) => table.active).length,
                      'activa',
                      'activas'
                    )}{' '}
                    de {tables.length}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary px-2.5 py-1.5 text-[11px]"
                  onClick={() => setTableModal({ mode: 'new' })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva mesa
                </button>
              </div>

              {tables.length === 0 ? (
                <EmptyState
                  title="No hay mesas"
                  description="Crea la primera mesa para empezar a controlar partidas."
                  icon={<TableProperties className="h-6 w-6" />}
                  className="m-4"
                />
              ) : (
                <div className="grid gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className={cn(
                        'rounded-xl border p-3.5 transition',
                        table.active
                          ? 'border-slate-800 bg-[#08111d]'
                          : 'border-slate-800/60 bg-[#070d16] opacity-60'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                            Mesa {table.number}
                          </p>
                          <p className="text-sm font-bold text-slate-100">{table.name}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                            !table.active
                              ? 'border-slate-700 bg-slate-800/60 text-slate-500'
                              : table.status === 'occupied'
                              ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                          )}
                        >
                          {!table.active ? 'Inactiva' : table.status === 'occupied' ? 'Ocupada' : 'Libre'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Tarifa por hora</span>
                        <span className="num font-semibold text-slate-300">
                          {formatMoney(table.ratePerHour, currency)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary mt-3 w-full py-1.5 text-[10px]"
                        onClick={() => setTableModal({ mode: 'edit', table })}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar mesa
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] leading-relaxed text-slate-500">
                Desactivar una mesa evita que se inicie, pero conserva su historial. No se puede
                desactivar una mesa ocupada.
              </div>
            </div>
          ) : null}

          {section === 'productos' ? (
            <div className="panel overflow-hidden">
              <div className="panel-head flex-wrap">
                <div>
                  <h3 className="text-xs font-bold text-white">Productos de barra</h3>
                  <p className="text-[10px] text-slate-500">
                    {plural(
                      products.filter((product) => product.active).length,
                      'activo',
                      'activos'
                    )}{' '}
                    de {products.length}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary px-2.5 py-1.5 text-[11px]"
                  onClick={() => setProductModal({ mode: 'new' })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo producto
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 px-4 py-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8"
                    placeholder="Buscar producto…"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setProductCategory('todas')}
                    className={cn('chip text-[10px]', productCategory === 'todas' && 'chip-active')}
                  >
                    Todas
                  </button>
                  {PRODUCT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setProductCategory(category)}
                      className={cn('chip text-[10px]', productCategory === category && 'chip-active')}
                    >
                      {productCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <EmptyState
                  title="Sin productos"
                  description="Agrega cervezas, bebidas o snacks para venderlos en mesas y barra."
                  icon={<Package className="h-6 w-6" />}
                  className="m-4"
                />
              ) : (
                <div className="scroll-thin overflow-x-auto">
                  <table className="data-table min-w-[720px]">
                    <thead className="table-head">
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th className="text-right">Precio</th>
                        <th className="text-right">Stock</th>
                        <th>Estado</th>
                        <th className="text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className={!product.active ? 'opacity-50' : ''}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">{product.name}</span>
                              {product.favorite ? (
                                <Star className="h-3 w-3 fill-amber-400/70 text-amber-400/70" />
                              ) : null}
                            </div>
                          </td>
                          <td className="text-slate-400">{productCategoryLabel(product.category)}</td>
                          <td className="num text-right font-semibold text-slate-200">
                            {formatMoney(product.price, currency)}
                          </td>
                          <td className="num text-right">
                            {product.stock === null ? (
                              <span className="text-slate-500">Ilimitado</span>
                            ) : (
                              <span className={product.stock <= 3 ? 'text-amber-300' : 'text-slate-300'}>
                                {product.stock}
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={cn(
                                'rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                                product.active
                                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                  : 'border-slate-700 bg-slate-800/50 text-slate-500'
                              )}
                            >
                              {product.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="btn-ghost inline-flex border border-slate-800 px-2 py-1 text-[10px]"
                              onClick={() => setProductModal({ mode: 'edit', product })}
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {section === 'usuarios' ? (
            <div className="space-y-3">
              <div className="panel overflow-hidden">
                <div className="panel-head">
                  <div>
                    <h3 className="text-xs font-bold text-white">Usuarios y PINs</h3>
                    <p className="text-[10px] text-slate-500">
                      {plural(
                        users.filter((entry) => entry.active).length,
                        'activo',
                        'activos'
                      )}{' '}
                      · cada acción queda asociada a un usuario
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary px-2.5 py-1.5 text-[11px]"
                    onClick={() => setUserModal({ mode: 'new' })}
                  >
                    <UserRoundPlus className="h-3.5 w-3.5" />
                    Nuevo usuario
                  </button>
                </div>

                {users.length === 0 ? (
                  <EmptyState
                    title="Sin usuarios"
                    description="Crea un usuario para cada persona que opere la caja."
                    icon={<Users className="h-6 w-6" />}
                    className="m-4"
                  />
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {users.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-3 px-4 py-3',
                          !entry.active && 'opacity-50'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black',
                              entry.role === 'admin'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-sky-500/15 text-sky-300'
                            )}
                          >
                            {entry.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-bold text-slate-200">{entry.name}</p>
                              {entry.id === user?.id ? (
                                <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1 py-0.5 text-[8px] font-bold text-emerald-300">
                                  Tú
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              {roleLabel(entry.role)} · desde {formatDateTime(entry.createdAt)}
                              {entry.mustChangePin ? ' · debe cambiar PIN' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'mr-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                              entry.active
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                : 'border-slate-700 bg-slate-800/50 text-slate-500'
                            )}
                          >
                            {entry.active ? 'Activo' : 'Inactivo'}
                          </span>
                          <button
                            type="button"
                            className="btn-ghost border border-slate-800 px-2 py-1 text-[10px]"
                            onClick={() => setUserModal({ mode: 'edit', user: entry })}
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          {entry.id !== user?.id ? (
                            <button
                              type="button"
                              className="btn-ghost border border-slate-800 px-2 py-1 text-[10px]"
                              onClick={() => setResetUser(entry)}
                            >
                              <KeyRound className="h-3 w-3" />
                              PIN
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] leading-relaxed text-slate-500">
                  Un PIN no puede repetirse entre usuarios. Al asignar un PIN temporal, la persona
                  deberá cambiarlo en su próximo ingreso.
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-[10px] leading-relaxed text-amber-200/80">
                <p className="font-bold text-amber-300">Recomendación de seguridad</p>
                <p className="mt-1">
                  Cada cajero debe tener su propio usuario. No compartas el PIN del administrador
                  ni lo escribas en un papel visible. Revisa la auditoría ante cualquier diferencia
                  de caja.
                </p>
              </div>
            </div>
          ) : null}

          {section === 'personal' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="kpi">
                  <LogIn className="h-4 w-4 text-emerald-400" />
                  <p className="mt-2 label mb-1">Entradas</p>
                  <p className="num text-base font-bold text-white">{attendance.length}</p>
                </div>
                <div className="kpi">
                  <Clock3 className="h-4 w-4 text-amber-400" />
                  <p className="mt-2 label mb-1">Jornadas abiertas</p>
                  <p className="num text-base font-bold text-amber-300">{openAttendance.length}</p>
                </div>
                <div className="kpi">
                  <LogOut className="h-4 w-4 text-sky-400" />
                  <p className="mt-2 label mb-1">Entradas de hoy</p>
                  <p className="num text-base font-bold text-sky-300">{todayAttendance.length}</p>
                </div>
              </div>

              <div className="panel overflow-hidden">
                <div className="panel-head flex-wrap">
                  <div>
                    <h3 className="text-xs font-bold text-white">Entradas y salidas del personal</h3>
                    <p className="text-[10px] text-slate-500">
                      La entrada se registra al iniciar sesión; la salida, al cerrar caja.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary px-2.5 py-1.5 text-[10px]"
                      onClick={() => setAttendanceReportOpen(true)}
                      disabled={attendanceLoading || filteredAttendance.length === 0}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir / PDF
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-2.5 py-1.5 text-[10px]"
                      onClick={loadAttendance}
                      disabled={attendanceLoading}
                    >
                      <RefreshCw className={cn('h-3.5 w-3.5', attendanceLoading && 'animate-spin')} />
                      Actualizar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 px-4 py-3">
                  <div className="relative min-w-[180px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                      className="input pl-8"
                      placeholder="Buscar por personal o fecha…"
                      value={attendanceQuery}
                      onChange={(event) => setAttendanceQuery(event.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={cn('chip text-[10px]', attendanceOnlyOpen && 'chip-active')}
                    onClick={() => setAttendanceOnlyOpen((previous) => !previous)}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    Sin salida
                  </button>
                </div>

                {attendanceError ? (
                  <EmptyState
                    title="No se pudo cargar el personal"
                    description={attendanceError}
                    icon={<AlertTriangle className="h-6 w-6" />}
                    className="m-4"
                    action={
                      <button type="button" className="btn-secondary" onClick={loadAttendance}>
                        <RefreshCw className="h-4 w-4" />
                        Reintentar
                      </button>
                    }
                  />
                ) : attendanceLoading ? (
                  <div className="flex min-h-[220px] items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando entradas y salidas…
                  </div>
                ) : filteredAttendance.length === 0 ? (
                  <EmptyState
                    title="Sin registros de personal"
                    description={
                      attendance.length === 0
                        ? 'Cuando alguien ingrese con su PIN, aquí aparecerá su hora de entrada.'
                        : 'No hay registros que coincidan con los filtros.'
                    }
                    icon={<Clock3 className="h-6 w-6" />}
                    className="m-4"
                  />
                ) : (
                  <div className="scroll-thin overflow-x-auto">
                    <table className="data-table min-w-[760px]">
                      <thead className="table-head">
                        <tr>
                          <th>Fecha</th>
                          <th>Personal</th>
                          <th>Entrada</th>
                          <th>Salida</th>
                          <th>Duración</th>
                          <th>Turno</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map((entry) => {
                          const isOpen = !entry.checkOutAt;
                          const isToday = entry.date === today;
                          const minutes = entry.checkOutAt
                            ? Math.max(
                                0,
                                Math.round(
                                  (new Date(entry.checkOutAt).getTime() -
                                    new Date(entry.checkInAt).getTime()) /
                                    60000
                                )
                              )
                            : null;
                          const shiftRef = entry.closedShiftId ?? entry.shiftId;
                          return (
                            <tr key={entry.id}>
                              <td className="num whitespace-nowrap text-[10px] text-slate-400">
                                {formatDateShort(entry.date)}
                              </td>
                              <td className="font-semibold text-slate-200">{entry.userName}</td>
                              <td className="num text-slate-300">{formatClock(entry.checkInAt)}</td>
                              <td className="num text-slate-300">
                                {entry.checkOutAt ? formatClock(entry.checkOutAt) : '—'}
                              </td>
                              <td className="num text-slate-400">
                                {isOpen ? 'En curso' : durationLabel(minutes ?? 0)}
                              </td>
                              <td className="num text-slate-500">
                                {shiftRef ? `#${shiftRef}` : '—'}
                              </td>
                              <td>
                                <span
                                  className={cn(
                                    'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                                    isOpen
                                      ? isToday
                                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                        : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                                      : 'border-slate-700 bg-slate-800/50 text-slate-400'
                                  )}
                                >
                                  {isOpen ? (isToday ? 'En turno' : 'Sin salida') : 'Completa'}
                                </span>
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
                    {plural(filteredAttendance.length, 'registro', 'registros')}{' '}
                    {filteredAttendance.length === 1 ? 'visible' : 'visibles'} de {attendance.length}
                  </span>
                  <span>Entrada = inicio de sesión · Salida = arqueo de caja</span>
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] px-4 py-3 text-[10px] leading-relaxed text-slate-400">
                <p className="font-bold text-sky-300">Registro automático</p>
                <p className="mt-1">
                  Cada ingreso con PIN abre una jornada con su hora de entrada. Al confirmar el
                  arqueo y cerrar la caja, se guarda la hora de salida del usuario que cierra. Si
                  alguien no cierra caja, su jornada queda marcada como “Sin salida”.
                </p>
              </div>
            </div>
          ) : null}

          {section === 'respaldos' ? (
            <div className="space-y-4">
              <div className="panel overflow-hidden">
                <div className="panel-head">
                  <div>
                    <h3 className="text-xs font-bold text-white">Copias de seguridad</h3>
                    <p className="text-[10px] text-slate-500">
                      Se guardan en la carpeta <span className="num">data/backups</span> de esta
                      computadora.
                    </p>
                  </div>
                  <DatabaseBackup className="h-4 w-4 text-slate-500" />
                </div>

                <div className="grid gap-2.5 px-4 py-4 sm:grid-cols-3">
                  <button
                    type="button"
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-left transition hover:border-emerald-500/50"
                    onClick={createBackup}
                    disabled={Boolean(backupBusy)}
                  >
                    <DatabaseBackup className="h-5 w-5 text-emerald-400" />
                    <p className="mt-2 text-[11px] font-bold text-slate-200">
                      {backupBusy === 'create' ? 'Creando…' : 'Crear copia ahora'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Respaldo completo de la base.</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-3 text-left transition hover:border-sky-500/50"
                    onClick={downloadDatabase}
                    disabled={Boolean(backupBusy)}
                  >
                    <Download className="h-5 w-5 text-sky-400" />
                    <p className="mt-2 text-[11px] font-bold text-slate-200">
                      {backupBusy === 'download' ? 'Preparando…' : 'Descargar base'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Guárdala en un USB o en otro equipo.</p>
                  </button>
                  <div className="rounded-xl border border-slate-800 bg-[#08111d] p-3">
                    <FileSpreadsheet className="h-5 w-5 text-amber-400" />
                    <p className="mt-2 text-[11px] font-bold text-slate-200">Exportar CSV</p>
                    <div className="mt-1 flex gap-1.5">
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-sky-400 hover:text-sky-300"
                        onClick={() => exportFile('plays')}
                        disabled={Boolean(backupBusy)}
                      >
                        {backupBusy === 'plays' ? '…' : 'Partidas'}
                      </button>
                      <span className="text-slate-700">·</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-sky-400 hover:text-sky-300"
                        onClick={() => exportFile('shifts')}
                        disabled={Boolean(backupBusy)}
                      >
                        {backupBusy === 'shifts' ? '…' : 'Turnos'}
                      </button>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-500">Para abrir en Excel.</p>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 bg-[#08111d]">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Respaldos disponibles
                    </p>
                    <button
                      type="button"
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                      onClick={loadBackups}
                      disabled={backupsLoading}
                    >
                      <RefreshCw className={cn('inline h-3 w-3', backupsLoading && 'animate-spin')} /> Actualizar
                    </button>
                  </div>

                  {backupsError ? (
                    <p className="px-4 py-4 text-xs text-rose-300">{backupsError}</p>
                  ) : backupsLoading ? (
                    <p className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando respaldos…
                    </p>
                  ) : backups.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-slate-500">
                      Todavía no hay respaldos. Crea el primero ahora.
                    </p>
                  ) : (
                    <div className="scroll-thin max-h-60 overflow-y-auto">
                      <table className="data-table">
                        <thead className="table-head">
                          <tr>
                            <th>Archivo</th>
                            <th>Tamaño</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backups.map((backup) => (
                            <tr key={backup.name}>
                              <td className="num text-[10px] text-slate-300">{backup.name}</td>
                              <td className="num text-[10px] text-slate-500">{formatBytes(backup.size)}</td>
                              <td className="num text-[10px] text-slate-500">
                                {formatBackupDate(backup.modifiedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Cómo restaurar un respaldo
                </p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[10px] leading-relaxed text-slate-400">
                  <li>Cierra el sistema y la ventana del navegador.</li>
                  <li>
                    Copia el archivo descargado en la carpeta <span className="num">data/</span> y
                    renómbralo como <span className="num">billar.db</span>, reemplazando el actual.
                  </li>
                  <li>Vuelve a abrir el sistema con <span className="num">iniciar.bat</span>.</li>
                </ol>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  Guarda una copia fuera de esta computadora al menos una vez por semana. Si la
                  laptop se pierde o se daña, la caja se recupera con ese archivo.
                </p>
              </div>
            </div>
          ) : null}

          {section === 'auditoria' ? (
            <div className="panel overflow-hidden">
              <div className="panel-head flex-wrap">
                <div>
                  <h3 className="text-xs font-bold text-white">Auditoría de acciones</h3>
                  <p className="text-[10px] text-slate-500">
                    Registro append-only de los últimos 400 movimientos.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1.5 text-[10px]"
                  onClick={loadAudit}
                  disabled={auditLoading}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', auditLoading && 'animate-spin')} />
                  Actualizar
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 px-4 py-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-8"
                    placeholder="Buscar acción, usuario o detalle…"
                    value={auditQuery}
                    onChange={(event) => setAuditQuery(event.target.value)}
                  />
                </div>
                <select
                  className="input w-auto min-w-[130px]"
                  value={auditUser}
                  onChange={(event) => setAuditUser(event.target.value)}
                >
                  <option value="">Todos los usuarios</option>
                  {users.map((entry) => (
                    <option key={entry.id} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={cn('chip text-[10px]', auditSensitiveOnly && 'chip-active')}
                  onClick={() => setAuditSensitiveOnly((previous) => !previous)}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Solo sensibles
                </button>
              </div>

              {auditError ? (
                <EmptyState
                  title="No se pudo cargar la auditoría"
                  description={auditError}
                  icon={<AlertTriangle className="h-6 w-6" />}
                  className="m-4"
                  action={
                    <button type="button" className="btn-secondary" onClick={loadAudit}>
                      <RefreshCw className="h-4 w-4" />
                      Reintentar
                    </button>
                  }
                />
              ) : auditLoading ? (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando registro…
                </div>
              ) : filteredAudit.length === 0 ? (
                <EmptyState
                  title="Sin registros"
                  description="No hay acciones que coincidan con los filtros."
                  icon={<ShieldCheck className="h-6 w-6" />}
                  className="m-4"
                />
              ) : (
                <div className="scroll-thin max-h-[600px] overflow-y-auto">
                  <table className="data-table min-w-[760px]">
                    <thead className="table-head sticky top-0 z-10">
                      <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Acción</th>
                        <th>Turno</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAudit.map((entry) => {
                        const sensitive =
                          entry.action.includes('void') ||
                          entry.action.includes('cancel') ||
                          entry.action.includes('login_failed') ||
                          entry.action === 'shift_close';
                        return (
                          <tr key={entry.id}>
                            <td className="num whitespace-nowrap text-[10px] text-slate-400">
                              {formatDateTime(entry.createdAt)}
                            </td>
                            <td className="text-[11px] font-semibold text-slate-300">{entry.userName}</td>
                            <td>
                              <span
                                className={cn(
                                  'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold',
                                  sensitive
                                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                                    : 'border-slate-700 bg-slate-800/40 text-slate-400'
                                )}
                              >
                                {actionLabel(entry.action)}
                              </span>
                            </td>
                            <td className="num text-[10px] text-slate-500">
                              {entry.shiftId ? `#${entry.shiftId}` : '—'}
                            </td>
                            <td className="max-w-[360px]">
                              {entry.details ? (
                                <details>
                                  <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">
                                    Ver detalle
                                  </summary>
                                  <pre className="scroll-thin mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-[#070d16] p-2 text-[9px] leading-relaxed text-slate-400">
                                    {JSON.stringify(entry.details, null, 2)}
                                  </pre>
                                </details>
                              ) : (
                                <span className="text-[10px] text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-slate-800/80 bg-[#08111d] px-4 py-2.5 text-[10px] text-slate-500">
                {plural(filteredAudit.length, 'registro', 'registros')}{' '}
                {filteredAudit.length === 1 ? 'visible' : 'visibles'} de {auditEntries.length}. Los
                registros no se pueden editar ni borrar.
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <TableFormModal
        open={Boolean(tableModal)}
        table={tableModal?.mode === 'edit' ? tableModal.table : null}
        currency={currency}
        defaultRate={settings?.defaultRatePerHour || 0}
        onClose={() => setTableModal(null)}
      />
      <ProductFormModal
        open={Boolean(productModal)}
        product={productModal?.mode === 'edit' ? productModal.product : null}
        currency={currency}
        onClose={() => setProductModal(null)}
      />
      <UserFormModal
        open={Boolean(userModal)}
        editingUser={userModal?.mode === 'edit' ? userModal.user : null}
        currentUser={user}
        onClose={() => setUserModal(null)}
      />
      <ResetPinModal
        open={Boolean(resetUser)}
        target={resetUser}
        onClose={() => setResetUser(null)}
      />
      <ChangePinModal open={changePinOpen} onClose={() => setChangePinOpen(false)} />
      <AttendanceReportModal
        open={attendanceReportOpen}
        entries={filteredAttendance}
        filterLabel={attendanceFilterLabel}
        onClose={() => setAttendanceReportOpen(false)}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Modales de edición                                                   */
/* ------------------------------------------------------------------ */

interface TableFormModalProps {
  open: boolean;
  table: Table | null;
  currency: string;
  defaultRate: number;
  onClose: () => void;
}

const TableFormModal: React.FC<TableFormModalProps> = ({
  open,
  table,
  currency,
  defaultRate,
  onClose,
}) => {
  const { runAction } = useApp();
  const [name, setName] = useState('');
  const [rate, setRate] = useState('0');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(table?.name || '');
      setRate(String(table?.ratePerHour ?? defaultRate));
      setActive(table?.active ?? true);
      setBusy(false);
      setError(null);
    }
  }, [defaultRate, open, table]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const numericRate = Number(rate.replace(',', '.'));
    if (name.trim().length < 2) return setError('El nombre de la mesa es obligatorio.');
    if (!Number.isFinite(numericRate) || numericRate < 0) {
      return setError('La tarifa no es válida.');
    }

    setBusy(true);
    try {
      const response = table
        ? await runAction(() =>
            api.updateTable(table.id, { name: name.trim(), ratePerHour: numericRate, active })
          )
        : await runAction(() =>
            api.createTable({ name: name.trim(), ratePerHour: numericRate })
          );
      if (response) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={table ? `Editar ${table.name}` : 'Nueva mesa'}
      subtitle={table ? `Mesa ${table.number}` : 'El número se asigna automáticamente.'}
      icon={<TableProperties className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="table-form" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : table ? 'Guardar cambios' : 'Crear mesa'}
          </button>
        </>
      }
    >
      <form id="table-form" className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="table-name">
            Nombre de la mesa
          </label>
          <input
            id="table-name"
            className="input"
            maxLength={40}
            autoFocus
            value={name}
            placeholder="Ej. Mesa 1, Mesa VIP, Billar 3"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="table-rate">
            Tarifa por hora ({currency})
          </label>
          <input
            id="table-rate"
            className="input num"
            inputMode="decimal"
            value={rate}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d*[.,]?\d{0,2}$/.test(value)) setRate(value);
            }}
          />
        </div>
        {table ? (
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2.5 text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-[#070d16] accent-emerald-500"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Mesa activa para operar
            {table.status === 'occupied' ? (
              <span className="ml-auto text-[9px] text-amber-400">Ocupada</span>
            ) : null}
          </label>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-slate-500">
            Si desactivas una mesa ocupada, el sistema lo impedirá para no perder la partida.
          </p>
        )}
      </form>
    </Modal>
  );
};

interface ProductFormModalProps {
  open: boolean;
  product: Product | null;
  currency: string;
  onClose: () => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  open,
  product,
  currency,
  onClose,
}) => {
  const { runAction } = useApp();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('cervezas');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(product?.name || '');
      setCategory(product?.category || 'cervezas');
      setPrice(String(product?.price ?? ''));
      setStock(product?.stock === null || product?.stock === undefined ? '' : String(product.stock));
      setFavorite(product?.favorite ?? false);
      setActive(product?.active ?? true);
      setBusy(false);
      setError(null);
    }
  }, [open, product]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const numericPrice = Number(price.replace(',', '.'));
    const numericStock = stock.trim() === '' ? null : Math.floor(Number(stock));
    if (name.trim().length < 2) return setError('El nombre del producto es obligatorio.');
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return setError('El precio debe ser mayor a cero.');
    }
    if (numericStock !== null && (!Number.isFinite(numericStock) || numericStock < 0)) {
      return setError('El stock debe ser un número mayor o igual a cero.');
    }

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        price: numericPrice,
        stock: numericStock,
        favorite,
        ...(product ? { active } : {}),
      };
      const response = product
        ? await runAction(() => api.updateProduct(product.id, payload))
        : await runAction(() => api.createProduct(payload));
      if (response) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={product ? `Editar ${product.name}` : 'Nuevo producto'}
      subtitle="Se mostrará en mesas y en la venta rápida de barra."
      icon={<Package className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="product-form" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </>
      }
    >
      <form id="product-form" className="space-y-3" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="product-name">
              Nombre
            </label>
            <input
              id="product-name"
              className="input"
              maxLength={60}
              autoFocus
              value={name}
              placeholder="Ej. Cerveza Paceña"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="product-category">
              Categoría
            </label>
            <select
              id="product-category"
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value as ProductCategory)}
            >
              {PRODUCT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {productCategoryLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="product-price">
              Precio ({currency})
            </label>
            <input
              id="product-price"
              className="input num"
              inputMode="decimal"
              value={price}
              onChange={(event) => {
                const value = event.target.value;
                if (/^\d*[.,]?\d{0,2}$/.test(value)) setPrice(value);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="product-stock">
              Stock (vacío = ilimitado)
            </label>
            <input
              id="product-stock"
              className="input num"
              inputMode="numeric"
              value={stock}
              onChange={(event) => {
                if (!/^\d{0,6}$/.test(event.target.value)) return;
                setStock(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2.5 text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-[#070d16] accent-amber-500"
              checked={favorite}
              onChange={(event) => setFavorite(event.target.checked)}
            />
            <Star className="h-3.5 w-3.5 text-amber-400" />
            Marcar como favorito
          </label>
          {product ? (
            <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2.5 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-700 bg-[#070d16] accent-emerald-500"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Producto activo
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-slate-500">
            El stock se descuenta automáticamente al agregar productos a una mesa o al vender en
            barra. Los productos favoritos aparecen primero.
          </p>
        )}
      </form>
    </Modal>
  );
};

interface UserFormModalProps {
  open: boolean;
  editingUser: User | null;
  currentUser: User | null;
  onClose: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  editingUser,
  currentUser,
  onClose,
}) => {
  const { runAction } = useApp();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editingUser?.name || '');
      setRole(editingUser?.role || 'cashier');
      setPin('');
      setActive(editingUser?.active ?? true);
      setBusy(false);
      setError(null);
    }
  }, [editingUser, open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (name.trim().length < 2) return setError('El nombre del usuario es obligatorio.');
    if (!editingUser) {
      if (!/^\d{4,6}$/.test(pin)) return setError('El PIN debe tener entre 4 y 6 dígitos.');
    }

    setBusy(true);
    try {
      const response = editingUser
        ? await runAction(() =>
            api.updateUser(editingUser.id, { name: name.trim(), role, active })
          )
        : await runAction(() =>
            api.createUser({ name: name.trim(), role, pin })
          );
      if (response) onClose();
    } finally {
      setBusy(false);
    }
  };

  const isSelf = Boolean(editingUser && currentUser && editingUser.id === currentUser.id);

  return (
    <Modal
      open={open}
      title={editingUser ? `Editar ${editingUser.name}` : 'Nuevo usuario'}
      subtitle={
        editingUser
          ? 'Puedes cambiar nombre, rol y estado.'
          : 'Se creará con un PIN temporal que deberá cambiarse al entrar.'
      }
      icon={<UserRoundPlus className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="user-form" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </>
      }
    >
      <form id="user-form" className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="user-name">
            Nombre completo
          </label>
          <input
            id="user-name"
            className="input"
            maxLength={60}
            autoFocus
            value={name}
            placeholder="Ej. Juan Pérez"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <p className="label">Rol</p>
          <div className="grid grid-cols-2 gap-2">
            {(['cashier', 'admin'] as Role[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left transition',
                  role === item
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-[#08111d] text-slate-400 hover:border-slate-700'
                )}
              >
                <p className="text-[11px] font-bold">{roleLabel(item)}</p>
                <p className="mt-0.5 text-[9px] leading-snug text-slate-500">
                  {item === 'admin' ? 'Todo: caja, ajustes, anulaciones y auditoría.' : 'Opera mesas, barra y cierre de caja.'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {!editingUser ? (
          <div>
            <label className="label" htmlFor="user-pin">
              PIN temporal
            </label>
            <input
              id="user-pin"
              className="input num tracking-[0.3em]"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pin}
              placeholder="4 a 6 dígitos"
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              No puede repetirse con otro usuario. Se pedirá cambiarlo al ingresar.
            </p>
          </div>
        ) : (
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#08111d] px-3 py-2.5 text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-[#070d16] accent-emerald-500"
              checked={active}
              disabled={isSelf}
              onChange={(event) => setActive(event.target.checked)}
            />
            Usuario activo
            {isSelf ? (
              <span className="ml-auto text-[9px] text-slate-500">No puedes desactivarte</span>
            ) : null}
          </label>
        )}

        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[10px] leading-relaxed text-amber-200/80">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>El sistema exige al menos un administrador activo en todo momento.</span>
          </div>
        )}
      </form>
    </Modal>
  );
};

interface ResetPinModalProps {
  open: boolean;
  target: User | null;
  onClose: () => void;
}

const ResetPinModal: React.FC<ResetPinModalProps> = ({ open, target, onClose }) => {
  const { runAction } = useApp();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || busy) return;
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) return setError('El PIN debe tener entre 4 y 6 dígitos.');
    setBusy(true);
    try {
      const response = await runAction(() => api.resetUserPin(target.id, pin));
      if (response) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Asignar PIN temporal a ${target?.name || 'usuario'}`}
      subtitle="La sesión de ese usuario se cerrará de inmediato."
      icon={<KeyRound className="h-4 w-4" />}
      onClose={busy ? undefined : onClose}
      disableClose={busy}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form="reset-pin-form" className="btn-primary" disabled={busy}>
            {busy ? 'Asignando…' : 'Asignar PIN'}
          </button>
        </>
      }
    >
      <form id="reset-pin-form" className="space-y-3" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="reset-pin">
            PIN temporal
          </label>
          <input
            id="reset-pin"
            className="input num text-base tracking-[0.3em]"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            autoFocus
            value={pin}
            placeholder="4 a 6 dígitos"
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-300">
            {error}
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-slate-500">
            Comunícalo en privado. En su próximo ingreso el sistema le pedirá crear un PIN nuevo.
          </p>
        )}
      </form>
    </Modal>
  );
};
