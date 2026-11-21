'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Clock,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  Settings,
  LogOut,
  Building2,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  userName: string;
  userEmail: string;
  orgName: string;
}

export function AdminSidebar({ userName, userEmail, orgName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    {
      name: 'Panel Principal',
      href: '/admin',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Planificación de Turnos',
      href: '/admin/turnos',
      icon: CalendarDays,
    },
    {
      name: 'Cuadrillas y Equipos',
      href: '/admin/cuadrillas',
      icon: Users,
    },
    {
      name: 'Personal y Funcionarios',
      href: '/admin/personal',
      icon: Users,
    },
    {
      name: 'Control de Asistencia',
      href: '/admin/asistencia',
      icon: ClipboardCheck,
    },
    {
      name: 'Módulo de Reportes',
      href: '/admin/reportes',
      icon: FileSpreadsheet,
      highlight: true,
    },
    {
      name: 'Cierres de Período',
      href: '/admin/cierres',
      icon: Lock,
    },
    {
      name: 'Configuración y Sede',
      href: '/admin/configuracion',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-petroleum-950 text-slate-200 flex flex-col flex-shrink-0 h-screen sticky top-0 border-r border-petroleum-900 shadow-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-petroleum-900 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-petroleum-800 flex items-center justify-center text-white shadow-inner">
          <Clock className="w-6 h-6 text-cyan-300" />
        </div>
        <div>
          <h1 className="font-bold text-sm text-white tracking-tight">Control de Turnos</h1>
          <p className="text-[11px] text-cyan-200/60 truncate max-w-[150px]">{orgName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider uppercase text-petroleum-400">
          Operaciones 24/7
        </div>
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-petroleum-800 text-white shadow-sm ring-1 ring-white/10 font-semibold'
                  : 'text-slate-300 hover:bg-petroleum-900/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.highlight && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-400/20 text-cyan-300">
                  Excel/PDF
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-petroleum-900 bg-petroleum-950/80">
        <div className="p-3 rounded-xl bg-petroleum-900/70 border border-petroleum-800/80 flex items-center justify-between">
          <div className="truncate mr-2">
            <span className="block text-xs font-bold text-white truncate">{userName}</span>
            <span className="block text-[11px] text-cyan-300/80">Administrador</span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/50 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
