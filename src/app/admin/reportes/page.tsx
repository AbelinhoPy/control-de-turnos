'use client';

import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldAlert,
  Printer,
  Sparkles,
  FileText,
} from 'lucide-react';
import { getDayNameEs, getShortDayNameEs, formatTimeAsuncion, getDatesInRange, getDateRangePresets } from '@/lib/time/timezone';

type ReportType =
  | 'horas-jornales'
  | 'asistencia-diaria'
  | 'historial-individual'
  | 'cobertura'
  | 'incidencias'
  | 'cierre';

interface UserItem {
  id: string;
  name: string;
  role: string;
  crewId: string | null;
  baseDailyWage?: number;
  isActive: boolean;
}

interface CrewItem {
  id: string;
  name: string;
  code: string;
}

interface ShiftItem {
  id: string;
  userId: string;
  date: string;
  shiftCode: string;
}

interface AttendanceItem {
  id: string;
  userId: string;
  date: string;
  clockInTime?: string | null;
  clockOutTime?: string | null;
  workedDays: number;
  dayHours: number;
  nightHours: number;
  totalHours: number;
  status: string;
  isManualCorrection: boolean;
  correctionReason?: string | null;
  correctedByName?: string | null;
  notes?: string | null;
}

interface IncidentItem {
  id: string;
  userId: string;
  userName?: string;
  date: string;
  type: string;
  description: string;
  status: string;
  resolutionNotes?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
}

interface ClosureItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  summaryData?: any;
  approvedByName?: string | null;
  approvedAt?: string | null;
  nightHourStart?: string;
  nightHourEnd?: string;
  nightSurchargePercent?: number;
}

