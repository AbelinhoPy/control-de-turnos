// src/db/seed.ts
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import * as schema from './schema';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
    console.error('❌ Error: DATABASE_URL no está configurada o contiene valores de ejemplo en .env');
    process.exit(1);
  }

  let db: any;
  let pool: Pool | null = null;

  if (connectionString.includes('neon.tech') && !connectionString.includes('localhost')) {
    const sql = neon(connectionString);
    db = drizzleNeon(sql, { schema });
  } else {
    pool = new Pool({ connectionString });
    db = drizzleNodePg(pool, { schema });
  }

  console.log('🌱 Sembrando datos esenciales en PostgreSQL...');

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
      workplaceName: 'Sede Operativa - Minga Guazú',
      workplaceLat: -25.496469,
      workplaceLng: -54.789641,
      geofenceRadiusMeters: 300,
      halfDayRuleConfirmed: false,
      hourlyRateRuleConfirmed: false,
    })
    .onConflictDoNothing();

  // Plantillas de turnos (Mañana, Tarde, Noche, Libre)
  await db
    .insert(schema.shiftTemplates)
    .values([
      {
        id: 'shift_m',
        organizationId: orgId,
        code: 'M',
        name: 'Mañana',
        startTime: '06:00',
        endTime: '14:00',
        durationHours: '8',
        crossesMidnight: false,
        targetHeadcount: 2,
        colorClass: 'bg-blue-100 text-blue-800 border-blue-300',
      },
      {
        id: 'shift_t',
        organizationId: orgId,
        code: 'T',
        name: 'Tarde',
        startTime: '14:00',
        endTime: '22:00',
        durationHours: '8',
        crossesMidnight: false,
        targetHeadcount: 2,
        colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      },
      {
        id: 'shift_n',
        organizationId: orgId,
        code: 'N',
        name: 'Noche',
        startTime: '22:00',
        endTime: '06:00',
        durationHours: '8',
        crossesMidnight: true,
        targetHeadcount: 2,
        colorClass: 'bg-purple-100 text-purple-800 border-purple-300',
      },
      {
        id: 'shift_l',
        organizationId: orgId,
        code: 'L',
        name: 'Libre',
        startTime: null,
        endTime: null,
        durationHours: '0',
        crossesMidnight: false,
        targetHeadcount: 0,
        colorClass: 'bg-slate-100 text-slate-600 border-slate-300',
      },
    ])
    .onConflictDoNothing();

  // Cuadrillas iniciales
  await db
    .insert(schema.crews)
    .values([
      { id: 'crew_a', organizationId: orgId, name: 'Cuadrilla A (Mañana Fijo)', code: 'A', type: 'FIXED', color: 'Azul', badgeColorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
      { id: 'crew_b', organizationId: orgId, name: 'Cuadrilla B (Tarde Fijo)', code: 'B', type: 'FIXED', color: 'Verde', badgeColorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { id: 'crew_c', organizationId: orgId, name: 'Cuadrilla C (Noche Fijo)', code: 'C', type: 'FIXED', color: 'Violeta', badgeColorClass: 'bg-purple-100 text-purple-800 border-purple-300' },
      { id: 'crew_d', organizationId: orgId, name: 'Cuadrilla D (Volante 2M-2T-2N-2L)', code: 'D', type: 'ROTATING', color: 'Ámbar', badgeColorClass: 'bg-amber-100 text-amber-800 border-amber-300' },
    ])
    .onConflictDoNothing();

  // Generación segura de contraseña para el primer administrador
  let adminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.argv[2];
  let isGenerated = false;

  if (!adminPassword) {
    adminPassword = crypto.randomBytes(12).toString('base64url');
    isGenerated = true;
  }

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

  if (pool) {
    await pool.end();
  }

  console.log(`✅ Base de datos inicializada exitosamente.`);
  console.log(`👤 Administrador: Aldo Samudio (aldo.samudio@empresa.com.py)`);
  if (isGenerated) {
    console.log(`🔑 Contraseña generada automáticamente: ${adminPassword}`);
    console.log(`⚠️  Guarde esta contraseña ahora. No se volverá a mostrar.`);
  } else {
    console.log(`🔑 Contraseña configurada mediante variable de entorno / parámetro.`);
  }
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
