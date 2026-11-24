// src/app/api/auth/reset/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbService } from '@/lib/db-service';
import { checkRateLimit } from '@/lib/auth/rate-limiter';
import { sendPasswordResetEmail } from '@/lib/email/email-service';

export async function POST(request: Request) {
  try {
    const { action, email, token, newPassword } = await request.json();
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    if (action === 'REQUEST') {
      if (!email) {
        return NextResponse.json({ error: 'Ingrese su correo electrónico.' }, { status: 400 });
      }

      const rateCheck = checkRateLimit(`reset:${clientIp}:${email.toLowerCase().trim()}`, {
        maxAttempts: 3,
        windowMs: 15 * 60 * 1000,
        blockDurationMs: 15 * 60 * 1000,
      });

      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            error: `Demasiadas solicitudes de recuperación. Intente nuevamente en ${rateCheck.retryAfterSeconds} segundos.`,
          },
          { status: 429 }
        );
      }

      const resetData = await dbService.createPasswordReset(email);

      if (resetData) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/recuperar?token=${resetData.token}`;
        const emailResult = await sendPasswordResetEmail(email, resetUrl, resetData.userName);
        if (!emailResult.success) {
          console.warn(`[PasswordReset] No se pudo entregar correo de recuperación: ${emailResult.reason || 'ERROR'}`);
        }
      }

      // NUNCA devolvemos el enlace en la respuesta HTTP para evitar exposición de seguridad
      return NextResponse.json({
        success: true,
        message: 'Si el correo electrónico está registrado, se han enviado las instrucciones de restablecimiento.',
      });
    }

    if (action === 'RESET') {
      if (!token || !newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Token y una nueva contraseña de al menos 6 caracteres son requeridos.' },
          { status: 400 }
        );
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);

      const success = await dbService.resetPasswordWithToken(token, passwordHash);
      if (!success) {
        return NextResponse.json(
          { error: 'El enlace de recuperación es inválido, ya fue utilizado o ha expirado.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Su contraseña ha sido actualizada exitosamente. Ahora puede iniciar sesión con su nueva clave.',
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error en recuperación:', error);
    return NextResponse.json({ error: 'Error procesando solicitud de contraseña.' }, { status: 500 });
  }
}
