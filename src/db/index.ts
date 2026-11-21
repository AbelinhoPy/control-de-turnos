// src/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

export const isDatabaseConfigured = Boolean(
  connectionString &&
  !connectionString.includes('YOUR_SECRET_PASSWORD') &&
  connectionString.startsWith('postgres')
);

// Conexión principal con Neon Serverless HTTP (optimizado para Vercel Edge / Serverless)
export const db = isDatabaseConfigured
  ? drizzle(neon(connectionString!), { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

export * from './schema';
