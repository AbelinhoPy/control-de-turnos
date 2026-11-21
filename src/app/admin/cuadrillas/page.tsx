'use client';

import { useState, useEffect } from 'react';
import { Users, Clock, Shield, Sparkles } from 'lucide-react';

interface Crew {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string;
  color: string;
}

interface User {
  id: string;
  name: string;
  crewId: string | null;
  baseDailyWage: number;
  role: string;
}

export default function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/staff?includeDeactivated=false')
      .then((r) => r.json())
      .then((d) => {
        setCrews(d.crews || []);
        setUsers((d.staff || []).filter((u: User) => u.role !== 'ADMIN'));
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      <div className="pb-6 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
          Estructura de Equipos
        </span>
        <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
          Cuadrillas y Esquemas de Rotación 24/7
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tres cuadrillas de turno fijo y una cuadrilla volante para cubrir descansos con rotación hacia adelante (2M → 2T → 2N → 2L).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {crews.map((c) => {
          const members = users.filter((u) => u.crewId === c.id);

          return (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-petroleum-50 text-petroleum-800 font-extrabold flex items-center justify-center text-sm border border-petroleum-200">
                  {c.code}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {c.type === 'ROTATING' ? 'Volante' : 'Turno Fijo'}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{c.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Integrantes Asignados ({members.length})
                </span>
                {members.length > 0 ? (
                  <div className="space-y-1.5">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-800 flex items-center justify-between"
                      >
                        <span>{m.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ₲ {m.baseDailyWage?.toLocaleString('es-PY')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Sin integrantes asignados</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
