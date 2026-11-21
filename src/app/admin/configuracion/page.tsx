'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Save,
  Building,
  ShieldAlert,
} from 'lucide-react';

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form fields
  const [workplaceName, setWorkplaceName] = useState('Sede Central - Asunción');
  const [workplaceLat, setWorkplaceLat] = useState(-25.2867);
  const [workplaceLng, setWorkplaceLng] = useState(-57.647);
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(300);
  const [nightHourStart, setNightHourStart] = useState('20:00');
  const [nightHourEnd, setNightHourEnd] = useState('06:00');
  const [nightSurchargePercent, setNightSurchargePercent] = useState(30);
  const [halfDayRuleConfirmed, setHalfDayRuleConfirmed] = useState(false);
  const [hourlyRateRuleConfirmed, setHourlyRateRuleConfirmed] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (d.organization) {
          const org = d.organization;
          setWorkplaceName(org.workplaceName || '');
          setWorkplaceLat(org.workplaceLat || -25.2867);
          setWorkplaceLng(org.workplaceLng || -57.647);
          setGeofenceRadiusMeters(org.geofenceRadiusMeters || 300);
          setNightHourStart(org.nightHourStart || '20:00');
          setNightHourEnd(org.nightHourEnd || '06:00');
          setNightSurchargePercent(org.nightSurchargePercent || 30);
          setHalfDayRuleConfirmed(Boolean(org.halfDayRuleConfirmed));
          setHourlyRateRuleConfirmed(Boolean(org.hourlyRateRuleConfirmed));
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workplaceName,
          workplaceLat,
          workplaceLng,
          geofenceRadiusMeters,
          nightHourStart,
          nightHourEnd,
          nightSurchargePercent,
          halfDayRuleConfirmed,
          hourlyRateRuleConfirmed,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback('Configuración guardada exitosamente.');
        setTimeout(() => setFeedback(null), 3000);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="pb-6 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
          Parámetros del Sistema
        </span>
        <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
          Configuración de Sede y Reglas de Liquidación
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Ajustá la ubicación GPS de la sede, el radio de tolerancia, la franja nocturna y confirmá las reglas monetarias.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Sede y Geolocalización */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <MapPin className="w-5 h-5 text-petroleum-800" />
            <h3 className="text-sm font-bold text-slate-900">
              Lugar de Trabajo y Geocerca (Geofence GPS)
            </h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Nombre de la Sede</label>
            <input
              type="text"
              required
              value={workplaceName}
              onChange={(e) => setWorkplaceName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Latitud GPS</label>
              <input
                type="number"
                step="0.000001"
                required
                value={workplaceLat}
                onChange={(e) => setWorkplaceLat(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Longitud GPS</label>
              <input
                type="number"
                step="0.000001"
                required
                value={workplaceLng}
                onChange={(e) => setWorkplaceLng(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Radio permitido (metros)</label>
              <input
                type="number"
                step="10"
                min="50"
                max="2000"
                required
                value={geofenceRadiusMeters}
                onChange={(e) => setGeofenceRadiusMeters(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Cualquier marcación fuera de este radio activará una advertencia de geocerca en el servidor, permitiendo solicitar revisión o corrección manual.
          </p>
        </div>

        {/* 2. Franja Nocturna y Recargo */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-purple-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Franja Horaria Nocturna y Recargo
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Inicio Franja Nocturna</label>
              <input
                type="text"
                required
                value={nightHourStart}
                onChange={(e) => setNightHourStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Estándar cliente: 20:00 hs</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Fin Franja Nocturna</label>
              <input
                type="text"
                required
                value={nightHourEnd}
                onChange={(e) => setNightHourEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Estándar cliente: 06:00 hs</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Recargo Nocturno (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={nightSurchargePercent}
                onChange={(e) => setNightSurchargePercent(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-900"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Estándar cliente: 30%</span>
            </div>
          </div>
        </div>

        {/* 3. Confirmación de Reglas de Liquidación Monetaria */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Confirmación de Reglas de Liquidación Monetaria
            </h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={halfDayRuleConfirmed}
                onChange={(e) => setHalfDayRuleConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-petroleum-700 focus:ring-petroleum-600"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Regla de Medio Jornal Confirmada (4 horas o más)
                </span>
                <span className="text-slate-500">
                  Se computa 0.5 jornal si el funcionario trabaja entre 4 y 6.9 horas, y 1.0 jornal a partir de 7 horas de trabajo efectivo.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={hourlyRateRuleConfirmed}
                onChange={(e) => setHourlyRateRuleConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-petroleum-700 focus:ring-petroleum-600"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">
                  Cálculo del Valor por Hora y Recargo del 30% Confirmado
                </span>
                <span className="text-slate-500">
                  Valor hora = Jornal Base / 8 horas. Las horas nocturnas se abonan con un recargo del 30% sobre el valor por hora diurno.
                </span>
              </div>
            </label>
          </div>

          {!halfDayRuleConfirmed && (
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <strong>Nota importante:</strong> Mientras estas dos reglas no estén expresamente confirmadas por el administrador, los reportes mostrarán días y horas con exactitud matemática, pero marcarán los importes finales en guaraníes como <em>«Pendiente de configuración»</em>.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold text-white bg-petroleum-800 hover:bg-petroleum-900 shadow-md transition disabled:opacity-50"
        >
          <Save className="w-4 h-4 text-cyan-300" />
          {saving ? 'Guardando configuración...' : 'Guardar y Aplicar Cambios'}
        </button>
      </form>
    </div>
  );
}
