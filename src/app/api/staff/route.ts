// src/app/api/staff/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeDeactivated = searchParams.get('includeDeactivated') === 'true';

  const staff = dataStore.listUsers(session.organizationId, includeDeactivated);
  const crews = dataStore.listCrews(session.organizationId);

  return NextResponse.json({ staff, crews });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden gestionar personal.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, userId, name, email, crewId, baseDailyWage, phone, documentNumber } = body;

    // 1. Invitar nuevo funcionario
    if (action === 'INVITE') {
      if (!name || !email) {
        return NextResponse.json({ error: 'Nombre y correo son obligatorios para invitar.' }, { status: 400 });
      }

      const existing = dataStore.getUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un usuario con este correo electrónico.' }, { status: 400 });
      }

      const invitation = dataStore.createInvitation({
        organizationId: session.organizationId,
        email,
        name,
        role: 'FUNCIONARIO',
        crewId: crewId || null,
        invitedByUserId: session.userId,
      });

      dataStore.createAuditLog({
        organizationId: session.organizationId,
        userId: session.userId,
        userName: session.name,
        action: 'STAFF_INVITED',
        entity: 'invitations',
        entityId: invitation.id,
        details: { email, name, crewId },
      });

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitacion?token=${invitation.token}`;

      return NextResponse.json({
        success: true,
        message: 'Invitación generada exitosamente.',
        invitation,
        inviteUrl,
      });
    }

    // 2. Modificar funcionario
    if (action === 'UPDATE') {
      if (!userId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      const updated = dataStore.updateUser(userId, {
        name,
        crewId,
        baseDailyWage: baseDailyWage ? Number(baseDailyWage) : undefined,
        phone,
        documentNumber,
      });

      return NextResponse.json({ success: true, user: updated });
    }

    // 3. Desactivar funcionario
    if (action === 'DEACTIVATE') {
      if (!userId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      const deactivated = dataStore.deactivateUser(userId);
      dataStore.createAuditLog({
        organizationId: session.organizationId,
        userId: session.userId,
        userName: session.name,
        action: 'STAFF_DEACTIVATED',
        entity: 'users',
        entityId: userId,
        details: { name: deactivated.name },
      });

      return NextResponse.json({
        success: true,
        message: `${deactivated.name} ha sido desactivado. Su acceso ha sido revocado y sus registros históricos se conservan.`,
        user: deactivated,
      });
    }

    // 4. Reactivar funcionario
    if (action === 'REACTIVATE') {
      if (!userId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      const reactivated = dataStore.reactivateUser(userId);
      return NextResponse.json({
        success: true,
        message: `${reactivated.name} ha sido reactivado exitosamente.`,
        user: reactivated,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error en gestión de personal:', error);
    return NextResponse.json({ error: 'Error procesando la solicitud de personal.' }, { status: 500 });
  }
}
