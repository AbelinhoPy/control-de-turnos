// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbService } from '@/lib/db-service';
import { setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit, resetRateLimit } from '@/lib/auth/rate-limiter';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su correo electrónico y contraseña.' },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimitKey = `login:${clientIp}:${email.toLowerCase().trim()}`;
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Demasiados intentos fallidos. Por seguridad, intente nuevamente en ${rateCheck.retryAfterSeconds} segundos.`,
        },
        { status: 429 }
      );
    }

    const user = await dbService.getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifique su correo y contraseña.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: 'Su cuenta se encuentra desactivada. Comuníquese con la administración para más información.',
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

    // Login exitoso: reiniciar contador de intentos
    resetRateLimit(rateLimitKey);

    const org = await dbService.getOrganization(user.organizationId);

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

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        crewId: user.crewId,
      },
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al intentar iniciar sesión.' },
      { status: 500 }
    );
  }
}
