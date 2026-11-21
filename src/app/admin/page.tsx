import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';
import {
  formatDateAsuncion,
  formatTimeAsuncion,
  getNowInAsuncion,
  formatFullDateEs,
} from '@/lib/time/timezone';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const todayStr = '2026-11-08'; // Fecha de demostración rica en eventos (o fecha actual)
  const org = dataStore.getOrganization(session.organizationId);
  const users = dataStore.listUsers(session.organizationId, false).filter((u) => u.role !== 'ADMIN');
  const crews = dataStore.listCrews(session.organizationId);
  const todayShifts = dataStore.listShifts(session.organizationId, {
    startDate: todayStr,
    endDate: todayStr,
  });
  const todayAttendances = dataStore.listAttendances(session.organizationId, {
    startDate: todayStr,
    endDate: todayStr,
  });
  const incidents = dataStore.listIncidents(session.organizationId, 'PENDING');

  // Métricas clave "de un vistazo":
  // 1. Quién tenía que venir: programados que no tienen turno libre
  const scheduledToday = todayShifts.filter((s) => s.shiftCode !== 'L');
  // 2. Quién llegó: los que tienen clockIn registrado
  const presentToday = scheduledToday.filter((s) => {
    const att = todayAttendances.find((a) => a.userId === s.userId);
    return att && att.clockInTime;
  });
  // 3. A quién le falta una marca: los que marcaron entrada pero no salida, o los programados que no llegaron
  const missingMark = scheduledToday.filter((s) => {
    const att = todayAttendances.find((a) => a.userId === s.userId);
    return !att || !att.clockInTime || (att.status === 'INCOMPLETA' || att.status === 'EN_CURSO');
  });
  // 4. Excepciones pendientes
  const pendingExceptions = incidents.length;

  return (
    <div className="p-8 space-y-8 max-w-7xl">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Control de Operaciones 24/7
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Panel de Guardia y Asistencia
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {formatFullDateEs(todayStr)} | Sede: {org.workplaceName} (Tolerancia: {org.geofenceRadiusMeters}m)
          </p>
        </div>

        {/* Quick Nav Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/turnos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Calendar className="w-4 h-4 text-petroleum-700" />
            Calendario
          </Link>
          <Link
            href="/admin/personal"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Users className="w-4 h-4 text-petroleum-700" />
            Personal
          </Link>
          <Link
            href="/admin/reportes"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
            Reportes & Cierres
          </Link>
        </div>
      </div>

      {/* Cuatro Tarjetas "De un Vistazo" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Tenían que venir */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Programados Hoy</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{scheduledToday.length}</span>
            <span className="text-xs text-slate-500 font-medium">funcionarios</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Objetivo: 2 personas por turno en M, T y N
          </p>
        </div>

        {/* 2. Quiénes llegaron */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Presentes / Registrados</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700">{presentToday.length}</span>
            <span className="text-xs text-emerald-600 font-medium">de {scheduledToday.length} en puesto</span>
          </div>
          <p className="mt-2 text-xs text-emerald-700 font-medium">
            Entradas verificadas por GPS en sede
          </p>
        </div>

        {/* 3. A quién le falta marca */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Pendiente o Incompleto</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-700">{missingMark.length}</span>
            <span className="text-xs text-amber-700 font-medium">requieren atención</span>
          </div>
          <p className="mt-2 text-xs text-amber-700">
            Falta entrada o salida de jornada
          </p>
        </div>

        {/* 4. Excepciones a resolver */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-white to-rose-50/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">Incidencias / GPS</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-700">{pendingExceptions}</span>
            <span className="text-xs text-rose-700 font-medium">solicitudes de revisión</span>
          </div>
          <p className="mt-2 text-xs text-rose-700">
            {pendingExceptions > 0 ? 'Excepciones de ubicación o marca' : 'Sin incidencias pendientes'}
          </p>
        </div>
      </div>

      {/* Tabla Operativa en Tiempo Real */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Estado de Guardia de la Jornada
            </h3>
            <p className="text-xs text-slate-500">
              Listado del personal programado, marcas de entrada/salida y estado de jornada
            </p>
          </div>
          <Link
            href="/admin/asistencia"
            className="text-xs font-semibold text-petroleum-700 hover:text-petroleum-800 inline-flex items-center gap-1 hover:underline"
          >
            Ver historial completo
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Funcionario</th>
                <th className="py-3 px-4">Cuadrilla</th>
                <th className="py-3 px-4">Turno Asignado</th>
                <th className="py-3 px-4 text-center">Hora Entrada</th>
                <th className="py-3 px-4 text-center">Hora Salida</th>
                <th className="py-3 px-4 text-center">Horas Diurnas</th>
                <th className="py-3 px-4 text-center">Horas Nocturnas</th>
                <th className="py-3 px-4 text-center">Estado de Jornada</th>
                <th className="py-3 px-4">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayShifts.map((shift) => {
                const u = users.find((user) => user.id === shift.userId);
                if (!u) return null;
                const crew = crews.find((c) => c.id === u.crewId);
                const att = todayAttendances.find((a) => a.userId === u.id);

                let badge = (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                    Día Libre
                  </span>
                );

                if (shift.shiftCode !== 'L') {
                  if (att?.status === 'COMPLETA') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        ✓ Completa
                      </span>
                    );
                  } else if (att?.status === 'EN_CURSO') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
                        En curso
                      </span>
                    );
                  } else if (att?.status === 'INCOMPLETA') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                        Incompleta
                      </span>
                    );
                  } else if (att?.status === 'AUSENTE') {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                        Ausente
                      </span>
                    );
                  } else {
                    badge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Sin marcar
                      </span>
                    );
                  }
                }

                return (
                  <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {u.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-600 font-medium">
                        {crew?.name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          shift.shiftCode === 'M'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : shift.shiftCode === 'T'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : shift.shiftCode === 'N'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {shift.shiftCode === 'L' ? 'Libre' : `Turno ${shift.shiftCode}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      {att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                      {att ? `${Number(att.dayHours).toFixed(1)} hs` : '0 hs'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-purple-700">
                      {att ? `${Number(att.nightHours).toFixed(1)} hs` : '0 hs'}
                    </td>
                    <td className="py-3.5 px-4 text-center">{badge}</td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {att?.notes || att?.correctionReason || (shift.shiftCode === 'L' ? 'Día Libre' : '-')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
