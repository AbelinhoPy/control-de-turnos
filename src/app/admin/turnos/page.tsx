'use client';

import { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Filter,
  Download,
  Send,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { getDatesInRange, getShortDayNameEs, getDayNameEs } from '@/lib/time/timezone';

interface ShiftItem {
  id: string;
  userId: string;
  date: string;
  shiftCode: string;
  isPublished: boolean;
}

interface UserItem {
  id: string;
  name: string;
  crewId: string | null;
}

interface CrewItem {
  id: string;
  name: string;
  code: string;
  color: string;
  type: string;
}

export default function ShiftPlanningPage() {
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-15');
  const [selectedCrew, setSelectedCrew] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [crews, setCrews] = useState<CrewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const dates = getDatesInRange(startDate, endDate);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, staffRes] = await Promise.all([
        fetch(`/api/shifts?startDate=${startDate}&endDate=${endDate}`),
        fetch('/api/staff?includeDeactivated=false'),
      ]);

      const shiftsData = await shiftsRes.json();
      const staffData = await staffRes.json();

      setShifts(shiftsData.shifts || []);
      setUsers((staffData.staff || []).filter((u: { role: string }) => u.role !== 'ADMIN'));
      setCrews(staffData.crews || []);
    } catch (e) {
      console.error('Error cargando turnos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleShiftChange = async (userId: string, date: string, shiftCode: string) => {
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, shiftCode }),
      });
      if (res.ok) {
        setShifts((prev) => {
          const idx = prev.findIndex((s) => s.userId === userId && s.date === date);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], shiftCode, isPublished: false };
            return next;
          }
          return [
            ...prev,
            { id: `shift_${userId}_${date}`, userId, date, shiftCode, isPublished: false },
          ];
        });
      }
    } catch (e) {
      console.error('Error actualizando turno:', e);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishMessage(null);
    try {
      const res = await fetch('/api/shifts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json();
      if (res.ok) {
        setPublishMessage(data.message);
        loadData();
      }
    } catch (e) {
      console.error('Error publicando calendario:', e);
    } finally {
      setPublishing(false);
    }
  };

  // Filtrado de usuarios
  const filteredUsers = users.filter((u) => {
    if (selectedCrew !== 'ALL' && u.crewId !== selectedCrew) return false;
    if (selectedUser !== 'ALL' && u.id !== selectedUser) return false;
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-full">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Rotación Ergonómica 24/7
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Planificación y Calendario de Turnos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Asigná turnos, validá la cobertura frente a la meta (2 por turno) y publicá el cronograma oficial.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`/api/export/excel?type=planning&startDate=${startDate}&endDate=${endDate}&crewId=${selectedCrew !== 'ALL' ? selectedCrew : ''}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel (MEPY)
          </a>

          <a
            href={`/api/export/pdf?reportType=cobertura&startDate=${startDate}&endDate=${endDate}&crewId=${selectedCrew !== 'ALL' ? selectedCrew : ''}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar PDF
          </a>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 shadow-sm transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-cyan-300" />
            {publishing ? 'Publicando...' : 'Publicar Calendario'}
          </button>
        </div>
      </div>

      {publishMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{publishMessage}</span>
          </div>
          <button
            onClick={() => setPublishMessage(null)}
            className="text-emerald-700 font-bold hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Filtros y Rango de Fechas */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset rápido semana y quincena */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => {
                setStartDate('2026-11-01');
                setEndDate('2026-11-07');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                startDate === '2026-11-01' && endDate === '2026-11-07'
                  ? 'bg-white text-petroleum-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semana 1
            </button>
            <button
              onClick={() => {
                setStartDate('2026-11-08');
                setEndDate('2026-11-14');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                startDate === '2026-11-08' && endDate === '2026-11-14'
                  ? 'bg-white text-petroleum-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semana 2
            </button>
            <button
              onClick={() => {
                setStartDate('2026-11-01');
                setEndDate('2026-11-15');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                startDate === '2026-11-01' && endDate === '2026-11-15'
                  ? 'bg-white text-petroleum-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1ª Quincena
            </button>
            <button
              onClick={() => {
                setStartDate('2026-11-16');
                setEndDate('2026-11-30');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                startDate === '2026-11-16' && endDate === '2026-11-30'
                  ? 'bg-white text-petroleum-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2ª Quincena
            </button>
            <button
              onClick={() => {
                setStartDate('2026-11-01');
                setEndDate('2026-11-30');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                startDate === '2026-11-01' && endDate === '2026-11-30'
                  ? 'bg-white text-petroleum-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mes Completo
            </button>
          </div>

          {/* Filtro por Cuadrilla */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Cuadrilla:</span>
            <select
              value={selectedCrew}
              onChange={(e) => setSelectedCrew(e.target.value)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-petroleum-600"
            >
              <option value="ALL">Todas las cuadrillas</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Funcionario */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Funcionario:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-petroleum-600"
            >
              <option value="ALL">Todos los funcionarios</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leyenda de colores de turnos */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-300 font-bold text-[9px] flex items-center justify-center text-blue-800">
              M
            </span>
            <span className="text-slate-600 text-[11px]">Mañana (06-14)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 font-bold text-[9px] flex items-center justify-center text-emerald-800">
              T
            </span>
            <span className="text-slate-600 text-[11px]">Tarde (14-22)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-300 font-bold text-[9px] flex items-center justify-center text-purple-800">
              N
            </span>
            <span className="text-slate-600 text-[11px]">Noche (22-06)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-300 font-bold text-[9px] flex items-center justify-center text-slate-600">
              L
            </span>
            <span className="text-slate-600 text-[11px]">Libre</span>
          </div>
        </div>
      </div>

      {/* Matriz Cronograma General */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold text-slate-600 w-36 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Equipo / Cuadrilla
                </th>
                <th className="py-2.5 px-3 font-semibold text-slate-700 w-48 sticky left-36 bg-slate-50 z-10 border-r border-slate-200">
                  Funcionario
                </th>
                {dates.map((dStr) => {
                  const [, , d] = dStr.split('-');
                  const shortDay = getShortDayNameEs(dStr);
                  const isWeekend = shortDay === 'Sáb' || shortDay === 'Dom';

                  return (
                    <th
                      key={dStr}
                      className={`py-2 px-1 text-center font-semibold border-r border-slate-200 min-w-[42px] ${
                        isWeekend ? 'bg-amber-50/50' : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 font-bold">{shortDay}</div>
                      <div className="text-xs font-extrabold text-slate-800">{parseInt(d, 10)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const crew = crews.find((c) => c.id === u.crewId);

                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2 px-3 font-medium text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-200 truncate">
                      {crew?.name || 'General'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 sticky left-36 bg-white z-10 border-r border-slate-200 truncate">
                      {u.name}
                    </td>
                    {dates.map((dStr) => {
                      const shift = shifts.find((s) => s.userId === u.id && s.date === dStr);
                      const code = shift?.shiftCode || 'L';

                      return (
                        <td key={dStr} className="p-1 text-center border-r border-slate-100">
                          <select
                            value={code}
                            onChange={(e) => handleShiftChange(u.id, dStr, e.target.value)}
                            className={`w-9 h-7 rounded text-[11px] font-extrabold text-center border cursor-pointer focus:outline-none focus:ring-1 focus:ring-petroleum-600 transition ${
                              code === 'M'
                                ? 'bg-blue-100/90 text-blue-900 border-blue-300'
                                : code === 'T'
                                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300'
                                : code === 'N'
                                ? 'bg-purple-100/90 text-purple-900 border-purple-300'
                                : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}
                          >
                            <option value="M">M</option>
                            <option value="T">T</option>
                            <option value="N">N</option>
                            <option value="L">L</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Fila separadora */}
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td
                  colSpan={dates.length + 2}
                  className="py-2 px-4 font-bold text-xs text-petroleum-900 tracking-wider uppercase bg-petroleum-100/40"
                >
                  Control de Cobertura Diaria (Meta: 2 personas por turno)
                </td>
              </tr>

              {/* Cobertura Turno Mañana */}
              <tr className="bg-blue-50/30">
                <td
                  colSpan={2}
                  className="py-2 px-3 font-bold text-blue-900 sticky left-0 bg-blue-50 z-10 border-r border-slate-200 text-xs"
                >
                  Turno Mañana (06:00 a 14:00)
                </td>
                {dates.map((dStr) => {
                  const count = shifts.filter((s) => s.date === dStr && s.shiftCode === 'M').length;
                  const isOk = count >= 2;
                  return (
                    <td
                      key={dStr}
                      className={`text-center font-extrabold text-xs py-2 border-r border-slate-200 ${
                        isOk ? 'text-emerald-700 bg-emerald-50/60' : 'text-rose-700 bg-rose-50/80 font-black'
                      }`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>

              {/* Cobertura Turno Tarde */}
              <tr className="bg-emerald-50/30">
                <td
                  colSpan={2}
                  className="py-2 px-3 font-bold text-emerald-900 sticky left-0 bg-emerald-50 z-10 border-r border-slate-200 text-xs"
                >
                  Turno Tarde (14:00 a 22:00)
                </td>
                {dates.map((dStr) => {
                  const count = shifts.filter((s) => s.date === dStr && s.shiftCode === 'T').length;
                  const isOk = count >= 2;
                  return (
                    <td
                      key={dStr}
                      className={`text-center font-extrabold text-xs py-2 border-r border-slate-200 ${
                        isOk ? 'text-emerald-700 bg-emerald-50/60' : 'text-rose-700 bg-rose-50/80 font-black'
                      }`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>

              {/* Cobertura Turno Noche */}
              <tr className="bg-purple-50/30">
                <td
                  colSpan={2}
                  className="py-2 px-3 font-bold text-purple-900 sticky left-0 bg-purple-50 z-10 border-r border-slate-200 text-xs"
                >
                  Turno Noche (22:00 a 06:00)
                </td>
                {dates.map((dStr) => {
                  const count = shifts.filter((s) => s.date === dStr && s.shiftCode === 'N').length;
                  const isOk = count >= 2;
                  return (
                    <td
                      key={dStr}
                      className={`text-center font-extrabold text-xs py-2 border-r border-slate-200 ${
                        isOk ? 'text-emerald-700 bg-emerald-50/60' : 'text-rose-700 bg-rose-50/80 font-black'
                      }`}
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>

              {/* Total Activo */}
              <tr className="bg-slate-100 font-bold">
                <td
                  colSpan={2}
                  className="py-2.5 px-3 font-extrabold text-slate-800 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 text-xs"
                >
                  Total Personal Activo
                </td>
                {dates.map((dStr) => {
                  const count = shifts.filter((s) => s.date === dStr && s.shiftCode !== 'L').length;
                  return (
                    <td
                      key={dStr}
                      className="text-center font-black text-xs py-2.5 border-r border-slate-200 text-slate-900"
                    >
                      {count}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
