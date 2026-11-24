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
    const invitations = await dbService.listInvitations(session.organizationId);

    return NextResponse.json({ staff, crews, invitations });
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
    const { action, userId, name, email, crewId, baseDailyWage, phone, documentNumber, invitationId, token: inputToken } = body;

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

      // Enviar correo de invitación comprobando el resultado real
      const emailResult = await sendInvitationEmail(email, inviteUrl, name, session.name);

      const message = emailResult.success
        ? 'Invitación generada y enviada exitosamente al correo del funcionario.'
        : 'Invitación creada, pero el proveedor no pudo entregar el correo automático. Puede compartir el enlace manualmente o reintentar el envío.';

      return NextResponse.json({
        success: true,
        emailSent: emailResult.success,
        emailError: !emailResult.success
          ? emailResult.error || (emailResult.reason === 'PROVIDER_NOT_CONFIGURED' ? 'Proveedor de correo no configurado (falta RESEND_API_KEY).' : 'Error del proveedor de correo.')
          : undefined,
        message,
        invitation,
        inviteUrl, // Se provee al admin en la UI como respaldo
      });
    }

    // 1.1 Reintentar envío de correo de invitación
    if (action === 'RESEND_INVITATION') {
      let invitation = null;
      if (inputToken) {
        invitation = await dbService.getInvitationByToken(inputToken);
      } else if (invitationId) {
        invitation = await dbService.getInvitationById(invitationId);
      }

      if (!invitation || invitation.acceptedAt || new Date() > invitation.expiresAt) {
        return NextResponse.json({ error: 'La invitación no existe, ya fue aceptada o ha expirado.' }, { status: 400 });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteUrl = `${appUrl}/invitacion?token=${invitation.token}`;
      const emailResult = await sendInvitationEmail(invitation.email, inviteUrl, invitation.name, session.name);

      if (!emailResult.success) {
        return NextResponse.json({
          success: false,
          error: emailResult.error || 'No se pudo entregar el correo electrónico mediante el proveedor.',
          inviteUrl,
        }, { status: 502 });
      }

      return NextResponse.json({
        success: true,
        message: 'Correo de invitación reenviado exitosamente.',
        inviteUrl,
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
