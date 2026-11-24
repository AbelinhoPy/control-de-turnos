'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Clock, MapPin, CheckCircle2, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(
    process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true' || process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === 'true'
  );

  useEffect(() => {
    fetch('/api/auth/login')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.isDemoMode === 'boolean') {
          setIsDemoMode(data.isDemoMode);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas.');
      }

      router.push(data.redirectUrl || '/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Control2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo / Badge */}
        <div className="mx-auto w-14 h-14 bg-petroleum-800 rounded-2xl flex items-center justify-center shadow-lg shadow-petroleum-900/20 text-white">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-petroleum-950">
          Control de Turnos
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Gestión 24/7 de turnos, asistencia geolocalizada y jornales
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com.py"
                  className="block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-petroleum-600 focus:outline-none focus:ring-1 focus:ring-petroleum-600 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <Link
                  href="/recuperar"
                  className="text-xs font-medium text-petroleum-700 hover:text-petroleum-800 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-petroleum-600 focus:outline-none focus:ring-1 focus:ring-petroleum-600 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-petroleum-800 hover:bg-petroleum-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-petroleum-700 shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Quick Demo Access Bar (Solo visible en modo Demo explícito) */}
          {isDemoMode && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center mb-3">
                Accesos rápidos para demostración
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('aldo.samudio@empresa.com.py')}
                  className="w-full text-left p-2.5 rounded-xl border border-petroleum-100 bg-petroleum-50/60 hover:bg-petroleum-100/70 transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-petroleum-900 block">
                      Aldo Samudio (Administrador)
                    </span>
                    <span className="text-slate-500 text-[11px]">aldo.samudio@empresa.com.py</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-petroleum-700 text-white font-medium text-[10px]">
                    Admin
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('porfirio.gimenez@demo.com')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      Porfirio Giménez (Funcionario Mañana)
                    </span>
                    <span className="text-slate-500 text-[11px]">porfirio.gimenez@demo.com</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium text-[10px]">
                    Equipo A
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('edgar.romero@demo.com')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      Edgar Romero (Funcionario Volante)
                    </span>
                    <span className="text-slate-500 text-[11px]">edgar.romero@demo.com</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-[10px]">
                    Volante
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400 space-y-1">
          <p>Zona horaria oficial: America/Asuncion (Paraguay)</p>
          <p>Validación de asistencia geolocalizada con tolerancia de radio y precisión GPS.</p>
        </div>
      </div>
    </div>
  );
}
