// src/app/api/auth/invitation/route.ts
import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  const inv = dataStore.getInvitationByToken(token);
  if (!inv) {
    return NextResponse.json({ error: 'La invitación es inválida o ha expirado.' }, { status: 404 });
  }

  const org = dataStore.getOrganization(inv.organizationId);

  return NextResponse.json({
    valid: true,
    invitation: {
      name: inv.name,
      email: inv.email,
      role: inv.role,
      organizationName: org.name,
    },
  });
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

    const user = dataStore.acceptInvitation(token, password);
    return NextResponse.json({
      success: true,
      message: 'Cuenta activada correctamente. Ahora puede iniciar sesión con su correo.',
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al activar invitación.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
