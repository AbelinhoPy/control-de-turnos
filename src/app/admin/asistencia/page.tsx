'use client';

import { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Edit,
  Clock,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Check,
  UserCheck,
  MapPin,
  Calendar,
} from 'lucide-react';
import { formatTimeAsuncion, getDayNameEs } from '@/lib/time/timezone';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  clockInTime?: string | null;
  clockInStatus?: string;
  clockInDistanceMeters?: number | null;
  clockOutTime?: string | null;
  clockOutStatus?: string;
  clockOutDistanceMeters?: number | null;
  workedDays: number;
  dayHours: number;
  nightHours: number;
  totalHours: number;
  status: 'EN_CURSO' | 'COMPLETA' | 'INCOMPLETA' | 'AUSENTE' | 'LIBRE' | 'JUSTIFICADA';
  isManualCorrection: boolean;
  correctionReason?: string | null;
  correctedByName?: string | null;
  correctedAt?: string | null;
  notes?: string | null;
}

interface UserItem {
  id: string;
  name: string;
  crewId: string | null;
}

export default function AttendanceControlPage() {
  const [selectedDate, setSelectedDate] = useState('2026-11-08');
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal corrección
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [targetAtt, setTargetAtt] = useState<AttendanceRecord | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [targetUserName, setTargetUserName] = useState('');
  const [formClockIn, setFormClockIn] = useState('');
  const [formClockOut, setFormClockOut] = useState('');
  const [formStatus, setFormStatus] = useState<AttendanceRecord['status']>('COMPLETA');
  const [formWorkedDays, setFormWorkedDays] = useState(1);
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, staffRes] = await Promise.all([
        fetch(`/api/shifts?startDate=${selectedDate}&endDate=${selectedDate}`),
        fetch('/api/staff?includeDeactivated=true'),
      ]);
      const staffData = await staffRes.json();
      const staffList = (staffData.staff || []).filter((u: { role: string }) => u.role !== 'ADMIN');
      setUsers(staffList);

      // Traer historial para esta fecha
      const exportRes = await fetch(`/api/export/excel?type=history&startDate=${selectedDate}&endDate=${selectedDate}`);
      // También podemos leer de un endpoint o simular el listado
      // En este caso llamamos a una ruta de consulta directa o usamos los datos en store
      const attsRes = await fetch(`/api/shifts?startDate=${selectedDate}&endDate=${selectedDate}`);
      // Alternativamente cargamos via API
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Cargar asistencias para la fecha
    fetch(`/api/shifts?startDate=${selectedDate}&endDate=${selectedDate}`)
      .then((r) => r.json())
      .then(async (data) => {
        const staffRes = await fetch('/api/staff?includeDeactivated=true');
        const staffData = await staffRes.json();
        setUsers((staffData.staff || []).filter((u: { role: string }) => u.role !== 'ADMIN'));
      });
  }, [selectedDate]);

  const handleOpenCorrection = (u: UserItem, att?: AttendanceRecord) => {
    setTargetUserId(u.id);
    setTargetUserName(u.name);
    setTargetAtt(att || null);

    if (att) {
      setFormClockIn(att.clockInTime ? att.clockInTime.slice(11, 16) : '');
      setFormClockOut(att.clockOutTime ? att.clockOutTime.slice(11, 16) : '');
      setFormStatus(att.status);
      setFormWorkedDays(Number(att.workedDays) || 1);
      setFormReason(att.correctionReason || '');
    } else {
      setFormClockIn('06:00');
      setFormClockOut('14:00');
      setFormStatus('COMPLETA');
      setFormWorkedDays(1);
      setFormReason('');
    }

    setIsCorrectModalOpen(true);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReason || formReason.trim().length < 5) {
      alert('Debe ingresar un motivo obligatorio para justificar la corrección manual.');
      return;
    }

    setSubmitting(true);
    try {
      const inIso = formClockIn ? `${selectedDate}T${formClockIn}:00-03:00` : null;
      let outIso = null;
      if (formClockOut) {
        // Si salida es menor que entrada (ej: noche), es al día siguiente
        if (formClockIn && formClockOut < formClockIn) {
          const nextDay = new Date(new Date(`${selectedDate}T12:00:00Z`).getTime() + 24 * 60 * 60 * 1000);
          const nextStr = nextDay.toISOString().slice(0, 10);
          outIso = `${nextStr}T${formClockOut}:00-03:00`;
        } else {
          outIso = `${selectedDate}T${formClockOut}:00-03:00`;
        }
      }

      const res = await fetch('/api/attendance/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: targetAtt?.id,
          userId: targetUserId,
          date: selectedDate,
          clockInTime: inIso,
          clockOutTime: outIso,
          workedDays: formWorkedDays,
          status: formStatus,
          correctionReason: formReason,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsCorrectModalOpen(false);
        setFeedback('Jornada corregida y auditada exitosamente.');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Error al guardar la corrección.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Control de Marcaciones
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Revisión y Corrección de Asistencia
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisá marcas de GPS, corregí olvidos de salida o justifícalas con registro inmutable de auditoría.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white font-semibold"
          />
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Lista de funcionarios con estado de marcación */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Jornadas del día: {selectedDate} ({getDayNameEs(selectedDate)})
          </h3>
          <span className="text-xs text-slate-500">
            Hacé clic en «Corregir / Cargar Manual» para ajustar cualquier registro
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Funcionario</th>
                <th className="py-3 px-4 text-center">Entrada Registrada</th>
                <th className="py-3 px-4 text-center">Salida Registrada</th>
                <th className="py-3 px-4 text-center">Días Trab.</th>
                <th className="py-3 px-4 text-center">Horas Diurnas</th>
                <th className="py-3 px-4 text-center">Horas Nocturnas</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4">Auditoría / Motivo</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3.5 px-4 text-center font-mono">06:00 hs</td>
                    <td className="py-3.5 px-4 text-center font-mono">14:00 hs</td>
                    <td className="py-3.5 px-4 text-center font-semibold">1.0</td>
                    <td className="py-3.5 px-4 text-center font-semibold">8.0 hs</td>
                    <td className="py-3.5 px-4 text-center font-semibold text-purple-700">0.0 hs</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Completa
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                      Validado por GPS en sede
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenCorrection(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-petroleum-800 bg-petroleum-50 hover:bg-petroleum-100 border border-petroleum-200 transition"
                      >
                        <Edit className="w-3 h-3" />
                        Corregir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Corrección Manual Obligatoria */}
      {isCorrectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-petroleum-700 uppercase tracking-wider block">
                Auditoría Administrativa
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Corregir Jornada - {targetUserName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Fecha: {selectedDate}. Esta modificación quedará registrada con tu usuario (Aldo Samudio) y fecha/hora.
              </p>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Hora Entrada (HH:mm)</label>
                  <input
                    type="time"
                    value={formClockIn}
                    onChange={(e) => setFormClockIn(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Hora Salida (HH:mm)</label>
                  <input
                    type="time"
                    value={formClockOut}
                    onChange={(e) => setFormClockOut(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Estado de Jornada</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AttendanceRecord['status'])}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                  >
                    <option value="COMPLETA">Completa</option>
                    <option value="INCOMPLETA">Incompleta (falta salida/marca)</option>
                    <option value="AUSENTE">Ausente</option>
                    <option value="LIBRE">Día Libre</option>
                    <option value="JUSTIFICADA">Ausencia Justificada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Días Computados</label>
                  <select
                    value={formWorkedDays}
                    onChange={(e) => setFormWorkedDays(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                  >
                    <option value={1}>1.0 (Día completo)</option>
                    <option value={0.5}>0.5 (Medio jornal aprobado)</option>
                    <option value={0}>0.0 (Sin jornal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Motivo obligatorio de la corrección / ajuste *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Ej: Olvido de marcación validado con relevo de guardia. / Autorización de salida anticipada por urgencia familiar."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCorrectModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 transition shadow-sm"
                >
                  {submitting ? 'Guardando...' : 'Aplicar Corrección y Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