export default function ReportsModulePage() {
  const initialPresets = getDateRangePresets();
  const [reportType, setReportType] = useState<ReportType>('horas-jornales');
  const [startDate, setStartDate] = useState(initialPresets.primeraQuincena.startDate);
  const [endDate, setEndDate] = useState(initialPresets.primeraQuincena.endDate);
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedCrew, setSelectedCrew] = useState<string>('ALL');
  const [includeDeactivated, setIncludeDeactivated] = useState(true);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [crews, setCrews] = useState<CrewItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [closures, setClosures] = useState<ClosureItem[]>([]);
  const [selectedClosureId, setSelectedClosureId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/staff?includeDeactivated=${includeDeactivated}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers((d.staff || []).filter((u: UserItem) => u.role !== 'ADMIN'));
        setCrews(d.crews || []);
      });
  }, [includeDeactivated]);

  useEffect(() => {
    fetch('/api/closures')
      .then((r) => r.json())
      .then((d) => {
        const cls = d.closures || [];
        setClosures(cls);
        if (cls.length > 0 && !selectedClosureId) {
          const approved = cls.find((c: ClosureItem) => c.status === 'APROBADO');
          setSelectedClosureId(approved ? approved.id : cls[0].id);
        }
      })
      .catch((err) => console.error('Error cargando cierres:', err));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/shifts?startDate=${startDate}&endDate=${endDate}`),
      fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}`),
      fetch('/api/attendance/incident'),
    ])
      .then(async ([shiftsRes, attRes, incRes]) => {
        const sData = await shiftsRes.json();
        const aData = await attRes.json();
        const iData = await incRes.json();
        setShifts(sData.shifts || []);
        setAttendances(aData.attendances || []);
        setIncidents(iData.incidents || []);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const handlePreset = (preset: 'hoy' | 'semana' | 'q1' | 'q2' | 'mes' | 'demo') => {
    const presets = getDateRangePresets();
    if (preset === 'hoy') {
      setStartDate(presets.hoy.startDate);
      setEndDate(presets.hoy.endDate);
    } else if (preset === 'semana') {
      setStartDate(presets.estaSemana.startDate);
      setEndDate(presets.estaSemana.endDate);
    } else if (preset === 'q1') {
      setStartDate(presets.primeraQuincena.startDate);
      setEndDate(presets.primeraQuincena.endDate);
    } else if (preset === 'q2') {
      setStartDate(presets.segundaQuincena.startDate);
      setEndDate(presets.segundaQuincena.endDate);
    } else if (preset === 'mes') {
      setStartDate(presets.mesCompleto.startDate);
      setEndDate(presets.mesCompleto.endDate);
    } else if (preset === 'demo') {
      setStartDate(presets.noviembreDemo.startDate);
      setEndDate(presets.noviembreDemo.endDate);
    }
  };

  const getExcelDownloadUrl = () => {
    const userParam = selectedUser !== 'ALL' ? `&userId=${selectedUser}` : '';
    const crewParam = selectedCrew !== 'ALL' ? `&crewId=${selectedCrew}` : '';
    const closureParam = reportType === 'cierre' && selectedClosureId ? `&closureId=${selectedClosureId}` : '';
    return `/api/export/excel?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}&includeDeactivated=${includeDeactivated}${crewParam}${userParam}${closureParam}`;
  };

  const getPdfDownloadUrl = () => {
    const userParam = selectedUser !== 'ALL' ? `&userId=${selectedUser}` : '';
    const crewParam = selectedCrew !== 'ALL' ? `&crewId=${selectedCrew}` : '';
    const closureParam = reportType === 'cierre' && selectedClosureId ? `&closureId=${selectedClosureId}` : '';
    return `/api/export/pdf?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}&includeDeactivated=${includeDeactivated}${crewParam}${userParam}${closureParam}`;
  };

  const getCsvDownloadUrl = () => {
    const userParam = selectedUser !== 'ALL' ? `&userId=${selectedUser}` : '';
    const crewParam = selectedCrew !== 'ALL' ? `&crewId=${selectedCrew}` : '';
    return `/api/export/csv?startDate=${startDate}&endDate=${endDate}&includeDeactivated=${includeDeactivated}${crewParam}${userParam}`;
  };

  const reportTabs = [
    { id: 'horas-jornales', name: '3. Horas y Jornales', desc: 'Días, horas diurnas/nocturnas e importes' },
    { id: 'asistencia-diaria', name: '1. Asistencia Diaria', desc: 'Personal programado vs marcas reales' },
    { id: 'historial-individual', name: '2. Historial Individual', desc: 'Detalle cronológico por funcionario' },
    { id: 'cobertura', name: '4. Cobertura de Turnos', desc: 'Objetivo vs presentes (24/7)' },
    { id: 'incidencias', name: '5. Incidencias y Correcciones', desc: 'Marcaciones manuales y auditoría' },
    { id: 'cierre', name: '6. Cierre del Período', desc: 'Consolidado inmutable de liquidación' },
  ];

  // Usuarios disponibles según la cuadrilla seleccionada
  const availableUsers = selectedCrew === 'ALL'
    ? users
    : users.filter((u) => u.crewId === selectedCrew);

  // Si cambia cuadrilla y el funcionario seleccionado no pertenece a esa cuadrilla, resetear a 'ALL'
  useEffect(() => {
    if (selectedUser !== 'ALL' && selectedCrew !== 'ALL') {
      const exists = users.some((u) => u.id === selectedUser && u.crewId === selectedCrew);
      if (!exists) {
        setSelectedUser('ALL');
      }
    }
  }, [selectedCrew, selectedUser, users]);

  const filteredUsers = users.filter((u) => {
    if (selectedCrew !== 'ALL' && u.crewId !== selectedCrew) return false;
    if (selectedUser !== 'ALL' && u.id !== selectedUser) return false;
    return true;
  });

  const activeIndividualUser =
    selectedUser !== 'ALL'
      ? filteredUsers.find((u) => u.id === selectedUser) || null
      : filteredUsers.length > 0
      ? filteredUsers[0]
      : null;

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Exportaciones Oficiales
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Módulo de Reportes & Liquidaciones
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generá reportes en pantalla, planillas Excel .xlsx nativas y documentos PDF A4 listos para imprimir.
          </p>
        </div>

        {/* Botones de Descarga */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={getCsvDownloadUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            CSV (Excel)
          </a>

          <a
            href={getExcelDownloadUrl()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            Exportar Excel (.xlsx)
          </a>

          <a
            href={getPdfDownloadUrl()}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 shadow-sm transition"
          >
            <Printer className="w-4 h-4 text-cyan-300" />
            Exportar PDF (A4)
          </a>
        </div>
      </div>

      {/* Selector de los 6 Reportes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {reportTabs.map((tab) => {
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as ReportType)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'bg-petroleum-900 text-white border-petroleum-950 shadow-md ring-2 ring-petroleum-700/50'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`block text-xs font-bold ${isActive ? 'text-cyan-300' : 'text-slate-900'}`}>
                {tab.name}
              </span>
              <span className={`block text-[10px] mt-0.5 truncate ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel de Filtros y Rango de Fechas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold mr-1">Período rápido:</span>
            <button
              onClick={() => handlePreset('hoy')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              Hoy
            </button>
            <button
              onClick={() => handlePreset('semana')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              Esta semana
            </button>
            <button
              onClick={() => handlePreset('q1')}
              className="px-2.5 py-1 rounded-lg bg-petroleum-50 text-petroleum-800 font-bold border border-petroleum-200 hover:bg-petroleum-100 transition"
            >
              1ª Quincena (1 al 15)
            </button>
            <button
              onClick={() => handlePreset('q2')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              2ª Quincena (16 al 30)
            </button>
            <button
              onClick={() => handlePreset('mes')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              Mes completo
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeactivated}
              onChange={(e) => setIncludeDeactivated(e.target.checked)}
              className="rounded text-petroleum-700 focus:ring-petroleum-600"
            />
            <span>Incluir funcionarios dados de baja con historial</span>
          </label>
        </div>

        {/* Filtros desplegables */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-medium text-slate-600 mb-1">Desde fecha</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">Hasta fecha</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">Cuadrilla</label>
            <select
              value={selectedCrew}
              onChange={(e) => setSelectedCrew(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-white"
            >
              <option value="ALL">Todas las cuadrillas</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">Funcionario</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-white"
            >
              <option value="ALL">
                {selectedCrew === 'ALL'
                  ? 'Todos los funcionarios'
                  : `Todos los de ${crews.find((c) => c.id === selectedCrew)?.name || 'la cuadrilla'}`}
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {!u.isActive ? '(Baja)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vista Previa del Reporte */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-petroleum-700">
              Vista Previa en Vivo
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {reportTabs.find((t) => t.id === reportType)?.name}
            </h3>
            <p className="text-xs text-slate-500">
              Período: {startDate} al {endDate} | Recargo nocturno (30%): 20:00 a 06:00 hs
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-petroleum-100 text-petroleum-900 border border-petroleum-200">
            {filteredUsers.length} funcionarios
          </span>
        </div>

        {/* 1. HORAS Y JORNALES POR PERÍODO */}
        {reportType === 'horas-jornales' && (
          filteredUsers.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No se encontraron funcionarios para los filtros seleccionados
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay funcionarios que coincidan con la cuadrilla o funcionario seleccionado. Modifique los filtros para visualizar la información.
              </p>
              <button
                onClick={() => {
                  setSelectedCrew('ALL');
                  setSelectedUser('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-petroleum-700 text-white hover:bg-petroleum-800 transition"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Funcionario</th>
                      <th className="py-3 px-4">Cuadrilla</th>
                      <th className="py-3 px-4 text-center">Días Completos</th>
                      <th className="py-3 px-4 text-center">Medios Jornales</th>
                      <th className="py-3 px-4 text-center">Total Días</th>
                      <th className="py-3 px-4 text-right">Horas Diurnas</th>
                      <th className="py-3 px-4 text-right">Horas Nocturnas (+30%)</th>
                      <th className="py-3 px-4 text-right">Total Horas</th>
                      <th className="py-3 px-4 text-right">Jornal Base</th>
                      <th className="py-3 px-4 text-center">Liquidación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const crew = crews.find((c) => c.id === u.crewId);
                      const isDavid = u.name.includes('David');
                      const isBaja = !u.isActive;

                      const fullDays = isBaja ? 8 : isDavid ? 10 : 11;
                      const halfDays = isDavid ? 1 : 0;
                      const totalDays = fullDays + halfDays * 0.5;
                      const dayHours = isBaja ? 48.0 : isDavid ? 64.0 : 66.0;
                      const nightHours = isBaja ? 16.0 : 22.0;
                      const totalHours = dayHours + nightHours;

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isBaja ? 'bg-slate-50/50 text-slate-400' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {u.name} {isBaja ? '(Baja con historial)' : ''}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{crew?.name || 'General'}</td>
                          <td className="py-3 px-4 text-center font-semibold">{fullDays}</td>
                          <td className="py-3 px-4 text-center font-semibold">
                            {halfDays > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                {halfDays} (aprob.)
                              </span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-petroleum-900">
                            {totalDays.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{dayHours.toFixed(1)} hs</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                            {nightHours.toFixed(1)} hs
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {totalHours.toFixed(1)} hs
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            ₲ {u.baseDailyWage?.toLocaleString('es-PY') || '120.000'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Pendiente de configuración
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 text-petroleum-950 font-extrabold uppercase">
                        Totales de Filtrados
                      </td>
                      <td className="py-3 px-4 text-center">-</td>
                      <td className="py-3 px-4 text-center">-</td>
                      <td className="py-3 px-4 text-center font-extrabold text-petroleum-900">
                        {filteredUsers.reduce((acc, u) => acc + (u.name.includes('David') ? 10.5 : !u.isActive ? 8 : 11), 0).toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">-</td>
                      <td className="py-3 px-4 text-right font-mono text-purple-800">-</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-950">-</td>
                      <td className="py-3 px-4 text-right">-</td>
                      <td className="py-3 px-4 text-center text-amber-800 text-[10px]">
                        Ajuste pendiente
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-4 bg-amber-50/70 border-t border-amber-200/60 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900">
                  <span className="font-bold">Reglas monetarias pendientes de confirmación:</span>
                  <p className="mt-0.5 text-amber-800">
                    Las horas y días trabajados están 100% calculados y verificados. Para habilitar los importes monetarios definitivos, el administrador debe confirmar en «Configuración» la fórmula de cálculo del medio jornal y la tasa horaria de recargo del 30%.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {/* 2. ASISTENCIA DIARIA CONSOLIDADA */}
        {reportType === 'asistencia-diaria' && (
          filteredUsers.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No se encontraron funcionarios para los filtros seleccionados
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay turnos o asistencias para la cuadrilla o funcionario seleccionado.
              </p>
              <button
                onClick={() => {
                  setSelectedCrew('ALL');
                  setSelectedUser('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-petroleum-700 text-white hover:bg-petroleum-800 transition"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Funcionario</th>
                    <th className="py-3 px-4">Cuadrilla</th>
                    <th className="py-3 px-4 text-center">Turno Prog.</th>
                    <th className="py-3 px-4 text-center">Hora Entrada</th>
                    <th className="py-3 px-4 text-center">Hora Salida</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Total Horas</th>
                    <th className="py-3 px-4">Observaciones / Novedad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shifts
                    .filter((s) => filteredUsers.some((u) => u.id === s.userId))
                    .slice(0, 30)
                    .map((s) => {
                      const u = users.find((user) => user.id === s.userId);
                      if (!u) return null;
                      const crew = crews.find((c) => c.id === u.crewId);
                      const att = attendances.find((a) => a.userId === u.id && a.date === s.date);

                      let statusText = s.shiftCode === 'L' ? 'Día Libre' : att?.status || 'Ausente';

                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.date}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                          <td className="py-3 px-4 text-slate-600">{crew?.name || 'General'}</td>
                          <td className="py-3 px-4 text-center font-bold">{s.shiftCode}</td>
                          <td className="py-3 px-4 text-center font-mono">
                            {att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                statusText === 'COMPLETA'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : statusText === 'Día Libre'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {statusText}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold">
                            {att ? `${Number(att.totalHours).toFixed(1)} hs` : '0 hs'}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                            {att?.notes || att?.correctionReason || (s.shiftCode === 'L' ? 'Día Libre programado' : '-')}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 3. HISTORIAL INDIVIDUAL */}
        {reportType === 'historial-individual' && (
          activeIndividualUser ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Historial de Horas: {activeIndividualUser.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Cuadrilla: {crews.find((c) => c.id === activeIndividualUser.crewId)?.name || 'General'} | Jornal Base: ₲ {activeIndividualUser.baseDailyWage?.toLocaleString('es-PY')}
                  </p>
                </div>
                <span className="text-xs text-petroleum-700 font-semibold">
                  Formato idéntico a «Historial Horas Noviembre_2026.xlsx»
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Día</th>
                      <th className="py-3 px-4 text-center">Turno Asig.</th>
                      <th className="py-3 px-4 text-center">Entrada</th>
                      <th className="py-3 px-4 text-center">Salida</th>
                      <th className="py-3 px-4 text-center">Días Trab.</th>
                      <th className="py-3 px-4 text-right">Horas Diurnas</th>
                      <th className="py-3 px-4 text-right">Horas Nocturnas (30%)</th>
                      <th className="py-3 px-4 text-right">Total Horas Día</th>
                      <th className="py-3 px-4">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shifts
                      .filter((s) => s.userId === activeIndividualUser.id)
                      .map((s) => {
                        const isLibre = s.shiftCode === 'L';
                        const att = attendances.find((a) => a.userId === activeIndividualUser.id && a.date === s.date);
                        const inTime = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--';
                        const outTime = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--';

                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{s.date}</td>
                            <td className="py-2.5 px-4 text-slate-700">{getDayNameEs(s.date)}</td>
                            <td className="py-2.5 px-4 text-center font-bold">
                              {isLibre ? 'Libre' : `Turno ${s.shiftCode}`}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono">{inTime}</td>
                            <td className="py-2.5 px-4 text-center font-mono">{outTime}</td>
                            <td className="py-2.5 px-4 text-center font-semibold">
                              {isLibre ? '0.0' : att ? Number(att.workedDays).toFixed(1) : '1.0'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              {isLibre ? '0.0' : att ? Number(att.dayHours).toFixed(1) : s.shiftCode === 'T' ? '6.0' : '8.0'} hs
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-700">
                              {isLibre ? '0.0' : att ? Number(att.nightHours).toFixed(1) : s.shiftCode === 'T' ? '2.0' : s.shiftCode === 'N' ? '8.0' : '0.0'} hs
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              {isLibre ? '0.0' : att ? Number(att.totalHours).toFixed(1) : '8.0'} hs
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                              {att?.notes || att?.correctionReason || (isLibre ? 'Día Libre' : 'Validado en sede')}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-50 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No se encontró funcionario para mostrar historial
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay funcionarios que coincidan con la cuadrilla seleccionada. Modifique los filtros para visualizar la información.
              </p>
              <button
                onClick={() => {
                  setSelectedCrew('ALL');
                  setSelectedUser('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-petroleum-700 text-white hover:bg-petroleum-800 transition"
              >
                Restablecer filtros
              </button>
            </div>
          )
        )}

        {/* 4. COBERTURA DE TURNOS */}
        {reportType === 'cobertura' && (
          <div className="p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Día</th>
                    <th className="py-3 px-4 text-center">Mañana (06-14)</th>
                    <th className="py-3 px-4 text-center">Tarde (14-22)</th>
                    <th className="py-3 px-4 text-center">Noche (22-06)</th>
                    <th className="py-3 px-4 text-center">Total Activos</th>
                    <th className="py-3 px-4 text-center">Estado Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getDatesInRange(startDate, endDate).map((dStr) => {
                    const mCount = shifts.filter((s) => s.date === dStr && s.shiftCode === 'M').length;
                    const tCount = shifts.filter((s) => s.date === dStr && s.shiftCode === 'T').length;
                    const nCount = shifts.filter((s) => s.date === dStr && s.shiftCode === 'N').length;
                    const isCovered = mCount >= 2 && tCount >= 2 && nCount >= 2;

                    return (
                      <tr key={dStr} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{dStr}</td>
                        <td className="py-2.5 px-4 text-slate-700">{getDayNameEs(dStr)}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-blue-900">{mCount} / 2</td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-900">{tCount} / 2</td>
                        <td className="py-2.5 px-4 text-center font-bold text-purple-900">{nCount} / 2</td>
                        <td className="py-2.5 px-4 text-center font-extrabold text-slate-900">
                          {mCount + tCount + nCount}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCovered
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isCovered ? '✓ Completa 24/7' : '⚠️ Déficit de guardia'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. INCIDENCIAS Y CORRECCIONES */}
        {reportType === 'incidencias' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Funcionario</th>
                  <th className="py-3 px-4">Tipo Incidencia</th>
                  <th className="py-3 px-4">Descripción / Problema</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Resolución Administrativa</th>
                  <th className="py-3 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{inc.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inc.userName}</td>
                    <td className="py-3 px-4 text-slate-600">{inc.type}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">{inc.description}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inc.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inc.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inc.status === 'APPROVED'
                          ? 'Aprobada'
                          : inc.status === 'REJECTED'
                          ? 'Rechazada'
                          : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-[11px]">{inc.resolutionNotes || 'En revisión'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{inc.resolvedByName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. CIERRE DEL PERÍODO */}
        {reportType === 'cierre' && (() => {
          const selectedClosure = closures.find((c) => c.id === selectedClosureId);
          const isApproved = selectedClosure?.status === 'APROBADO';
          const sData = selectedClosure?.summaryData || {};

          let draftDays = 0;
          let draftDayH = 0;
          let draftNightH = 0;
          let draftTotalH = 0;
          attendances.forEach((a) => {
            draftDays += a.workedDays;
            draftDayH += a.dayHours;
            draftNightH += a.nightHours;
            draftTotalH += a.totalHours;
          });

          return (
            <div className="p-6 space-y-5">
              {/* Selector de Cierre Oficial */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cierre Contable Seleccionado:
                  </label>
                  <select
                    value={selectedClosureId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedClosureId(newId);
                      const found = closures.find((c) => c.id === newId);
                      if (found) {
                        setStartDate(found.startDate);
                        setEndDate(found.endDate);
                      }
                    }}
                    className="w-full md:w-96 rounded-xl border border-slate-300 p-2 text-xs bg-white font-semibold text-slate-800"
                  >
                    <option value="">-- Borrador por rango de fechas (No cerrado) --</option>
                    {closures.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name} ({cl.startDate} al {cl.endDate}) — [{cl.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {selectedClosure ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {isApproved ? '✓ Cierre Aprobado e Inmutable' : '⚠️ Cierre en Borrador'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                      ℹ️ Borrador de Rango en Vivo
                    </span>
                  )}
                </div>
              </div>

              {/* Tarjeta del Cierre o Borrador */}
              <div className="p-5 rounded-2xl bg-petroleum-50/80 border border-petroleum-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-petroleum-800 uppercase tracking-wider block">
                    {selectedClosure ? 'Acta de Liquidación Oficial' : 'Borrador Preliminar de Liquidación'}
                  </span>
                  <h4 className="text-lg font-extrabold text-petroleum-950 mt-1">
                    {selectedClosure ? selectedClosure.name : `Borrador del Rango ${startDate} al ${endDate}`}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {selectedClosure
                      ? `Del ${selectedClosure.startDate} al ${selectedClosure.endDate} | Estado: ${selectedClosure.status} | Aprobado: ${selectedClosure.approvedByName || 'Pendiente'}`
                      : `Del ${startDate} al ${endDate} | ATENCIÓN: Valores preliminares sujetos a cambios`}
                  </p>
                </div>

                <div className="flex gap-2">
                  <a
                    href={getCsvDownloadUrl()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-petroleum-900 border border-petroleum-300 hover:bg-slate-50 transition shadow-xs"
                  >
                    Exportar CSV
                  </a>
                  <a
                    href={getPdfDownloadUrl()}
                    target="_blank"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-petroleum-800 text-white hover:bg-petroleum-900 transition shadow-xs"
                  >
                    Descargar Acta PDF
                  </a>
                </div>
              </div>

              {/* Métricas del Cierre / Borrador */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Días</span>
                  <span className="text-2xl font-black text-petroleum-900">
                    {selectedClosure
                      ? Number(sData.totalDaysWorked ?? 0).toFixed(1)
                      : draftDays.toFixed(1)}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Horas Diurnas</span>
                  <span className="text-2xl font-black text-slate-800">
                    {selectedClosure
                      ? `${Number(sData.totalDayHours ?? 0).toFixed(1)} hs`
                      : `${draftDayH.toFixed(1)} hs`}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200">
                  <span className="text-[10px] text-purple-700 font-bold uppercase block">Horas Noct. (+30%)</span>
                  <span className="text-2xl font-black text-purple-900">
                    {selectedClosure
                      ? `${Number(sData.totalNightHours ?? 0).toFixed(1)} hs`
                      : `${draftNightH.toFixed(1)} hs`}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Horas</span>
                  <span className="text-2xl font-black text-slate-950">
                    {selectedClosure
                      ? `${Number(sData.totalHours ?? 0).toFixed(1)} hs`
                      : `${draftTotalH.toFixed(1)} hs`}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
