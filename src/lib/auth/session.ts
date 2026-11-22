// src/lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { dbService } from '@/lib/db-service';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'control_turnos_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'CONFIG_ERROR: AUTH_SECRET (o JWT_SECRET) es obligatorio en producción y debe tener al menos 32 caracteres.'
      );
    }
  }
  return new TextEncoder().encode(secret || 'control-de-turnos-secret-key-development-minimum-32-chars!');
}

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'FUNCIONARIO';
  organizationId: string;
  organizationName: string;
  crewId?: string | null;
  isActive: boolean;
}

/**
 * Crea un token JWT firmado de sesión con duración de 7 días
 */
export async function createSessionToken(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

/**
 * Verifica y extrae el payload de una sesión
 */
export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as UserSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Obtiene la sesión activa desde las cookies del request del servidor.
 * Valida dinámicamente el estado actual del usuario en la base de datos para asegurar
 * que una cuenta desactivada pierda acceso de inmediato.
 */
export async function getSession(): Promise<UserSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  try {
    const freshUser = await dbService.getUser(session.userId);
    if (!freshUser || !freshUser.isActive) {
      // El funcionario fue dado de baja: se revoca la sesión de forma inmediata
      await clearSessionCookie();
      return null;
    }
  } catch {
    if (!session.isActive) return null;
  }

  return session;
}

/**
 * Establece la cookie de sesión HTTP-only
 */
export async function setSessionCookie(payload: UserSessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 días
  });
}

/**
 * Elimina la cookie de sesión (cierre de sesión)
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Guard de servidor: Requiere usuario autenticado y activo
 */
export async function requireAuth(): Promise<UserSessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

/**
 * Guard de servidor: Requiere rol de Administrador
 */
export async function requireAdmin(): Promise<UserSessionPayload> {
  const session = await requireAuth();
  if (session.role !== 'ADMIN') {
    throw new Error('FORBIDDEN_ADMIN_ONLY');
  }
  return session;
}
