'use client';

import { useState, useEffect } from 'react';
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface PeriodClosure {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'BORRADOR' | 'APROBADO';
  approvedAt?: string | null;
  approvedByName?: string | null;
  summaryData: {
    totalEmployees: number;
    totalDaysWorked: number;
    totalHalfDays: number;
    totalDayHours: number;
    totalNightHours: number;
    totalHours: number;
    payrollStatus: string;
  };
}

export default function PeriodClosuresPage() {
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('2ª Quincena Noviembre 2026');
  const [newStartDate, setNewStartDate] = useState('2026-11-16');
  const [newEndDate, setNewEndDate] = useState('2026-11-30');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadClosures = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/closures');
      const data = await res.json();
      setClosures(data.closures || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosures();
  }, []);

  const handleApprove = async (closureId: string) => {
    if (
      !confirm(
        '¿Confirmás la aprobación definitiva de este cierre? Una vez aprobado, los totales, reglas aplicadas y registros de jornadas quedarán congelados de forma inmutable para liquidación.'
      )
    ) {
      return;
    }

    setApprovingId(closureId);
    try {
      const res = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', closureId }),
      });
      if (res.ok) {
        loadClosures();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingId(null);
    }
  };

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          name: newName,
          startDate: newStartDate,
          endDate: newEndDate,
        }),
      });
      if (res.ok) {
        setIsNewModalOpen(false);
        loadClosures();
      }
    } catch {
      alert('Error creando cierre');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Liquidación y Auditoría
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Cierres de Período y Quincenas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consolidá días y horas por período. Al aprobar un cierre, se genera una fotografía inmutable de los datos y las reglas vigentes.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 shadow-sm transition"
        >
          <Lock className="w-4 h-4 text-cyan-300" />
          Generar Nuevo Cierre
        </button>
      </div>

      {/* Listado de Cierres */}
      <div className="space-y-4">
        {closures.map((closure) => {
          const isApproved = closure.status === 'APROBADO';

          return (
            <div
              key={closure.id}
              className={`p-6 rounded-2xl border bg-white shadow-sm transition-all ${
                isApproved ? 'border-emerald-200 ring-1 ring-emerald-500/20' : 'border-amber-200/80'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isApproved
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isApproved ? <ShieldCheck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{closure.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {closure.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Período del {closure.startDate} al {closure.endDate}
                      {closure.approvedByName && ` • Aprobado por ${closure.approvedByName}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/api/export/csv?startDate=${closure.startDate}&endDate=${closure.endDate}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV (Excel)
                  </a>

                  <a
                    href={`/api/export/excel?type=history&startDate=${closure.startDate}&endDate=${closure.endDate}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel (.xlsx)
                  </a>

                  <a
                    href={`/api/export/pdf?reportType=cierre&startDate=${closure.startDate}&endDate=${closure.endDate}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-petroleum-50 text-petroleum-800 border border-petroleum-200 hover:bg-petroleum-100 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Acta PDF
                  </a>

                  {!isApproved && (
                    <button
                      onClick={() => handleApprove(closure.id)}
                      disabled={approvingId === closure.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {approvingId === closure.id ? 'Aprobando...' : 'Aprobar Cierre Inmutable'}
                    </button>
                  )}
                </div>
              </div>

              {/* Resumen del Cierre */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">
                    Personal Incluido
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">
                    {closure.summaryData.totalEmployees}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">
                    Días Trabajados
                  </span>
                  <span className="text-lg font-extrabold text-petroleum-900 mt-0.5 block">
                    {closure.summaryData.totalDaysWorked}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">
                    Medios Jornales
                  </span>
                  <span className="text-lg font-extrabold text-amber-700 mt-0.5 block">
                    {closure.summaryData.totalHalfDays}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">
                    Horas Diurnas
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 mt-0.5 block">
                    {closure.summaryData.totalDayHours} hs
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                  <span className="block text-[10px] text-purple-700 font-bold uppercase">
                    Horas Nocturnas (+30%)
                  </span>
                  <span className="text-lg font-extrabold text-purple-900 mt-0.5 block">
                    {closure.summaryData.totalNightHours} hs
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">
                    Total Horas Período
                  </span>
                  <span className="text-lg font-extrabold text-slate-950 mt-0.5 block">
                    {closure.summaryData.totalHours} hs
                  </span>
                </div>
              </div>

              {!isApproved && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Este cierre se encuentra en estado <strong>BORRADOR</strong>. Podés revisar las jornadas, aplicar correcciones y exportar la planilla antes de la aprobación final.
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Nuevo Cierre */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Crear Nuevo Cierre de Período</h3>
            <form onSubmit={handleCreateClosure} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">Nombre del Período</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Fecha Fin</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
                >
                  Generar Borrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
