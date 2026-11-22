// src/app/api/staff/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';
import { sendInvitationEmail } from '@/lib/email/email-service';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo administradores pueden consultar personal.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeDeactivated = searchParams.get('includeDeactivated') === 'true';

    const staff = await dbService.listUsers(session.organizationId, includeDeactivated);
    const crews = await dbService.listCrews(session.organizationId);

    return NextResponse.json({ staff, crews });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error al listar personal.' }, { status: 500 });
  }
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

      const existing = await dbService.getUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: 'Ya existe un usuario con este correo electrónico.' }, { status: 400 });
      }

      const invitation = await dbService.createInvitation({
        organizationId: session.organizationId,
        email,
        name,
        role: 'FUNCIONARIO',
        crewId: crewId || null,
        invitedByUserId: session.userId,
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteUrl = `${appUrl}/invitacion?token=${invitation.token}`;

      // Enviar correo de invitación
      await sendInvitationEmail(email, inviteUrl, name, session.name);

      return NextResponse.json({
        success: true,
        message: 'Invitación generada y enviada exitosamente al correo del funcionario.',
        invitation,
        inviteUrl, // Se provee al admin en la UI como respaldo
      });
    }

    // 2. Modificar funcionario
    if (action === 'UPDATE') {
      if (!userId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      const updated = await dbService.updateUser(userId, {
        name,
        crewId,
        baseDailyWage: baseDailyWage !== undefined ? Number(baseDailyWage) : undefined,
        phone,
        documentNumber,
      });

      return NextResponse.json({ success: true, user: updated });
    }

    // 3. Desactivar funcionario (Baja inmediata)
    if (action === 'DEACTIVATE') {
      if (!userId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      await dbService.deactivateUser(userId, session.userId);
      const user = await dbService.getUser(userId);

      return NextResponse.json({
        success: true,
        message: `${user?.name || 'El funcionario'} ha sido dado de baja. Su sesión activa ha sido revocada inmediatamente y su historial se conserva íntegro.`,
        user,
      });
    }

    // 4. Reactivar funcionario
    if (action === 'REACTIVATE') {
      if (!userId) {
        return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
      }

      const updated = await dbService.updateUser(userId, { isActive: true });
      return NextResponse.json({
        success: true,
        message: `${updated?.name || 'El funcionario'} ha sido reactivado exitosamente.`,
        user: updated,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error en gestión de personal:', error);
    return NextResponse.json({ error: 'Error procesando la solicitud de personal.' }, { status: 500 });
  }
}
