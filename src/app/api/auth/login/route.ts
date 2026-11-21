// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dataStore } from '@/lib/data-store';
import { setSessionCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su correo electrónico y contraseña.' },
        { status: 400 }
      );
    }

    const user = dataStore.getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifique su correo y contraseña.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error:
            'Su cuenta se encuentra desactivada. Comuníquese con la administración para más información.',
        },
        { status: 403 }
      );
    }

    const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifique su correo y contraseña.' },
        { status: 401 }
      );
    }

    const org = dataStore.getOrganization(user.organizationId);

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: org.name,
      crewId: user.crewId,
      isActive: user.isActive,
    });

    dataStore.createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entity: 'users',
      entityId: user.id,
      details: { role: user.role },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        crewId: user.crewId,
      },
      redirectUrl: user.role === 'ADMIN' ? '/admin' : '/funcionario',
    });
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado al procesar el inicio de sesión.' },
      { status: 500 }
    );
  }
}
