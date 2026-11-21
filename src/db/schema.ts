// src/db/schema.ts
import { pgTable, text, timestamp, boolean, integer, doublePrecision, numeric, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Organizaciones (SaaS Multi-tenant listo)
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  nightHourStart: text('night_hour_start').notNull().default('20:00'),
  nightHourEnd: text('night_hour_end').notNull().default('06:00'),
  nightSurchargePercent: integer('night_surcharge_percent').notNull().default(30),
  workplaceName: text('workplace_name').notNull().default('Sede Central - Asunción'),
  workplaceLat: doublePrecision('workplace_lat').notNull().default(-25.2867),
  workplaceLng: doublePrecision('workplace_lng').notNull().default(-57.6470),
  geofenceRadiusMeters: integer('geofence_radius_meters').notNull().default(300),
  halfDayRuleConfirmed: boolean('half_day_rule_confirmed').notNull().default(false),
  hourlyRateRuleConfirmed: boolean('hourly_rate_rule_confirmed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 2. Cuadrillas (Equipos de trabajo)
export const crews = pgTable('crews', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ej: "Equipo A", "Equipo D (Volante)"
  code: text('code').notNull(), // "A", "B", "C", "D"
  type: text('type').notNull().default('FIXED'), // 'FIXED' o 'ROTATING' (volante)
  description: text('description'),
  color: text('color').notNull().default('Azul Real'),
  badgeColorClass: text('badge_color_class').notNull().default('bg-blue-100 text-blue-800 border-blue-300'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 3. Usuarios y Funcionarios
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('FUNCIONARIO'), // 'ADMIN' o 'FUNCIONARIO'
  crewId: text('crew_id').references(() => crews.id, { onDelete: 'set null' }),
  documentNumber: text('document_number'), // C.I.
  phone: text('phone'),
  baseDailyWage: integer('base_daily_wage').default(100000), // En Guaraníes (PYG ₲)
  isActive: boolean('is_active').notNull().default(true),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. Plantillas de Turnos
export const shiftTemplates = pgTable('shift_templates', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(), // "M", "T", "N", "L"
  name: text('name').notNull(), // "Mañana", "Tarde", "Noche", "Libre"
  startTime: text('start_time'), // "06:00", "14:00", "22:00", null
  endTime: text('end_time'), // "14:00", "22:00", "06:00", null
  durationHours: numeric('duration_hours').notNull().default('8'),
  crossesMidnight: boolean('crosses_midnight').notNull().default(false),
  targetHeadcount: integer('target_headcount').notNull().default(2),
  colorClass: text('color_class').notNull().default('bg-blue-50 text-blue-700 border-blue-200'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 5. Turnos Asignados y Planificación
export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  crewId: text('crew_id').references(() => crews.id, { onDelete: 'set null' }),
  shiftTemplateId: text('shift_template_id').notNull().references(() => shiftTemplates.id),
  date: text('date').notNull(), // YYYY-MM-DD
  isPublished: boolean('is_published').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedByUserId: text('published_by_user_id').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 6. Asistencia y Marcaciones Reales
export const attendances = pgTable('attendances', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  shiftId: text('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
  date: text('date').notNull(), // YYYY-MM-DD (fecha del turno al que corresponde la jornada)
  
  // Entrada
  clockInTime: timestamp('clock_in_time', { withTimezone: true }),
  clockInLat: doublePrecision('clock_in_lat'),
  clockInLng: doublePrecision('clock_in_lng'),
  clockInAccuracy: doublePrecision('clock_in_accuracy'),
  clockInDistanceMeters: doublePrecision('clock_in_distance_meters'),
  clockInStatus: text('clock_in_status').default('VALID'), // 'VALID', 'MANUAL', 'GEOFENCE_WARNING'
  
  // Salida
  clockOutTime: timestamp('clock_out_time', { withTimezone: true }),
  clockOutLat: doublePrecision('clock_out_lat'),
  clockOutLng: doublePrecision('clock_out_lng'),
  clockOutAccuracy: doublePrecision('clock_out_accuracy'),
  clockOutDistanceMeters: doublePrecision('clock_out_distance_meters'),
  clockOutStatus: text('clock_out_status'), // 'VALID', 'MANUAL', 'GEOFENCE_WARNING'
  
  // Cálculos de jornada
  workedDays: numeric('worked_days').notNull().default('0'), // 1.0, 0.5, 0
  dayHours: numeric('day_hours').notNull().default('0'),
  nightHours: numeric('night_hours').notNull().default('0'),
  totalHours: numeric('total_hours').notNull().default('0'),
  
  // Estado general
  status: text('status').notNull().default('EN_CURSO'), // 'EN_CURSO', 'COMPLETA', 'INCOMPLETA', 'AUSENTE', 'LIBRE', 'JUSTIFICADA'
  
  // Auditoría y correcciones manuales
  isManualCorrection: boolean('is_manual_correction').notNull().default(false),
  correctionReason: text('correction_reason'),
  correctedByUserId: text('corrected_by_user_id').references(() => users.id),
  correctedAt: timestamp('corrected_at', { withTimezone: true }),
  
  // Prevención de duplicados
  idempotencyToken: text('idempotency_token'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 7. Incidencias y Solicitudes de Revisión
export const attendanceIncidents = pgTable('attendance_incidents', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  attendanceId: text('attendance_id').references(() => attendances.id, { onDelete: 'set null' }),
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').notNull(), // 'GPS_ERROR', 'FORGOT_CLOCK_OUT', 'FORGOT_CLOCK_IN', 'DISCREPANCY', 'OTHER'
  description: text('description').notNull(),
  status: text('status').notNull().default('PENDING'), // 'PENDING', 'APPROVED', 'REJECTED'
  resolutionNotes: text('resolution_notes'),
  resolvedByUserId: text('resolved_by_user_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. Cierres de Período (Borrador vs Aprobado con Snapshot histórico inmutable)
export const periodClosures = pgTable('period_closures', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ej: "Primera Quincena Noviembre 2026"
  startDate: text('start_date').notNull(), // YYYY-MM-DD
  endDate: text('end_date').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('BORRADOR'), // 'BORRADOR', 'APROBADO'
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedByUserId: text('approved_by_user_id').references(() => users.id),
  nightHourStart: text('night_hour_start').notNull().default('20:00'),
  nightHourEnd: text('night_hour_end').notNull().default('06:00'),
  nightSurchargePercent: integer('night_surcharge_percent').notNull().default(30),
  rulesSnapshot: jsonb('rules_snapshot'), // Snapshot inmutable de reglas vigentes al momento del cierre
  summaryData: jsonb('summary_data'), // Datos consolidados inmutables
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 9. Invitaciones a Funcionarios
export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('FUNCIONARIO'),
  crewId: text('crew_id').references(() => crews.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  invitedByUserId: text('invited_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 10. Tokens de Recuperación de Contraseña
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 11. Registro de Auditoría (Trazabilidad completa)
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(), // Ej: 'ATTENDANCE_CORRECTED', 'SHIFT_PUBLISHED', 'PERIOD_CLOSED', 'STAFF_DEACTIVATED'
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relaciones para consultas relacionales con Drizzle
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  crews: many(crews),
  shiftTemplates: many(shiftTemplates),
  shifts: many(shifts),
  attendances: many(attendances),
  periodClosures: many(periodClosures),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  crew: one(crews, {
    fields: [users.crewId],
    references: [crews.id],
  }),
  shifts: many(shifts),
  attendances: many(attendances),
  incidents: many(attendanceIncidents),
}));

export const crewsRelations = relations(crews, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [crews.organizationId],
    references: [organizations.id],
  }),
  members: many(users),
  shifts: many(shifts),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [shifts.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
  crew: one(crews, {
    fields: [shifts.crewId],
    references: [crews.id],
  }),
  shiftTemplate: one(shiftTemplates, {
    fields: [shifts.shiftTemplateId],
    references: [shiftTemplates.id],
  }),
  attendances: many(attendances),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  organization: one(organizations, {
    fields: [attendances.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [attendances.userId],
    references: [users.id],
  }),
  shift: one(shifts, {
    fields: [attendances.shiftId],
    references: [shifts.id],
  }),
  correctedBy: one(users, {
    fields: [attendances.correctedByUserId],
    references: [users.id],
  }),
}));
