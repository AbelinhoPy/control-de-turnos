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
  Sparkles,
  Camera,
  X,
  ShieldAlert,
} from 'lucide-react';
import { formatTimeAsuncion, getDayNameEs, getCurrentDateAsuncion } from '@/lib/time/timezone';

interface EnrichedAttendance {
  id: string;
  userId: string;
  userName: string;
  crewId?: string | null;
  shiftCode: string;
  date: string;
  clockInTime?: string | null;
  clockInStatus?: string;
  clockInDistanceMeters?: number | null;
  clockInPhoto?: string | null;
  clockOutTime?: string | null;
  clockOutStatus?: string;
  clockOutDistanceMeters?: number | null;
  clockOutPhoto?: string | null;
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
  gpsRiskScore?: number | null;
  gpsRiskFlags?: string | null;
}

interface CrewItem {
  id: string;
  name: string;
  color: string;
}

export default function AttendanceControlPage() {
  const [selectedDate, setSelectedDate] = useState(getCurrentDateAsuncion());
  const [attendances, setAttendances] = useState<EnrichedAttendance[]>([]);
  const [crews, setCrews] = useState<CrewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [crewFilter, setCrewFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal corrección manual
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{
    userName: string;
    label: string;
    time: string;
    distance?: number | null;
    photo: string;
  } | null>(null);
  const [targetAtt, setTargetAtt] = useState<EnrichedAttendance | null>(null);
  const [formClockIn, setFormClockIn] = useState('');
  const [formClockOut, setFormClockOut] = useState('');
  const [formStatus, setFormStatus] = useState<EnrichedAttendance['status']>('COMPLETA');
  const [formWorkedDays, setFormWorkedDays] = useState(1);
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attRes, staffRes] = await Promise.all([
        fetch(`/api/attendance?date=${selectedDate}`),
        fetch('/api/staff?includeDeactivated=true'),
      ]);

      const attData = await attRes.json();
      const staffData = await staffRes.json();

      setAttendances(attData.attendances || []);
      setCrews(staffData.crews || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleOpenCorrection = (att: EnrichedAttendance) => {
    setTargetAtt(att);
    setFormClockIn(att.clockInTime ? formatTimeAsuncion(att.clockInTime) : '06:00');
    setFormClockOut(att.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '14:00');
    setFormStatus(att.status === 'LIBRE' ? 'COMPLETA' : att.status);
    setFormWorkedDays(Number(att.workedDays) || 1);
    setFormReason(att.correctionReason || '');
    setIsCorrectModalOpen(true);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReason || formReason.trim().length < 5) {
      alert('Debe ingresar un motivo obligatorio para justificar la corrección manual.');
      return;
    }
    if (!targetAtt) return;

    setSubmitting(true);
    try {
      const inIso = formClockIn ? `${selectedDate}T${formClockIn}:00-03:00` : null;
      let outIso = null;
      if (formClockOut) {
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
          attendanceId: targetAtt.id,
          userId: targetAtt.userId,
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
        setFeedback('Jornada corregida y auditada exitosamente con firma de Aldo Samudio.');
        loadData();
        setTimeout(() => setFeedback(null), 3500);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Error al guardar la corrección.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado
  const filteredAttendances = attendances.filter((att) => {
    if (statusFilter !== 'ALL' && att.status !== statusFilter) return false;
    if (crewFilter !== 'ALL' && att.crewId !== crewFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return att.userName.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Control de Marcaciones en Sede
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Supervisión y Corrección de Asistencia
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisá marcas de GPS, corregí olvidos de salida o ausencias con registro inmutable de auditoría.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
          <Calendar className="w-4 h-4 text-petroleum-700" />
          <label className="text-xs font-semibold text-slate-600">Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-900 bg-slate-50 font-semibold focus:outline-none focus:ring-1 focus:ring-petroleum-600"
          />
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{feedback}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar funcionario..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full focus:outline-none focus:ring-1 focus:ring-petroleum-600"
            />
          </div>

          {/* Estado */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs bg-white text-slate-800"
            >
              <option value="ALL">Todos los estados</option>
              <option value="COMPLETA">Completa</option>
              <option value="EN_CURSO">En curso</option>
              <option value="INCOMPLETA">Incompleta</option>
              <option value="AUSENTE">Ausente</option>
              <option value="LIBRE">Día Libre</option>
              <option value="JUSTIFICADA">Justificada</option>
            </select>
          </div>

          {/* Cuadrilla */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Cuadrilla:</span>
            <select
              value={crewFilter}
              onChange={(e) => setCrewFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs bg-white text-slate-800"
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

        <span className="text-[11px] text-slate-500 font-medium">
          Mostrando {filteredAttendances.length} registros del {selectedDate} ({getDayNameEs(selectedDate)})
        </span>
      </div>

      {/* Tabla de Asistencias Reales */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Funcionario</th>
                <th className="py-3 px-4">Cuadrilla</th>
                <th className="py-3 px-4 text-center">Turno</th>
                <th className="py-3 px-4 text-center">Hora Entrada</th>
                <th className="py-3 px-4 text-center">Hora Salida</th>
                <th className="py-3 px-4 text-center">Días Trab.</th>
                <th className="py-3 px-4 text-center">Horas Diurnas</th>
                <th className="py-3 px-4 text-center">Horas Nocturnas (+30%)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">GPS</th>
                <th className="py-3 px-4">Auditoría / Observaciones</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No se encontraron registros de asistencia para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((att) => {
                  const crew = crews.find((c) => c.id === att.crewId);

                  let badge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      Día Libre
                    </span>
                  );

                  if (att.status === 'COMPLETA') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ Completa
                      </span>
                    );
                  } else if (att.status === 'EN_CURSO') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        En curso
                      </span>
                    );
                  } else if (att.status === 'INCOMPLETA') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Incompleta
                      </span>
                    );
                  } else if (att.status === 'AUSENTE') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Ausente
                      </span>
                    );
                  } else if (att.status === 'JUSTIFICADA') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        Justificada
                      </span>
                    );
                  }

                  return (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {att.userName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {crew?.name || 'General'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            att.shiftCode === 'M'
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : att.shiftCode === 'T'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : att.shiftCode === 'N'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {att.shiftCode === 'L' ? 'Libre' : `Turno ${att.shiftCode}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{att.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--'}</span>
                          {att.clockInPhoto && (
                            <button
                              type="button"
                              onClick={() =>
                                setPhotoPreview({
                                  userName: att.userName,
                                  label: 'Foto de Entrada',
                                  time: att.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--',
                                  distance: att.clockInDistanceMeters,
                                  photo: att.clockInPhoto!,
                                })
                              }
                              title="Ver foto de entrada"
                              className="p-1 rounded-md bg-petroleum-50 text-petroleum-700 hover:bg-petroleum-100 border border-petroleum-200 transition"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{att.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--'}</span>
                          {att.clockOutPhoto && (
                            <button
                              type="button"
                              onClick={() =>
                                setPhotoPreview({
                                  userName: att.userName,
                                  label: 'Foto de Salida',
                                  time: att.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--',
                                  distance: att.clockOutDistanceMeters,
                                  photo: att.clockOutPhoto!,
                                })
                              }
                              title="Ver foto de salida"
                              className="p-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {Number(att.workedDays).toFixed(1)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {Number(att.dayHours).toFixed(1)} hs
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-purple-800">
                        {Number(att.nightHours).toFixed(1)} hs
                      </td>
                      <td className="py-3.5 px-4 text-center">{badge}</td>
                      {/* ── Badge Anti-GPS falso ───────────────────────── */}
                      <td className="py-3.5 px-4 text-center">
                        {(() => {
                          const score = att.gpsRiskScore ?? 0;
                          if (score === 0) {
                            return (
                              <span className="text-[10px] text-slate-300 font-medium">—</span>
                            );
                          }
                          let flags: string[] = [];
                          try {
                            flags = att.gpsRiskFlags ? JSON.parse(att.gpsRiskFlags) : [];
                          } catch {}

                          const flagLabels: Record<string, string> = {
                            PERFECT_ACCURACY:    'Precisión GPS exacta (0-1m)',
                            ROUNDED_COORDINATES: 'Coordenadas redondeadas',
                            EXACT_WORKPLACE_MATCH: 'Coordenadas = pin de sede',
                            IMPOSSIBLE_SPEED:    'Velocidad imposible',
                            STATIC_COORDINATES:  'Coordenadas estáticas',
                          };

                          const tooltipText = flags.length > 0
                            ? flags.map((f) => flagLabels[f] || f).join('\n')
                            : `Score: ${score}/100`;

                          if (score >= 50) {
                            return (
                              <button
                                type="button"
                                title={`⚠️ GPS sospechoso (${score}/100)\n${tooltipText}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 transition cursor-help"
                              >
                                <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                                {score}/100
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              title={`GPS con señales leves (${score}/100)\n${tooltipText}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition cursor-help"
                            >
                              <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                              {score}/100
                            </button>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {att.isManualCorrection ? (
                          <span className="text-amber-800 font-medium">
                            ✏️ {att.correctionReason} ({att.correctedByName})
                          </span>
                        ) : (
                          att.notes || 'Validado en sede por GPS'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenCorrection(att)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-petroleum-800 bg-petroleum-50 hover:bg-petroleum-100 border border-petroleum-200 transition"
                        >
                          <Edit className="w-3 h-3" />
                          Corregir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Vista Previa de Evidencia Fotográfica */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-petroleum-700 block">
                  {photoPreview.label}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{photoPreview.userName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={photoPreview.photo}
                alt={`${photoPreview.label} - ${photoPreview.userName}`}
                className="w-full h-auto object-cover"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl">
              <span>
                Hora: <strong className="text-slate-900 font-mono">{photoPreview.time}</strong>
              </span>
              {typeof photoPreview.distance === 'number' && (
                <span>
                  Distancia sede: <strong className="text-emerald-700">{Math.round(photoPreview.distance)} m</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Corrección */}
      {isCorrectModalOpen && targetAtt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-petroleum-700 uppercase tracking-wider block">
                Auditoría Administrativa
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Corregir Jornada - {targetAtt.userName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Fecha de jornada: {selectedDate} | Esta modificación se firmará como realizada por Aldo Samudio.
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
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Hora Salida (HH:mm)</label>
                  <input
                    type="time"
                    value={formClockOut}
                    onChange={(e) => setFormClockOut(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Estado de Jornada</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as EnrichedAttendance['status'])}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                  >
                    <option value="COMPLETA">Completa</option>
                    <option value="INCOMPLETA">Incompleta (falta salida)</option>
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
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
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
                  placeholder="Ej: Olvido de marcación validado con relevo de guardia. / Autorización de salida anticipada por urgencia médica."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCorrectModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
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
