// src/app/api/auth/reset/route.ts
import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/data-store';

export async function POST(request: Request) {
  try {
    const { action, email, token, newPassword } = await request.json();

    if (action === 'REQUEST') {
      if (!email) {
        return NextResponse.json({ error: 'Ingrese su correo electrónico.' }, { status: 400 });
      }

      const resetData = dataStore.createPasswordReset(email);
      // En un entorno de producción, aquí se enviaría el correo con Resend/SMTP
      return NextResponse.json({
        success: true,
        message: 'Si el correo está registrado, se ha generado un enlace para restablecer la contraseña.',
        resetUrl: resetData
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/recuperar?token=${resetData.token}`
          : undefined,
      });
    }

    if (action === 'RESET') {
      if (!token || !newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Token y una nueva contraseña de al menos 6 caracteres son requeridos.' },
          { status: 400 }
        );
      }

      const success = dataStore.resetPasswordWithToken(token, newPassword);
      if (!success) {
        return NextResponse.json(
          { error: 'El enlace de recuperación es inválido o ha expirado.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Su contraseña ha sido actualizada exitosamente. Ahora puede iniciar sesión.',
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error en recuperación:', error);
    return NextResponse.json({ error: 'Error procesando solicitud de contraseña.' }, { status: 500 });
  }
}
