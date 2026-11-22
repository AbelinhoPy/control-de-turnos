// src/lib/auth/rate-limiter.ts
// Limitador de intentos para prevención de ataques de fuerza bruta

interface RateLimitRecord {
  count: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number; // Ventana de tiempo (ej. 15 minutos = 15 * 60 * 1000)
  blockDurationMs?: number; // Tiempo de bloqueo si supera el límite
}

/**
 * Comprueba y registra un intento
 * @returns { allowed: boolean, remainingAttempts: number, retryAfterSeconds?: number }
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 }
): { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record) {
    memoryStore.set(key, { count: 1, firstAttemptTime: now });
    return { allowed: true, remainingAttempts: options.maxAttempts - 1 };
  }

  // Si está bloqueado actualmente
  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // Si la ventana de tiempo expiró, reiniciar contador
  if (now - record.firstAttemptTime > options.windowMs) {
    memoryStore.set(key, { count: 1, firstAttemptTime: now });
    return { allowed: true, remainingAttempts: options.maxAttempts - 1 };
  }

  // Incrementar intento
  record.count += 1;

  if (record.count > options.maxAttempts) {
    record.blockedUntil = now + (options.blockDurationMs || options.windowMs);
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  return { allowed: true, remainingAttempts: options.maxAttempts - record.count };
}

/**
 * Limpia el registro tras un éxito (ej. login correcto)
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}
