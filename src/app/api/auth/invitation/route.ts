// src/app/api/auth/invitation/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbService } from '@/lib/db-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const inv = await dbService.getInvitationByToken(token);
    if (!inv || inv.acceptedAt || new Date() > inv.expiresAt) {
      return NextResponse.json({ error: 'La invitación es inválida o ha expirado.' }, { status: 404 });
    }

    const org = await dbService.getOrganization(inv.organizationId);

    return NextResponse.json({
      valid: true,
      invitation: {
        name: inv.name,
        email: inv.email,
        role: inv.role,
        organizationName: org.name,
      },
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error al consultar la invitación.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Debe ingresar una contraseña segura de al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const user = await dbService.acceptInvitation(token, passwordHash);
    return NextResponse.json({
      success: true,
      message: 'Cuenta activada correctamente. Ahora puede iniciar sesión con su correo.',
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const msg = error instanceof Error ? error.message : 'Error al activar invitación.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
