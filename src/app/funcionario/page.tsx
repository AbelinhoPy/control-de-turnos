'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Navigation,
  RefreshCw,
  Send,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface AttendanceState {
  id?: string;
  status: 'EN_CURSO' | 'COMPLETA' | 'INCOMPLETA' | 'AUSENTE' | 'LIBRE' | 'NO_INICIADA';
  clockInTime?: string | null;
  clockOutTime?: string | null;
  totalHours?: number;
  dayHours?: number;
  nightHours?: number;
}

interface ShiftInfo {
  code: string;
  name: string;
  timeRange: string;
  crewName: string;
  isPublished: boolean;
}

export default function FuncionarioMobilePage() {
  const [loading, setLoading] = useState(true);
  const [shiftInfo, setShiftInfo] = useState<ShiftInfo | null>(null);
  const [attendance, setAttendance] = useState<AttendanceState>({ status: 'NO_INICIADA' });
  const [orgWorkplace, setOrgWorkplace] = useState<{
    name: string;
    lat: number;
    lng: number;
    radius: number;
  } | null>(null);

  // Estados de marcación
  const [locating, setLocating] = useState(false);
  const [geoExplanationOpen, setGeoExplanationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canRequestReview, setCanRequestReview] = useState(false);

  // Modal Solicitud de Revisión
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewType, setReviewType] = useState('GPS_ERROR');
  const [reviewDescription, setReviewDescription] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Idempotency token para prevenir doble toque
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof window !== 'undefined'
      ? `idem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      : ''
  );

  const loadCurrentStatus = async () => {
    try {
      const [meRes, shiftsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/shifts'),
      ]);

      const meData = await meRes.json();
      const shiftsData = await shiftsRes.json();

      if (meData.organization) {
        setOrgWorkplace({
          name: meData.organization.workplaceName,
          lat: meData.organization.workplaceLat,
          lng: meData.organization.workplaceLng,
          radius: meData.organization.geofenceRadiusMeters,
        });
      }

      const todayStr = '2026-11-08'; // O fecha del día
      const todayShift = (shiftsData.shifts || []).find(
        (s: { date: string }) => s.date === todayStr
      );

      if (todayShift) {
        const codeMap: Record<string, { name: string; time: string }> = {
          M: { name: 'Mañana', time: '06:00 a 14:00' },
          T: { name: 'Tarde', time: '14:00 a 22:00' },
          N: { name: 'Noche', time: '22:00 a 06:00 (Cruza medianoche)' },
          L: { name: 'Libre', time: 'Descanso programado' },
        };

        const mapped = codeMap[todayShift.shiftCode] || { name: 'Turno', time: 'Horario regular' };
        setShiftInfo({
          code: todayShift.shiftCode,
          name: mapped.name,
          timeRange: mapped.time,
          crewName: 'Mi Cuadrilla',
          isPublished: todayShift.isPublished,
        });
      } else {
        setShiftInfo({
          code: 'M',
          name: 'Mañana',
          timeRange: '06:00 a 14:00',
          crewName: 'Equipo A',
          isPublished: true,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentStatus();
  }, []);

  // Determinar siguiente acción requerida
  const isWorking = attendance.status === 'EN_CURSO';
  const isCompleted = attendance.status === 'COMPLETA';
  const isDayOff = shiftInfo?.code === 'L';
  const nextActionType = isWorking ? 'OUT' : 'IN';
  const nextActionLabel = isWorking ? 'Marcar Salida' : 'Marcar Entrada';

  const sendAttendanceCoordinates = async (latitude: number, longitude: number, accuracy: number) => {
    setLocating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCanRequestReview(false);

    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: latitude,
          lng: longitude,
          accuracy,
          type: nextActionType,
          idempotencyToken: idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Error al validar la marcación.');
        setCanRequestReview(Boolean(data.canRequestReview));
      } else {
        setSuccessMessage(data.message);
        setAttendance(data.attendance);
        setIdempotencyKey(`idem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      }
    } catch {
      setErrorMessage('Error de conexión con el servidor. Verificá tu red y reintentá.');
      setCanRequestReview(true);
    } finally {
      setLocating(false);
    }
  };

  const triggerGeolocationCheck = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCanRequestReview(false);

    if (!navigator.geolocation) {
      setErrorMessage(
        'Tu navegador o dispositivo no soporta geolocalización. Podés solicitar una revisión.'
      );
      setCanRequestReview(true);
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        sendAttendanceCoordinates(latitude, longitude, accuracy);
      },
      (err) => {
        setLocating(false);
        let msg = 'No se pudo obtener tu ubicación GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            'Permiso de ubicación denegado. Para registrar asistencia necesitás habilitar el GPS en la configuración de tu navegador.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'El GPS tardó demasiado en responder. Asegurate de tener señal a cielo abierto y reintentá.';
        }
        setErrorMessage(msg);
        setCanRequestReview(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      const res = await fetch('/api/attendance/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          type: reviewType,
          description: reviewDescription,
          date: '2026-11-08',
        }),
      });
      if (res.ok) {
        setReviewSubmitted(true);
      } else {
        alert('Error enviando solicitud');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Tarjeta de Turno de Hoy */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-petroleum-700">
            Turno Programado para Hoy
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              shiftInfo?.code === 'M'
                ? 'bg-blue-100 text-blue-800'
                : shiftInfo?.code === 'T'
                ? 'bg-emerald-100 text-emerald-800'
                : shiftInfo?.code === 'N'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {shiftInfo?.code === 'L' ? 'Día Libre' : `Turno ${shiftInfo?.code}`}
          </span>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{shiftInfo?.name}</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-petroleum-800" />
            <span>{shiftInfo?.timeRange}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>{orgWorkplace?.name || 'Sede Central'}</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
            Radio: {orgWorkplace?.radius || 300}m
          </span>
        </div>
      </div>

      {/* Estado Actual de la Jornada */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-700'
                : isWorking
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isWorking ? (
              <Clock className="w-5 h-5" />
            ) : (
              <Navigation className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">
              Estado de Jornada
            </span>
            <span className="text-xs font-bold text-slate-900">
              {isCompleted
                ? 'Jornada Finalizada'
                : isWorking
                ? 'En Puesto (Entrada Registrada)'
                : isDayOff
                ? 'Día Libre'
                : 'Pendiente de Entrada'}
            </span>
          </div>
        </div>

        {isWorking && (
          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 animate-pulse">
            En Curso
          </span>
        )}
      </div>

      {/* Mensajes de Éxito o Error */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Marcación Registrada</span>
          </div>
          <p>{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Aviso de Marcación</span>
          </div>
          <p className="leading-relaxed">{errorMessage}</p>

          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={triggerGeolocationCheck}
              className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 font-semibold text-rose-800 hover:bg-rose-100/50 transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
            {canRequestReview && (
              <button
                onClick={() => {
                  setReviewDescription(errorMessage);
                  setIsReviewModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
              >
                Solicitar Revisión
              </button>
            )}
          </div>
        </div>
      )}

      {/* Explicación de Ubicación Transparente */}
      <div className="p-3 bg-petroleum-50/70 border border-petroleum-100 rounded-xl text-[11px] text-petroleum-900 space-y-1">
        <div className="flex items-center gap-1.5 font-bold">
          <ShieldCheck className="w-4 h-4 text-petroleum-700 flex-shrink-0" />
          <span>Privacidad de tu Ubicación</span>
        </div>
        <p className="text-slate-600 leading-normal">
          Control de Turnos solicita tu GPS <strong>únicamente al momento de tocar el botón</strong> para verificar que estás en la sede. No rastreamos tus movimientos continuos.
        </p>
      </div>

      {/* BOTÓN GIGANTE DE MARCACIÓN PARA CELULAR */}
      {!isDayOff && !isCompleted && (
        <div className="pt-2 pb-2">
          <button
            onClick={triggerGeolocationCheck}
            disabled={locating}
            className={`w-full py-6 px-4 rounded-3xl font-extrabold text-lg text-white shadow-lg transition-all transform active:scale-98 flex flex-col items-center justify-center gap-2 disabled:opacity-50 ${
              isWorking
                ? 'bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-amber-900/20'
                : 'bg-gradient-to-b from-petroleum-800 to-petroleum-950 hover:from-petroleum-900 hover:to-black shadow-petroleum-950/30'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              {locating ? (
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-300" />
              ) : (
                <Navigation className="w-6 h-6 text-white" />
              )}
            </div>
            <span>{locating ? 'Verificando GPS en sede...' : nextActionLabel}</span>
            <span className="text-[11px] font-medium text-white/70">
              {locating ? 'Por favor aguardá unos segundos' : 'Toca para verificar ubicación y marcar'}
            </span>
          </button>
        </div>
      )}

      {/* Botón para solicitar revisión */}
      <div className="pt-2 text-center">
        <button
          onClick={() => {
            setReviewDescription('');
            setIsReviewModalOpen(true);
          }}
          className="text-xs font-semibold text-petroleum-700 hover:text-petroleum-800 hover:underline inline-flex items-center gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          ¿Tuviste un problema con tu marca? Solicitá una revisión
        </button>
      </div>

      {/* Simulador de Pruebas de Geocerca (Para Demostración de Aldo Samudio) */}
      <div className="mt-4 p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Simulador de Pruebas GPS (Modo Demo)
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
            Pruebas rápidas
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Probá cómo reacciona el sistema ante los 3 escenarios reales de geocerca:
        </p>
        <div className="grid grid-cols-1 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => sendAttendanceCoordinates(-25.28675, -57.64705, 15)}
            className="w-full text-left p-2 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 font-semibold transition flex items-center justify-between"
          >
            <span>1. Simular GPS en Sede Central (Dentro de radio, ±15m)</span>
            <span className="text-[10px] font-bold bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-800">Válido</span>
          </button>

          <button
            type="button"
            onClick={() => sendAttendanceCoordinates(-25.31000, -57.64700, 15)}
            className="w-full text-left p-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-800 font-semibold transition flex items-center justify-between"
          >
            <span>2. Simular GPS Fuera de Sede (a 2.5 km de distancia)</span>
            <span className="text-[10px] font-bold bg-rose-100 px-1.5 py-0.5 rounded text-rose-800">Rechazo</span>
          </button>

          <button
            type="button"
            onClick={() => sendAttendanceCoordinates(-25.28670, -57.64700, 250)}
            className="w-full text-left p-2 rounded-xl bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 font-semibold transition flex items-center justify-between"
          >
            <span>3. Simular Baja Precisión de Señal (±250m)</span>
            <span className="text-[10px] font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">Alerta</span>
          </button>
        </div>
      </div>

      {/* Modal de Solicitud de Revisión */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Solicitar Revisión Administrativa</h3>
            <p className="text-xs text-slate-500">
              Aldo Samudio o la administración revisará tu caso para cargar o corregir tu marca manual.
            </p>

            {reviewSubmitted ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-700 font-medium">
                  Tu solicitud ha sido enviada con éxito. Podés consultar el estado en la sección «Mis Revisiones».
                </p>
                <button
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setReviewSubmitted(false);
                  }}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Tipo de Problema</label>
                  <select
                    value={reviewType}
                    onChange={(e) => setReviewType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
                  >
                    <option value="GPS_ERROR">Error de GPS / Fuera de radio estando en puesto</option>
                    <option value="FORGOT_CLOCK_OUT">Olvidé marcar salida al terminar guardia</option>
                    <option value="FORGOT_CLOCK_IN">Olvidé marcar entrada al llegar</option>
                    <option value="DISCREPANCY">Discrepancia de horario o relevo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Explicación breve</label>
                  <textarea
                    required
                    rows={3}
                    value={reviewDescription}
                    onChange={(e) => setReviewDescription(e.target.value)}
                    placeholder="Contanos qué sucedió para que el administrador pueda verificar..."
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900"
                  >
                    {reviewSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
