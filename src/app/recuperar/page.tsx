'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REQUEST', email }),
      });
      const data = await res.json();
      setStatus('success');
      setMessage(data.message || 'Se ha generado la solicitud de recuperación.');
    } catch {
      setStatus('error');
      setMessage('Error al procesar la solicitud.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 bg-petroleum-800 rounded-2xl flex items-center justify-center text-white shadow-md">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-petroleum-950">
          Recuperar Contraseña
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Ingresá tu correo para recibir las instrucciones de acceso
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10">
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm text-slate-700">{message}</p>
              <Link
                href="/login"
                className="inline-block mt-4 text-xs font-semibold text-petroleum-700 hover:underline"
              >
                Volver a inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com.py"
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-petroleum-600 focus:outline-none focus:ring-1 focus:ring-petroleum-600 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-petroleum-800 hover:bg-petroleum-900 transition shadow-sm"
              >
                {status === 'loading' ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Regresar al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
