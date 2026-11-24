'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserX,
  UserCheck,
  Edit2,
  Copy,
  Check,
  Search,
  DollarSign,
  Shield,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'FUNCIONARIO';
  crewId: string | null;
  baseDailyWage: number;
  isActive: boolean;
  deactivatedAt?: string | null;
  phone?: string;
  documentNumber?: string;
}

interface Crew {
  id: string;
  name: string;
  color: string;
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeDeactivated, setIncludeDeactivated] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);

  // Form states
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCrewId, setInviteCrewId] = useState('');
  const [inviteLinkGenerated, setInviteLinkGenerated] = useState<string | null>(null);
  const [emailDeliveryStatus, setEmailDeliveryStatus] = useState<{ sent: boolean; message?: string } | null>(null);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit states
  const [editName, setEditName] = useState('');
  const [editCrewId, setEditCrewId] = useState('');
  const [editWage, setEditWage] = useState(120000);
  const [editPhone, setEditPhone] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff?includeDeactivated=${includeDeactivated}`);
      const data = await res.json();
      setStaff(data.staff || []);
      setCrews(data.crews || []);
    } catch (e) {
      console.error('Error cargando personal:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [includeDeactivated]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'INVITE',
          name: inviteName,
          email: inviteEmail,
          crewId: inviteCrewId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteLinkGenerated(data.inviteUrl);
        setEmailDeliveryStatus({
          sent: data.emailSent ?? true,
          message: data.emailError,
        });
        loadStaff();
      } else {
        alert(data.error || 'Error al invitar funcionario.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  const handleResendCurrentInvite = async () => {
    if (!inviteLinkGenerated) return;
    setResendingInvite(true);
    try {
      const url = new URL(inviteLinkGenerated);
      const token = url.searchParams.get('token');
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESEND_INVITATION', token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailDeliveryStatus({ sent: true });
        alert('Correo de invitación enviado exitosamente.');
      } else {
        alert(data.error || 'No se pudo enviar el correo.');
      }
    } catch {
      alert('Error de conexión al reintentar.');
    } finally {
      setResendingInvite(false);
    }
  };

  const handleDeactivate = async (user: StaffUser) => {
    if (
      !confirm(
        `¿Confirmás que querés desactivar a ${user.name}? Perderá acceso inmediato al sistema, pero su historial de turnos y marcaciones se conservará intacto.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DEACTIVATE', userId: user.id }),
      });
      if (res.ok) {
        loadStaff();
      }
    } catch {
      alert('Error al desactivar.');
    }
  };

  const handleReactivate = async (user: StaffUser) => {
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REACTIVATE', userId: user.id }),
      });
      if (res.ok) {
        loadStaff();
      }
    } catch {
      alert('Error al reactivar.');
    }
  };

  const handleOpenEdit = (user: StaffUser) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditCrewId(user.crewId || '');
    setEditWage(user.baseDailyWage || 120000);
    setEditPhone(user.phone || '');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE',
          userId: selectedUser.id,
          name: editName,
          crewId: editCrewId || null,
          baseDailyWage: editWage,
          phone: editPhone,
        }),
      });
      if (res.ok) {
        setIsEditOpen(false);
        loadStaff();
      }
    } catch {
      alert('Error al actualizar datos.');
    }
  };

  const filteredStaff = staff.filter((u) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.documentNumber && u.documentNumber.includes(term))
      );
    }
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-petroleum-700">
            Administración de Cuadrillas
          </span>
          <h1 className="text-2xl font-extrabold text-petroleum-950 mt-1">
            Gestión de Personal y Jornales
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Invitá funcionarios, asigná cuadrillas, definí jornales base y gestioná bajas preservando el historial.
          </p>
        </div>

        <button
          onClick={() => {
            setInviteName('');
            setInviteEmail('');
            setInviteCrewId('');
            setInviteLinkGenerated(null);
            setIsInviteOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 shadow-sm transition"
        >
          <UserPlus className="w-4 h-4 text-cyan-300" />
          Invitar Nuevo Funcionario
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, correo o cédula..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-petroleum-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeactivated}
              onChange={(e) => setIncludeDeactivated(e.target.checked)}
              className="rounded text-petroleum-700 focus:ring-petroleum-600"
            />
            <span>Mostrar funcionarios dados de baja ({staff.filter((u) => !u.isActive).length})</span>
          </label>
        </div>
      </div>

      {/* Tabla de Personal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Funcionario</th>
                <th className="py-3 px-4">Rol / Acceso</th>
                <th className="py-3 px-4">Cuadrilla Asignada</th>
                <th className="py-3 px-4 text-right">Jornal Base (PYG)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((u) => {
                const crew = crews.find((c) => c.id === u.crewId);
                const isAdmin = u.role === 'ADMIN';

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !u.isActive ? 'bg-slate-50/40 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{u.name}</span>
                        {isAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-petroleum-100 text-petroleum-800">
                            Aldo Samudio (Admin)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{u.email}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-700">
                        {isAdmin ? 'Administrador' : 'Funcionario'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {crew ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {crew.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sin cuadrilla</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-800">
                      {u.baseDailyWage ? `₲ ${u.baseDailyWage.toLocaleString('es-PY')}` : '-'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {u.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Dado de Baja
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        title="Modificar datos o jornal"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-petroleum-800 hover:bg-slate-100 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!isAdmin && (
                        <>
                          {u.isActive ? (
                            <button
                              onClick={() => handleDeactivate(u)}
                              title="Dar de baja / Desactivar cuenta"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(u)}
                              title="Reactivar cuenta"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Invitar Funcionario */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Invitar Nuevo Funcionario</h3>
            <p className="text-xs text-slate-500">
              El funcionario recibirá un enlace único para activar su cuenta y crear su contraseña sin registro público.
            </p>

            {inviteLinkGenerated ? (
              <div className="space-y-4 pt-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  <p className="font-bold">¡Invitación creada con éxito!</p>
                  <p className="mt-1">Compartí este enlace de activación con el funcionario:</p>
                </div>

                {emailDeliveryStatus && !emailDeliveryStatus.sent && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
                    <p className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      Aviso de entrega de correo
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {emailDeliveryStatus.message || 'El proveedor no pudo enviar el correo automático (falta RESEND_API_KEY o error del servicio).'}
                    </p>
                    <button
                      type="button"
                      disabled={resendingInvite}
                      onClick={handleResendCurrentInvite}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 transition disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                    >
                      {resendingInvite ? 'Reintentando...' : 'Reintentar envío de correo'}
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLinkGenerated}
                    className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLinkGenerated);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-2.5 rounded-xl bg-petroleum-800 text-white hover:bg-petroleum-900 transition flex items-center gap-1 text-xs font-semibold"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={() => setIsInviteOpen(false)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Listo, cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ej: Nelson Benítez"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="nelson.benitez@empresa.com.py"
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Cuadrilla inicial</label>
                  <select
                    value={inviteCrewId}
                    onChange={(e) => setInviteCrewId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                  >
                    <option value="">Sin cuadrilla (Asignar más tarde)</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 transition shadow-sm"
                  >
                    Generar enlace de invitación
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Editar Funcionario */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Editar Datos y Jornal Base</h3>
            <p className="text-xs text-slate-500">
              Modificá la cuadrilla o el valor del jornal base en Guaraníes (PYG).
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Cuadrilla asignada</label>
                <select
                  value={editCrewId}
                  onChange={(e) => setEditCrewId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                >
                  <option value="">Sin cuadrilla</option>
                  {crews.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Jornal Base Diario (PYG ₲)</label>
                <input
                  type="number"
                  step="1000"
                  required
                  value={editWage}
                  onChange={(e) => setEditWage(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-petroleum-600"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Referencia habitual: ₲ 120.000 / día (equiv. ₲ 15.000 / hora diurna)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-petroleum-800 text-white hover:bg-petroleum-900 transition shadow-sm"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
