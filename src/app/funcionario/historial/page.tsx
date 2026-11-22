'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatTimeAsuncion, getDayNameEs } from '@/lib/time/timezone';

interface HistoryItem {
  id: string;
  date: string;
  shiftCode: string;
  clockInTime?: string | null;
  clockOutTime?: string | null;
  workedDays: number;
  dayHours: number;
  nightHours: number;
  totalHours: number;
  status: string;
  notes?: string | null;
}

export default function FuncionarioHistorialPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar turnos y asistencias reales del propio usuario autenticado
    Promise.all([
      fetch('/api/shifts?startDate=2026-11-01&endDate=2026-11-15'),
      fetch('/api/attendance?startDate=2026-11-01&endDate=2026-11-15'),
    ])
      .then(async ([shiftsRes, attRes]) => {
        const sData = await shiftsRes.json();
        const aData = await attRes.json();

        const shiftsList: { id: string; date: string; shiftCode: string }[] = sData.shifts || [];
        const attList: {
          id: string;
          date: string;
          clockInTime?: string | null;
          clockOutTime?: string | null;
          workedDays: number;
          dayHours: number;
          nightHours: number;
          totalHours: number;
          status: string;
          notes?: string | null;
          correctionReason?: string | null;
        }[] = aData.attendances || [];

        const list: HistoryItem[] = shiftsList.map((s) => {
          const att = attList.find((a) => a.date === s.date);
          const isLibre = s.shiftCode === 'L';

          return {
            id: s.id,
            date: s.date,
            shiftCode: s.shiftCode,
            clockInTime: att?.clockInTime || null,
            clockOutTime: att?.clockOutTime || null,
            workedDays: att ? Number(att.workedDays) : isLibre ? 0 : 0,
            dayHours: att ? Number(att.dayHours) : 0,
            nightHours: att ? Number(att.nightHours) : 0,
            totalHours: att ? Number(att.totalHours) : 0,
            status: att?.status || (isLibre ? 'LIBRE' : 'SIN_MARCAR'),
            notes: att?.notes || att?.correctionReason || (isLibre ? 'Día Libre' : 'Sin registro'),
          };
        });
        setHistory(list);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900">Mi Historial de Asistencia</h2>
          <p className="text-[11px] text-slate-500">
            Período: 1ª Quincena Noviembre 2026
          </p>
        </div>
        <Link
          href="/funcionario"
          className="text-xs font-semibold text-petroleum-700 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a marcar
        </Link>
      </div>

      <div className="space-y-2.5">
        {history.map((item) => {
          const isLibre = item.shiftCode === 'L';

          return (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border bg-white shadow-xs space-y-2 ${
                isLibre ? 'border-slate-200/60 opacity-80' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {item.date} ({getDayNameEs(item.date)})
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.shiftCode === 'M'
                        ? 'bg-blue-100 text-blue-800'
                        : item.shiftCode === 'T'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.shiftCode === 'N'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isLibre ? 'Libre' : `Turno ${item.shiftCode}`}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.status === 'COMPLETA'
                      ? 'bg-emerald-100 text-emerald-800'
                      : isLibre
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.status}
                </span>
              </div>

              {!isLibre && (
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Entrada</span>
                    <span className="font-mono font-bold text-slate-800">
                      {item.clockInTime ? formatTimeAsuncion(item.clockInTime) : '--:--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Salida</span>
                    <span className="font-mono font-bold text-slate-800">
                      {item.clockOutTime ? formatTimeAsuncion(item.clockOutTime) : '--:--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Diurnas</span>
                    <span className="font-semibold text-slate-800">{item.dayHours} hs</span>
                  </div>
                  <div>
                    <span className="text-purple-700 block text-[9px] uppercase font-bold">Nocturnas</span>
                    <span className="font-bold text-purple-800">{item.nightHours} hs</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
