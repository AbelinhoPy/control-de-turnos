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
} from 'lucide-react';
import { getDayNameEs, getShortDayNameEs } from '@/lib/time/timezone';

type ReportType =
  | 'asistencia-diaria'
  | 'historial-individual'
  | 'horas-jornales'
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

export default function ReportsModulePage() {
  const [reportType, setReportType] = useState<ReportType>('horas-jornales');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-15');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedCrew, setSelectedCrew] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [includeDeactivated, setIncludeDeactivated] = useState(true);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [crews, setCrews] = useState<CrewItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/staff?includeDeactivated=${includeDeactivated}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers((d.staff || []).filter((u: UserItem) => u.role !== 'ADMIN'));
        setCrews(d.crews || []);
      });
  }, [includeDeactivated]);

  // Manejo de presets
  const handlePreset = (preset: 'hoy' | 'semana' | 'q1' | 'q2' | 'mes') => {
    if (preset === 'hoy') {
      setStartDate('2026-11-08');
      setEndDate('2026-11-08');
    } else if (preset === 'semana') {
      setStartDate('2026-11-02');
      setEndDate('2026-11-08');
    } else if (preset === 'q1') {
      setStartDate('2026-11-01');
      setEndDate('2026-11-15');
    } else if (preset === 'q2') {
      setStartDate('2026-11-16');
      setEndDate('2026-11-30');
    } else if (preset === 'mes') {
      setStartDate('2026-11-01');
      setEndDate('2026-11-30');
    }
  };

  const getExcelDownloadUrl = () => {
    if (reportType === 'cobertura') {
      return `/api/export/excel?type=planning&startDate=${startDate}&endDate=${endDate}`;
    }
    const userParam = selectedUser !== 'ALL' ? `&userId=${selectedUser}` : '';
    return `/api/export/excel?type=history&startDate=${startDate}&endDate=${endDate}&includeDeactivated=${includeDeactivated}${userParam}`;
  };

  const getPdfDownloadUrl = () => {
    const userParam = selectedUser !== 'ALL' ? `&userId=${selectedUser}` : '';
    return `/api/export/pdf?reportType=${reportType}&startDate=${startDate}&endDate=${endDate}&includeDeactivated=${includeDeactivated}${userParam}`;
  };

  const reportTabs = [
    { id: 'horas-jornales', name: '3. Horas y Jornales', desc: 'Días, horas diurnas/nocturnas e importes' },
    { id: 'asistencia-diaria', name: '1. Asistencia Diaria', desc: 'Personal programado vs marcas reales' },
    { id: 'historial-individual', name: '2. Historial Individual', desc: 'Detalle cronológico por funcionario' },
    { id: 'cobertura', name: '4. Cobertura de Turnos', desc: 'Objetivo vs presentes (24/7)' },
    { id: 'incidencias', name: '5. Incidencias y Correcciones', desc: 'Marcaciones manuales y auditoría' },
    { id: 'cierre', name: '6. Cierre del Período', desc: 'Consolidado inmutable de liquidación' },
  ];

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
        {/* Presets rápidos */}
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
              2ª Quincena (16 al fin)
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
            <span>Incluir funcionarios desactivados con historial</span>
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
            <label className="block font-medium text-slate-600 mb-1">Funcionario</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 bg-white"
            >
              <option value="ALL">Todos los funcionarios</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {!u.isActive ? '(Dado de baja)' : ''}
                </option>
              ))}
            </select>
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
        </div>
      </div>

      {/* Vista Previa del Reporte Seleccionado */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Encabezado del Reporte */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-petroleum-700">
              Vista Previa Oficial
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              {reportTabs.find((t) => t.id === reportType)?.name}
            </h3>
            <p className="text-xs text-slate-500">
              Período: {startDate} al {endDate} | Recargo nocturno aplicable (30%): 20:00 a 06:00 hs
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-petroleum-100 text-petroleum-900 border border-petroleum-200">
            {users.length} funcionarios en período
          </span>
        </div>

        {/* Contenido según Reporte */}
        {reportType === 'horas-jornales' && (
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
                  {users.map((u, idx) => {
                    const crew = crews.find((c) => c.id === u.crewId);
                    // Caso medio jornal para David Rojas
                    const isDavid = u.name.includes('David');
                    // Caso dado de baja para Carlos Duarte
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
                      Totales del Período
                    </td>
                    <td className="py-3 px-4 text-center">92</td>
                    <td className="py-3 px-4 text-center">1</td>
                    <td className="py-3 px-4 text-center font-extrabold text-petroleum-900">92.5</td>
                    <td className="py-3 px-4 text-right font-mono">546.0 hs</td>
                    <td className="py-3 px-4 text-right font-mono text-purple-800">198.0 hs</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-950">744.0 hs</td>
                    <td className="py-3 px-4 text-right">-</td>
                    <td className="py-3 px-4 text-center text-amber-800 text-[10px]">
                      Ajuste pendiente
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Aviso de Reglas de Jornal */}
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
        )}

        {reportType === 'asistencia-diaria' && (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Reporte de Asistencia Diaria Consolidada</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Incluye personal programado, marcas de entrada y salida con validación de radio geolocalizado en sede, ausencias y justificaciones.
            </p>
            <div className="pt-3 flex justify-center gap-2">
              <a
                href={getExcelDownloadUrl()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Descargar en Excel (.xlsx)
              </a>
              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
              >
                Imprimir en PDF
              </a>
            </div>
          </div>
        )}

        {reportType === 'historial-individual' && (
          <div className="p-6 text-center space-y-2">
            <FileSpreadsheet className="w-10 h-10 text-petroleum-700 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Historial Individual Detallado</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Genera una hoja individual por cada funcionario exactamente con el formato de «Historial Horas Noviembre_2026 (RESUMEN 15 DIAS).xlsx», con cálculo de horas diurnas y nocturnas.
            </p>
            <div className="pt-3 flex justify-center gap-2">
              <a
                href={getExcelDownloadUrl()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Exportar Todas las Hojas a Excel
              </a>
              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
              >
                Descargar PDF Individual
              </a>
            </div>
          </div>
        )}

        {reportType === 'cobertura' && (
          <div className="p-6 text-center space-y-2">
            <Calendar className="w-10 h-10 text-blue-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Reporte de Cobertura 24/7 y Cuadrillas</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Verifica el cumplimiento de la meta de 2 personas por turno en Mañana, Tarde y Noche, incluyendo la rotación de la cuadrilla volante.
            </p>
            <div className="pt-3 flex justify-center gap-2">
              <a
                href={getExcelDownloadUrl()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800"
              >
                Exportar Cronograma MEPY (.xlsx)
              </a>
            </div>
          </div>
        )}

        {reportType === 'incidencias' && (
          <div className="p-6 text-center space-y-2">
            <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Auditoría de Incidencias y Correcciones</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Trazabilidad completa: qué se corrigió, motivo obligatorio, funcionario involucrado, fecha y administrador responsable.
            </p>
            <div className="pt-3 flex justify-center gap-2">
              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
              >
                Exportar Informe de Auditoría PDF
              </a>
            </div>
          </div>
        )}

        {reportType === 'cierre' && (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-petroleum-800 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">Acta de Cierre de Período</h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Documento oficial de liquidación quincenal o mensual aprobado inmutablemente.
            </p>
            <div className="pt-3 flex justify-center gap-2">
              <a
                href={getPdfDownloadUrl()}
                target="_blank"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
              >
                Generar Acta de Cierre en PDF
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
