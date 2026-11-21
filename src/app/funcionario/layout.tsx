import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import Link from 'next/link';
import { Clock, History, AlertCircle, LogOut } from 'lucide-react';

export default async function FuncionarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 sm:pb-6">
      {/* Top Mobile Bar */}
      <header className="bg-petroleum-950 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-petroleum-800 flex items-center justify-center text-cyan-300">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight">Control de Turnos</h1>
            <p className="text-[10px] text-cyan-200/70">{session.name}</p>
          </div>
        </div>

        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-petroleum-900 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col">
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-50 flex items-center justify-around py-2 shadow-lg">
        <Link
          href="/funcionario"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-petroleum-800"
        >
          <Clock className="w-5 h-5" />
          <span>Marcar</span>
        </Link>

        <Link
          href="/funcionario/historial"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-petroleum-800"
        >
          <History className="w-5 h-5" />
          <span>Mi Historial</span>
        </Link>

        <Link
          href="/funcionario/incidencias"
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-petroleum-800"
        >
          <AlertCircle className="w-5 h-5" />
          <span>Mis Revisiones</span>
        </Link>
      </nav>
    </div>
  );
}
