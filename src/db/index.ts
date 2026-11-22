// src/db/index.ts
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import * as schema from './schema';

let activePool: Pool | null = null;
let activeDb: any = null;

export function isDatabaseConnected(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
    !url.includes('YOUR_SECRET_PASSWORD') &&
    (url.startsWith('postgres://') || url.startsWith('postgresql://'))
  );
}

export function isDemoModeEnabled(): boolean {
  return process.env.ENABLE_DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true';
}

export function assertDatabaseAvailable() {
  if (!isDatabaseConnected() && !isDemoModeEnabled()) {
    const error = new Error(
      'La base de datos Neon Postgres no está configurada en este entorno (DATABASE_URL no definida o inválida). ' +
      'Configure DATABASE_URL en su archivo .env.local o active explícitamente ENABLE_DEMO_MODE="true" para demostraciones con datos de prueba.'
    );
    (error as unknown as { code: string }).code = 'DB_NOT_CONFIGURED';
    throw error;
  }
}

export function getPool(): Pool | null {
  return activePool;
}

export function getDb() {
  if (!isDatabaseConnected()) {
    return null;
  }

  const url = process.env.DATABASE_URL!;
  if (url.includes('neon.tech') && !url.includes('localhost')) {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  }

  if (!activePool || (activePool as any)._ending || (activePool as any).ended) {
    activePool = new Pool({ connectionString: url });
    activeDb = drizzleNodePg(activePool, { schema });
  }

  return activeDb;
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    const realDb = getDb();
    if (!realDb) {
      assertDatabaseAvailable();
      return undefined;
    }
    return (realDb as any)[prop];
  },
});

export const isDatabaseConfigured = isDatabaseConnected;

export * from './schema';
