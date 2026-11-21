// src/db/seed.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes('YOUR_SECRET_PASSWORD')) {
    console.log('ℹ️ DATABASE_URL no configurada para Neon Postgres. La aplicación utiliza el motor en memoria con datos de demostración completos.');
    return;
  }

  console.log('⚡ Conectando a Neon Postgres para sembrar datos...');
  const sql = neon(connectionString);
  const db = drizzle(sql, { schema });

  const orgId = 'org_mepy_2026';
  await db
    .insert(schema.organizations)
    .values({
      id: orgId,
      name: 'MEPY S.A. - Operaciones 24/7',
      slug: 'mepy-seguridad',
      nightHourStart: '20:00',
      nightHourEnd: '06:00',
      nightSurchargePercent: 30,
      workplaceName: 'Sede Central - Asunción',
      workplaceLat: -25.2867,
      workplaceLng: -57.647,
      geofenceRadiusMeters: 300,
      halfDayRuleConfirmed: false,
      hourlyRateRuleConfirmed: false,
    })
    .onConflictDoNothing();

  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.argv[2] || 'Control2026!';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(adminPassword, salt);

  await db
    .insert(schema.users)
    .values({
      id: 'user_admin',
      organizationId: orgId,
      name: 'Aldo Samudio',
      email: 'aldo.samudio@empresa.com.py',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    })
    .onConflictDoNothing();

  console.log(`✅ Base de datos inicializada en Neon Postgres.`);
  console.log(`👤 Administrador: Aldo Samudio (aldo.samudio@empresa.com.py)`);
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
