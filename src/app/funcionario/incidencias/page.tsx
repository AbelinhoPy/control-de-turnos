'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock, ArrowLeft, Plus } from 'lucide-react';

interface Incident {
  id: string;
  date: string;
  type: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  resolutionNotes?: string | null;
  resolvedByName?: string | null;
  createdAt: string;
}

export default function FuncionarioIncidenciasPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/attendance/incident')
      .then((r) => r.json())
      .then((d) => setIncidents(d.incidents || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900">Mis Solicitudes de Revisión</h2>
          <p className="text-[11px] text-slate-500">
            Seguimiento de problemas de GPS u olvidos de marcación
          </p>
        </div>
        <Link
          href="/funcionario"
          className="text-xs font-semibold text-petroleum-700 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </Link>
      </div>

      <div className="space-y-3">
        {incidents.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-xs text-slate-700 font-bold">No tenés solicitudes pendientes</p>
            <p className="text-[11px] text-slate-400">
              Todas tus marcaciones han sido registradas y validadas con normalidad.
            </p>
          </div>
        ) : (
          incidents.map((inc) => (
            <div
              key={inc.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Fecha: {inc.date}</span>
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
                    : 'En Revisión'}
                </span>
              </div>

              <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-900 block text-[11px] mb-0.5">
                  Motivo reportado:
                </span>
                <p>{inc.description}</p>
              </div>

              {inc.resolutionNotes && (
                <div className="text-xs text-emerald-900 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                  <span className="font-bold text-emerald-950 block text-[11px] mb-0.5">
                    Respuesta de administración ({inc.resolvedByName || 'Aldo Samudio'}):
                  </span>
                  <p>{inc.resolutionNotes}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
