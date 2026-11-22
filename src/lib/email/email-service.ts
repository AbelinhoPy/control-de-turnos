// src/lib/email/email-service.ts
// Servicio de correo transaccional para invitaciones y recuperación de contraseñas

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'Control de Turnos <notificaciones@empresa.com.py>';

  if (apiKey && !apiKey.startsWith('re_sample')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('❌ Error enviando correo vía Resend:', errorData);
        return { success: false };
      }

      const data = await res.json();
      return { success: true, id: data.id };
    } catch (err) {
      console.error('❌ Excepción enviando correo:', err);
      return { success: false };
    }
  }

  // Modo desarrollo / demo / sin clave de correo
  console.log(`\n📨 [SIMULADOR DE CORREO TRANSACCIONAL]`);
  console.log(`Para: ${options.to}`);
  console.log(`Asunto: ${options.subject}`);
  console.log(`Contenido:\n${options.text || options.html}`);
  console.log(`-------------------------------------------------\n`);

  return { success: true, id: `mock_${Date.now()}` };
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, userName: string): Promise<boolean> {
  const subject = 'Restablecimiento de contraseña - Control de Turnos';
  const text = `Hola ${userName},\n\nHas solicitado restablecer tu contraseña para ingresar a Control de Turnos.\nAccede al siguiente enlace para crear tu nueva contraseña (válido por 1 hora):\n\n${resetUrl}\n\nSi no realizaste esta solicitud, puedes ignorar este mensaje.\n`;
  const html = `
    <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
      <h2 style="color: #0F4F5F; margin-top: 0;">Control de Turnos 24/7</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
      <div style="margin: 25px 0;">
        <a href="${resetUrl}" style="background-color: #0F4F5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Restablecer Contraseña
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Este enlace es de un solo uso y vencerá en 1 hora.</p>
      <p style="color: #64748b; font-size: 13px;">Si no solicitaste este cambio, no es necesario realizar ninguna acción.</p>
    </div>
  `;

  const result = await sendTransactionalEmail({ to: email, subject, text, html });
  return result.success;
}

export async function sendInvitationEmail(email: string, inviteUrl: string, userName: string, inviterName: string): Promise<boolean> {
  const subject = 'Invitación para unirte a Control de Turnos';
  const text = `Hola ${userName},\n\n${inviterName} te ha invitado a formar parte de Control de Turnos.\nAccede al siguiente enlace para activar tu cuenta y configurar tu contraseña:\n\n${inviteUrl}\n`;
  const html = `
    <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
      <h2 style="color: #0F4F5F; margin-top: 0;">Control de Turnos 24/7</h2>
      <p>Hola <strong>${userName}</strong>,</p>
      <p><strong>${inviterName}</strong> te ha invitado a unirte a la plataforma para el registro de turnos y asistencias.</p>
      <div style="margin: 25px 0;">
        <a href="${inviteUrl}" style="background-color: #0F4F5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Aceptar Invitación y Crear Contraseña
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Este enlace es personal e intransferible.</p>
    </div>
  `;

  const result = await sendTransactionalEmail({ to: email, subject, text, html });
  return result.success;
}
