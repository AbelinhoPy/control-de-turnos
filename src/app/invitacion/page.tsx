'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

function InvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{
    name: string;
    email: string;
    role: string;
    organizationName: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Falta el token de invitación en el enlace.');
      setLoading(false);
      return;
    }

    fetch(`/api/auth/invitation?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setInvitation(data.invitation);
        } else {
          setError(data.error || 'La invitación es inválida o ha expirado.');
        }
      })
      .catch(() => setError('Error al verificar la invitación.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al activar cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Verificando invitación...
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Invitación No Válida</h3>
        <p className="text-sm text-slate-600">{error}</p>
        <Link
          href="/login"
          className="inline-block mt-4 text-xs font-semibold text-petroleum-700 hover:underline"
        >
          Ir a inicio de sesión
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">¡Cuenta Activada!</h3>
        <p className="text-sm text-slate-600">
          Tu cuenta ha sido creada exitosamente. Ya podés ingresar al sistema de control de turnos.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-petroleum-800 hover:bg-petroleum-900 transition shadow-sm"
        >
          Iniciar sesión ahora
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-6 shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10">
      <div className="mb-6 pb-4 border-b border-slate-100">
        <span className="text-xs font-semibold text-petroleum-700 uppercase tracking-wider block">
          Invitación de empresa
        </span>
        <h3 className="text-lg font-bold text-slate-900">{invitation?.organizationName}</h3>
        <p className="text-sm text-slate-500 mt-1">
          Bienvenido, <strong className="text-slate-800">{invitation?.name}</strong>. Creá tu
          contraseña para activar tu usuario ({invitation?.email}).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700">Contraseña nueva</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-petroleum-600 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Confirmar contraseña</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repetí la contraseña"
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-petroleum-600 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-petroleum-800 hover:bg-petroleum-900 transition shadow-sm flex items-center justify-center gap-2"
        >
          {submitting ? 'Activando...' : 'Activar mi cuenta y comenzar'}
          {!submitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

export default function InvitationPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-petroleum-800 rounded-2xl flex items-center justify-center text-white shadow-md">
          <Clock className="w-6 h-6" />
        </div>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-petroleum-950">
          Activar Cuenta de Funcionario
        </h2>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center text-sm text-slate-500">Cargando...</div>}>
          <InvitationForm />
        </Suspense>
      </div>
    </div>
  );
}
