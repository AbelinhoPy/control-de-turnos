// src/db/seed.ts
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { like, inArray } from 'drizzle-orm';
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

  // Contraseña estándar para entrega y operación inicial
  const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Control2026!';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPassword, salt);

  // 1. Administrador General
  await db
    .insert(schema.users)
    .values({
      id: 'user_admin',
      organizationId: orgId,
      name: 'Aldo Samudio',
      email: 'aldo.samudio@empresa.com.py',
      passwordHash,
      role: 'ADMIN',
      documentNumber: '1.234.567',
      phone: '+595 981 100 200',
      baseDailyWage: 0,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { passwordHash, isActive: true, role: 'ADMIN' },
    });

  // 2. Personal Operativo de las 4 Cuadrillas
  const operationalStaff = [
    // Cuadrilla A (Mañana Fijo 06:00 a 14:00)
    {
      id: 'user_p1',
      organizationId: orgId,
      name: 'Porfirio Giménez',
      email: 'porfirio.gimenez@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_a',
      documentNumber: '3.456.789',
      phone: '+595 981 200 301',
      baseDailyWage: 120000,
      isActive: true,
    },
    {
      id: 'user_p2',
      organizationId: orgId,
      name: 'David Rojas',
      email: 'david.rojas@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_a',
      documentNumber: '4.123.456',
      phone: '+595 981 200 302',
      baseDailyWage: 120000,
      isActive: true,
    },
    // Cuadrilla B (Tarde Fijo 14:00 a 22:00)
    {
      id: 'user_p3',
      organizationId: orgId,
      name: 'Rubén Cáceres',
      email: 'ruben.caceres@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_b',
      documentNumber: '2.987.654',
      phone: '+595 981 200 303',
      baseDailyWage: 120000,
      isActive: true,
    },
    {
      id: 'user_p4',
      organizationId: orgId,
      name: 'Mario Ayala',
      email: 'mario.ayala@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_b',
      documentNumber: '3.789.012',
      phone: '+595 981 200 304',
      baseDailyWage: 120000,
      isActive: true,
    },
    // Cuadrilla C (Noche Fijo 22:00 a 06:00)
    {
      id: 'user_p5',
      organizationId: orgId,
      name: 'Darío Fernández',
      email: 'dario.fernandez@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_c',
      documentNumber: '4.567.890',
      phone: '+595 981 200 305',
      baseDailyWage: 130000,
      isActive: true,
    },
    {
      id: 'user_p6',
      organizationId: orgId,
      name: 'Ariel Martínez',
      email: 'ariel.martinez@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_c',
      documentNumber: '5.123.789',
      phone: '+595 981 200 306',
      baseDailyWage: 130000,
      isActive: true,
    },
    // Cuadrilla D (Volante Rotativo 2M-2T-2N-2L)
    {
      id: 'user_p7',
      organizationId: orgId,
      name: 'Edgar Romero',
      email: 'edgar.romero@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_d',
      documentNumber: '3.654.321',
      phone: '+595 981 200 307',
      baseDailyWage: 125000,
      isActive: true,
    },
    {
      id: 'user_p8',
      organizationId: orgId,
      name: 'Marcelo Benítez',
      email: 'marcelo.benitez@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_d',
      documentNumber: '4.890.123',
      phone: '+595 981 200 308',
      baseDailyWage: 125000,
      isActive: true,
    },
    // Funcionario de ejemplo dado de baja (conserva historial)
    {
      id: 'user_p9_desactivado',
      organizationId: orgId,
      name: 'Carlos Duarte (Baja)',
      email: 'carlos.duarte@empresa.com.py',
      passwordHash,
      role: 'FUNCIONARIO' as const,
      crewId: 'crew_a',
      documentNumber: '2.345.678',
      phone: '+595 981 200 309',
      baseDailyWage: 110000,
      isActive: false,
    },
  ];

  for (const staff of operationalStaff) {
    await db
      .insert(schema.users)
      .values(staff)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          name: staff.name,
          email: staff.email,
          passwordHash: staff.passwordHash,
          crewId: staff.crewId,
          documentNumber: staff.documentNumber,
          phone: staff.phone,
          baseDailyWage: staff.baseDailyWage,
          isActive: staff.isActive,
        },
      });
  }

  // 3. Generar turnos publicados para el mes actual (noviembre 2026)
  const currentYear = 2026;
  const currentMonth = 11;
  const daysInMonth = 30;

  for (const staff of operationalStaff.filter((s) => s.isActive)) {
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      let templateId = 'shift_m';

      if (staff.crewId === 'crew_a') {
        templateId = 'shift_m';
      } else if (staff.crewId === 'crew_b') {
        templateId = 'shift_t';
      } else if (staff.crewId === 'crew_c') {
        templateId = 'shift_n';
      } else if (staff.crewId === 'crew_d') {
        // Volante rotativo: ciclo de 8 días (2M, 2T, 2N, 2L)
        const cycleDay = (day - 1) % 8;
        if (cycleDay < 2) templateId = 'shift_m';
        else if (cycleDay < 4) templateId = 'shift_t';
        else if (cycleDay < 6) templateId = 'shift_n';
        else templateId = 'shift_l';
      }

      await db
        .insert(schema.shifts)
        .values({
          id: `shift_${staff.id}_${dateStr}`,
          organizationId: orgId,
          userId: staff.id,
          crewId: staff.crewId,
          shiftTemplateId: templateId,
          date: dateStr,
          isPublished: true,
          publishedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }

  // 4. Limpieza de usuarios temporales de tests
  try {
    const testUsers = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(like(schema.users.email, '%_1795%'));

    if (testUsers.length > 0) {
      const testIds = testUsers.map((u: any) => u.id);
      await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.userId, testIds));
      await db.delete(schema.attendanceIncidents).where(inArray(schema.attendanceIncidents.userId, testIds));
      await db.delete(schema.attendances).where(inArray(schema.attendances.userId, testIds));
      await db.delete(schema.shifts).where(inArray(schema.shifts.userId, testIds));
      await db.delete(schema.users).where(inArray(schema.users.id, testIds));
    }
  } catch (cleanErr) {
    console.warn('Advertencia durante limpieza de tests:', cleanErr);
  }

  if (pool) {
    await pool.end();
  }

  console.log(`✅ Base de datos inicializada exitosamente.`);
  console.log(`👤 Administrador: Aldo Samudio (aldo.samudio@empresa.com.py) | Clave: ${defaultPassword}`);
  console.log(`👥 Funcionarios activos sembrados: ${operationalStaff.filter((s) => s.isActive).length} funcionarios con turnos publicados.`);
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
