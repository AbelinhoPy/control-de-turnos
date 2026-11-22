// src/lib/db-service.ts
// Capa unificada de acceso a datos para Neon Postgres con fallback explícito a demo

import { db, isDatabaseConnected, isDemoModeEnabled, assertDatabaseAvailable } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { dataStore, OrgData, CrewData, ShiftTemplateData, UserData, ShiftData, AttendanceData, AttendanceIncidentData, PeriodClosureData, AuditLogData } from './data-store';
import { calculateShiftHours } from './time/timezone';
import crypto from 'crypto';

export class DatabaseService {
  /**
   * ORGANIZACIÓN Y CONFIGURACIÓN
   */
  async getOrganization(orgId: string = 'org_mepy_2026'): Promise<OrgData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getOrganization(orgId);
    }

    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (!org) {
      if (isDemoModeEnabled()) return dataStore.getOrganization(orgId);
      throw new Error(`Organización ${orgId} no encontrada.`);
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      nightHourStart: org.nightHourStart,
      nightHourEnd: org.nightHourEnd,
      nightSurchargePercent: org.nightSurchargePercent,
      workplaceName: org.workplaceName,
      workplaceLat: org.workplaceLat,
      workplaceLng: org.workplaceLng,
      geofenceRadiusMeters: org.geofenceRadiusMeters,
      halfDayRuleConfirmed: org.halfDayRuleConfirmed,
      hourlyRateRuleConfirmed: org.hourlyRateRuleConfirmed,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  async createOrganization(orgData: {
    id?: string;
    name: string;
    slug?: string;
    nightHourStart?: string;
    nightHourEnd?: string;
    nightSurchargePercent?: number;
    workplaceName?: string;
    workplaceLat?: number;
    workplaceLng?: number;
    geofenceRadiusMeters?: number;
    halfDayRuleConfirmed?: boolean;
    hourlyRateRuleConfirmed?: boolean;
    [key: string]: any;
  }): Promise<OrgData> {
    assertDatabaseAvailable();
    const newId = orgData.id || `org_${crypto.randomBytes(6).toString('hex')}`;
    const slug = orgData.slug || orgData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const now = new Date();

    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getOrganization(newId);
    }

    await db.insert(schema.organizations).values({
      id: newId,
      name: orgData.name,
      slug,
      nightHourStart: orgData.nightHourStart || '20:00',
      nightHourEnd: orgData.nightHourEnd || '06:00',
      nightSurchargePercent: orgData.nightSurchargePercent ?? 30,
      workplaceName: orgData.workplaceName || 'Sede Central',
      workplaceLat: orgData.workplaceLat ?? -25.496469,
      workplaceLng: orgData.workplaceLng ?? -54.789641,
      geofenceRadiusMeters: orgData.geofenceRadiusMeters ?? 300,
      halfDayRuleConfirmed: orgData.halfDayRuleConfirmed ?? false,
      hourlyRateRuleConfirmed: orgData.hourlyRateRuleConfirmed ?? false,
      createdAt: now,
      updatedAt: now,
    });

    // Sembrar plantillas de turnos oficiales para la nueva organización
    await db.insert(schema.shiftTemplates).values([
      { id: `${newId}_shift_m`, organizationId: newId, code: 'M', name: 'Mañana', startTime: '06:00', endTime: '14:00', durationHours: '8', crossesMidnight: false, targetHeadcount: 2, colorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
      { id: `${newId}_shift_t`, organizationId: newId, code: 'T', name: 'Tarde', startTime: '14:00', endTime: '22:00', durationHours: '8', crossesMidnight: false, targetHeadcount: 2, colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { id: `${newId}_shift_n`, organizationId: newId, code: 'N', name: 'Noche', startTime: '22:00', endTime: '06:00', durationHours: '8', crossesMidnight: true, targetHeadcount: 2, colorClass: 'bg-purple-100 text-purple-800 border-purple-300' },
      { id: `${newId}_shift_l`, organizationId: newId, code: 'L', name: 'Libre', startTime: null, endTime: null, durationHours: '0', crossesMidnight: false, targetHeadcount: 0, colorClass: 'bg-slate-100 text-slate-600 border-slate-300' },
    ]).onConflictDoNothing();

    // Sembrar 4 cuadrillas iniciales (3 fijas y 1 volante 2M-2T-2N-2L)
    await db.insert(schema.crews).values([
      { id: `${newId}_crew_a`, organizationId: newId, name: 'Cuadrilla A (Mañana Fijo)', code: 'A', type: 'FIXED', color: 'Azul', badgeColorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
      { id: `${newId}_crew_b`, organizationId: newId, name: 'Cuadrilla B (Tarde Fijo)', code: 'B', type: 'FIXED', color: 'Verde', badgeColorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { id: `${newId}_crew_c`, organizationId: newId, name: 'Cuadrilla C (Noche Fijo)', code: 'C', type: 'FIXED', color: 'Violeta', badgeColorClass: 'bg-purple-100 text-purple-800 border-purple-300' },
      { id: `${newId}_crew_d`, organizationId: newId, name: 'Cuadrilla D (Volante 2M-2T-2N-2L)', code: 'D', type: 'ROTATING', color: 'Ámbar', badgeColorClass: 'bg-amber-100 text-amber-800 border-amber-300' },
    ]).onConflictDoNothing();

    return this.getOrganization(newId);
  }

  async updateOrganization(orgId: string, data: Partial<OrgData>): Promise<OrgData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.updateOrganization(orgId, data);
    }

    const updateFields: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.workplaceName !== undefined) updateFields.workplaceName = data.workplaceName;
    if (data.workplaceLat !== undefined) updateFields.workplaceLat = data.workplaceLat;
    if (data.workplaceLng !== undefined) updateFields.workplaceLng = data.workplaceLng;
    if (data.geofenceRadiusMeters !== undefined) updateFields.geofenceRadiusMeters = data.geofenceRadiusMeters;
    if (data.nightHourStart !== undefined) updateFields.nightHourStart = data.nightHourStart;
    if (data.nightHourEnd !== undefined) updateFields.nightHourEnd = data.nightHourEnd;
    if (data.nightSurchargePercent !== undefined) updateFields.nightSurchargePercent = data.nightSurchargePercent;
    if (data.halfDayRuleConfirmed !== undefined) updateFields.halfDayRuleConfirmed = data.halfDayRuleConfirmed;
    if (data.hourlyRateRuleConfirmed !== undefined) updateFields.hourlyRateRuleConfirmed = data.hourlyRateRuleConfirmed;

    await db.update(schema.organizations).set(updateFields).where(eq(schema.organizations.id, orgId));
    return this.getOrganization(orgId);
  }

  /**
   * CUADRILLAS Y PLANTILLAS
   */
  async listCrews(orgId: string = 'org_mepy_2026'): Promise<CrewData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listCrews(orgId);
    }

    const rows = await db.select().from(schema.crews).where(eq(schema.crews.organizationId, orgId));
    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      code: r.code,
      type: r.type as 'FIXED' | 'ROTATING',
      description: r.description || undefined,
      color: r.color,
      badgeColorClass: r.badgeColorClass,
    }));
  }

  async listShiftTemplates(orgId: string = 'org_mepy_2026'): Promise<ShiftTemplateData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listShiftTemplates(orgId);
    }

    const rows = await db.select().from(schema.shiftTemplates).where(eq(schema.shiftTemplates.organizationId, orgId));
    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      code: r.code,
      name: r.name,
      startTime: r.startTime,
      endTime: r.endTime,
      durationHours: Number(r.durationHours),
      crossesMidnight: r.crossesMidnight,
      targetHeadcount: r.targetHeadcount,
      colorClass: r.colorClass,
    }));
  }

  /**
   * USUARIOS Y FUNCIONARIOS
   */
  async listUsers(orgId: string = 'org_mepy_2026', includeDeactivated: boolean = false): Promise<UserData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listUsers(orgId, includeDeactivated);
    }

    const conditions = [eq(schema.users.organizationId, orgId)];
    if (!includeDeactivated) {
      conditions.push(eq(schema.users.isActive, true));
    }

    const rows = await db.select().from(schema.users).where(and(...conditions));
    return rows.map((u: any) => ({
      id: u.id,
      organizationId: u.organizationId,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role as 'ADMIN' | 'FUNCIONARIO',
      crewId: u.crewId,
      documentNumber: u.documentNumber || undefined,
      phone: u.phone || undefined,
      baseDailyWage: u.baseDailyWage || 100000,
      isActive: u.isActive,
      deactivatedAt: u.deactivatedAt ? u.deactivatedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async getUser(userId: string): Promise<UserData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getUser(userId) || null;
    }

    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!u) return null;

    return {
      id: u.id,
      organizationId: u.organizationId,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role as 'ADMIN' | 'FUNCIONARIO',
      crewId: u.crewId,
      documentNumber: u.documentNumber || undefined,
      phone: u.phone || undefined,
      baseDailyWage: u.baseDailyWage || 100000,
      isActive: u.isActive,
      deactivatedAt: u.deactivatedAt ? u.deactivatedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getUserByEmail(email) || null;
    }

    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim()));
    if (!u) return null;

    return {
      id: u.id,
      organizationId: u.organizationId,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      role: u.role as 'ADMIN' | 'FUNCIONARIO',
      crewId: u.crewId,
      documentNumber: u.documentNumber || undefined,
      phone: u.phone || undefined,
      baseDailyWage: u.baseDailyWage || 100000,
      isActive: u.isActive,
      deactivatedAt: u.deactivatedAt ? u.deactivatedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async createUser(userData: Omit<UserData, 'createdAt'>): Promise<UserData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.createUser(userData);
    }

    const newId = userData.id || `user_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();

    await db.insert(schema.users).values({
      id: newId,
      organizationId: userData.organizationId,
      name: userData.name,
      email: userData.email.toLowerCase().trim(),
      passwordHash: userData.passwordHash || 'INVITED_PENDING_PASSWORD',
      role: userData.role,
      crewId: userData.crewId,
      documentNumber: userData.documentNumber,
      phone: userData.phone,
      baseDailyWage: userData.baseDailyWage || 100000,
      isActive: userData.isActive !== false,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getUser(newId))!;
  }

  async updateUser(userId: string, data: Partial<UserData>): Promise<UserData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.updateUser(userId, data);
    }

    const updateFields: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.crewId !== undefined) updateFields.crewId = data.crewId;
    if (data.baseDailyWage !== undefined) updateFields.baseDailyWage = data.baseDailyWage;
    if (data.documentNumber !== undefined) updateFields.documentNumber = data.documentNumber;
    if (data.phone !== undefined) updateFields.phone = data.phone;
    if (data.passwordHash !== undefined) updateFields.passwordHash = data.passwordHash;
    if (data.isActive !== undefined) {
      updateFields.isActive = data.isActive;
      if (!data.isActive) {
        updateFields.deactivatedAt = new Date();
      }
    }

    await db.update(schema.users).set(updateFields).where(eq(schema.users.id, userId));
    return this.getUser(userId);
  }

  async deactivateUser(userId: string, adminUserId: string = 'user_admin'): Promise<boolean> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return Boolean(dataStore.deactivateUser(userId));
    }

    const user = await this.getUser(userId);
    if (!user) return false;
    const orgId = user.organizationId;

    const now = new Date();
    await db.transaction(async (tx: any) => {
      await tx
        .update(schema.users)
        .set({ isActive: false, deactivatedAt: now, updatedAt: now })
        .where(eq(schema.users.id, userId));

      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: orgId,
        userId: adminUserId,
        action: 'STAFF_DEACTIVATED',
        entity: 'USER',
        entityId: userId,
        details: { deactivatedAt: now.toISOString() },
        createdAt: now,
      });
    });

    return true;
  }

  /**
   * TURNOS Y PLANIFICACIÓN
   */
  async listShifts(
    orgId: string = 'org_mepy_2026',
    startDateOrFilters?: string | { startDate?: string; endDate?: string; crewId?: string; userId?: string; onlyPublished?: boolean },
    endDate?: string,
    crewId?: string,
    userId?: string,
    onlyPublished?: boolean
  ): Promise<ShiftData[]> {
    assertDatabaseAvailable();

    let start = '1970-01-01';
    let end = '2099-12-31';
    let filterCrew = crewId;
    let filterUser = userId;
    let filterOnlyPublished = onlyPublished;

    if (typeof startDateOrFilters === 'object' && startDateOrFilters !== null) {
      if (startDateOrFilters.startDate) start = startDateOrFilters.startDate;
      if (startDateOrFilters.endDate) end = startDateOrFilters.endDate;
      if (startDateOrFilters.crewId) filterCrew = startDateOrFilters.crewId;
      if (startDateOrFilters.userId) filterUser = startDateOrFilters.userId;
      if (startDateOrFilters.onlyPublished !== undefined) filterOnlyPublished = startDateOrFilters.onlyPublished;
    } else if (typeof startDateOrFilters === 'string') {
      start = startDateOrFilters;
      if (endDate) end = endDate;
    }

    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listShifts(orgId, {
        startDate: start,
        endDate: end,
        crewId: filterCrew,
        userId: filterUser,
        onlyPublished: filterOnlyPublished,
      });
    }

    const templates = await this.listShiftTemplates(orgId);
    const templateMap = new Map(templates.map((t) => [t.id, t.code]));

    const conditions = [
      eq(schema.shifts.organizationId, orgId),
      gte(schema.shifts.date, start),
      lte(schema.shifts.date, end),
    ];

    if (filterCrew && filterCrew !== 'ALL') {
      conditions.push(eq(schema.shifts.crewId, filterCrew));
    }
    if (filterUser && filterUser !== 'ALL') {
      conditions.push(eq(schema.shifts.userId, filterUser));
    }
    if (filterOnlyPublished) {
      conditions.push(eq(schema.shifts.isPublished, true));
    }

    const rows = await db.select().from(schema.shifts).where(and(...conditions));
    return rows.map((s: any) => ({
      id: s.id,
      organizationId: s.organizationId,
      userId: s.userId,
      crewId: s.crewId,
      shiftTemplateId: s.shiftTemplateId,
      shiftCode: templateMap.get(s.shiftTemplateId) || 'L',
      date: s.date,
      isPublished: s.isPublished,
      publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
      publishedByUserId: s.publishedByUserId,
      notes: s.notes || undefined,
    }));
  }

  async assignShift(shiftData: Omit<ShiftData, 'id' | 'createdAt'>): Promise<ShiftData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.assignShift(shiftData);
    }

    const newId = `shift_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();

    let shiftTemplateId = shiftData.shiftTemplateId;
    if (!shiftTemplateId && shiftData.shiftCode) {
      const templates = await this.listShiftTemplates(shiftData.organizationId);
      const found = templates.find((t) => t.code === shiftData.shiftCode);
      if (found) {
        shiftTemplateId = found.id;
      }
    }
    if (!shiftTemplateId) {
      const templates = await this.listShiftTemplates(shiftData.organizationId);
      shiftTemplateId = templates[0]?.id || `shift_l_${shiftData.organizationId}`;
    }

    // Operación atómica de inserción o actualización segura
    await db
      .insert(schema.shifts)
      .values({
        id: newId,
        organizationId: shiftData.organizationId,
        userId: shiftData.userId,
        crewId: shiftData.crewId,
        shiftTemplateId: shiftTemplateId!,
        date: shiftData.date,
        isPublished: shiftData.isPublished || false,
        notes: shiftData.notes,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.shifts.organizationId, schema.shifts.userId, schema.shifts.date],
        set: {
          shiftTemplateId: shiftTemplateId!,
          crewId: shiftData.crewId,
          isPublished: shiftData.isPublished || false,
          notes: shiftData.notes,
          updatedAt: now,
        },
      });

    const [saved] = await db
      .select()
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.organizationId, shiftData.organizationId),
          eq(schema.shifts.userId, shiftData.userId),
          eq(schema.shifts.date, shiftData.date)
        )
      );

    const templates = await this.listShiftTemplates(shiftData.organizationId);
    const templateMap = new Map(templates.map((t) => [t.id, t.code]));

    return {
      id: saved.id,
      organizationId: saved.organizationId,
      userId: saved.userId,
      crewId: saved.crewId,
      shiftTemplateId: saved.shiftTemplateId,
      shiftCode: templateMap.get(saved.shiftTemplateId) || 'L',
      date: saved.date,
      isPublished: saved.isPublished,
      notes: saved.notes || undefined,
    };
  }

  async publishShifts(orgId: string = 'org_mepy_2026', shiftIds: string[], adminUserId: string = 'user_admin'): Promise<number> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return (dataStore.publishShifts as any)(orgId, '1970-01-01', '2099-12-31', adminUserId)?.count ?? shiftIds.length;
    }

    if (shiftIds.length === 0) return 0;
    const now = new Date();

    const res = await db
      .update(schema.shifts)
      .set({
        isPublished: true,
        publishedAt: now,
        publishedByUserId: adminUserId,
        updatedAt: now,
      })
      .where(and(eq(schema.shifts.organizationId, orgId), inArray(schema.shifts.id, shiftIds)));

    await db.insert(schema.auditLogs).values({
      id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      organizationId: orgId,
      userId: adminUserId,
      action: 'SHIFTS_PUBLISHED',
      entity: 'SHIFT',
      entityId: `${shiftIds.length}_shifts`,
      details: { count: shiftIds.length, publishedAt: now.toISOString() },
      createdAt: now,
    });

    return shiftIds.length;
  }

  /**
   * ASISTENCIAS Y MARCACIONES
   */
  async getAttendance(id: string): Promise<AttendanceData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getAttendance(id) || null;
    }

    const [att] = await db.select().from(schema.attendances).where(eq(schema.attendances.id, id));
    if (!att) return null;

    let correctedByName = undefined;
    if (att.correctedByUserId) {
      const [u] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, att.correctedByUserId));
      correctedByName = u?.name || 'Administrador';
    }

    return {
      id: att.id,
      organizationId: att.organizationId,
      userId: att.userId,
      shiftId: att.shiftId,
      date: att.date,
      clockInTime: att.clockInTime ? att.clockInTime.toISOString() : null,
      clockInLat: att.clockInLat,
      clockInLng: att.clockInLng,
      clockInAccuracy: att.clockInAccuracy,
      clockInDistanceMeters: att.clockInDistanceMeters,
      clockInStatus: att.clockInStatus as any,
      clockOutTime: att.clockOutTime ? att.clockOutTime.toISOString() : null,
      clockOutLat: att.clockOutLat,
      clockOutLng: att.clockOutLng,
      clockOutAccuracy: att.clockOutAccuracy,
      clockOutDistanceMeters: att.clockOutDistanceMeters,
      clockOutStatus: att.clockOutStatus as any,
      workedDays: Number(att.workedDays),
      dayHours: Number(att.dayHours),
      nightHours: Number(att.nightHours),
      totalHours: Number(att.totalHours),
      status: att.status as any,
      isManualCorrection: att.isManualCorrection,
      correctionReason: att.correctionReason,
      correctedByUserId: att.correctedByUserId,
      correctedByName: correctedByName || undefined,
      correctedAt: att.correctedAt ? att.correctedAt.toISOString() : null,
      idempotencyToken: att.idempotencyToken,
      notes: att.notes,
    };
  }

  async findOpenAttendance(userId: string): Promise<AttendanceData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.findOpenAttendance(userId) || null;
    }

    const rows = await db
      .select()
      .from(schema.attendances)
      .where(and(eq(schema.attendances.userId, userId), eq(schema.attendances.status, 'EN_CURSO')))
      .orderBy(desc(schema.attendances.date));

    if (rows.length === 0) return null;
    const att = rows[0];

    return {
      id: att.id,
      organizationId: att.organizationId,
      userId: att.userId,
      shiftId: att.shiftId,
      date: att.date,
      clockInTime: att.clockInTime ? att.clockInTime.toISOString() : null,
      clockInLat: att.clockInLat,
      clockInLng: att.clockInLng,
      clockInAccuracy: att.clockInAccuracy,
      clockInDistanceMeters: att.clockInDistanceMeters,
      clockInStatus: att.clockInStatus as any,
      clockOutTime: att.clockOutTime ? att.clockOutTime.toISOString() : null,
      clockOutLat: att.clockOutLat,
      clockOutLng: att.clockOutLng,
      clockOutAccuracy: att.clockOutAccuracy,
      clockOutDistanceMeters: att.clockOutDistanceMeters,
      clockOutStatus: att.clockOutStatus as any,
      workedDays: Number(att.workedDays),
      dayHours: Number(att.dayHours),
      nightHours: Number(att.nightHours),
      totalHours: Number(att.totalHours),
      status: att.status as any,
      isManualCorrection: att.isManualCorrection,
      correctionReason: att.correctionReason,
      idempotencyToken: att.idempotencyToken,
      notes: att.notes,
    };
  }

  async getAttendanceForUserAndDate(userId: string, date: string): Promise<AttendanceData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getAttendanceForUserAndDate(userId, date) || null;
    }

    const [att] = await db
      .select()
      .from(schema.attendances)
      .where(and(eq(schema.attendances.userId, userId), eq(schema.attendances.date, date)));

    if (!att) return null;

    return {
      id: att.id,
      organizationId: att.organizationId,
      userId: att.userId,
      shiftId: att.shiftId,
      date: att.date,
      clockInTime: att.clockInTime ? att.clockInTime.toISOString() : null,
      clockInLat: att.clockInLat,
      clockInLng: att.clockInLng,
      clockInAccuracy: att.clockInAccuracy,
      clockInDistanceMeters: att.clockInDistanceMeters,
      clockInStatus: att.clockInStatus as any,
      clockOutTime: att.clockOutTime ? att.clockOutTime.toISOString() : null,
      clockOutLat: att.clockOutLat,
      clockOutLng: att.clockOutLng,
      clockOutAccuracy: att.clockOutAccuracy,
      clockOutDistanceMeters: att.clockOutDistanceMeters,
      clockOutStatus: att.clockOutStatus as any,
      workedDays: Number(att.workedDays),
      dayHours: Number(att.dayHours),
      nightHours: Number(att.nightHours),
      totalHours: Number(att.totalHours),
      status: att.status as any,
      isManualCorrection: att.isManualCorrection,
      correctionReason: att.correctionReason,
      idempotencyToken: att.idempotencyToken,
      notes: att.notes,
    };
  }

  async recordClockIn(params: {
    userId: string;
    organizationId: string;
    shiftId?: string | null;
    date: string;
    timestamp: Date;
    lat: number;
    lng: number;
    accuracy: number;
    distanceMeters: number;
    status: 'VALID' | 'MANUAL' | 'GEOFENCE_WARNING';
    idempotencyToken?: string;
  }): Promise<AttendanceData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.recordClockIn(params as any);
    }

    // 1. Verificar idempotencia
    if (params.idempotencyToken) {
      const [existingByToken] = await db
        .select()
        .from(schema.attendances)
        .where(eq(schema.attendances.idempotencyToken, params.idempotencyToken));
      if (existingByToken) {
        return (await this.getAttendance(existingByToken.id))!;
      }
    }

    // 2. Verificar si ya existe asistencia en esa fecha
    const existingDate = await this.getAttendanceForUserAndDate(params.userId, params.date);
    if (existingDate) {
      return existingDate;
    }

    const newId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    await db.transaction(async (tx: any) => {
      await tx.insert(schema.attendances).values({
        id: newId,
        organizationId: params.organizationId,
        userId: params.userId,
        shiftId: params.shiftId,
        date: params.date,
        clockInTime: params.timestamp,
        clockInLat: params.lat,
        clockInLng: params.lng,
        clockInAccuracy: params.accuracy,
        clockInDistanceMeters: params.distanceMeters,
        clockInStatus: params.status,
        status: 'EN_CURSO',
        workedDays: '0',
        dayHours: '0',
        nightHours: '0',
        totalHours: '0',
        isManualCorrection: false,
        idempotencyToken: params.idempotencyToken,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: params.organizationId,
        userId: params.userId,
        action: 'CLOCK_IN_RECORDED',
        entity: 'ATTENDANCE',
        entityId: newId,
        details: {
          lat: params.lat,
          lng: params.lng,
          accuracy: params.accuracy,
          distanceMeters: params.distanceMeters,
        },
        createdAt: now,
      });
    });

    return (await this.getAttendance(newId))!;
  }

  async recordClockOut(params: {
    attendanceId: string;
    timestamp: Date;
    lat: number;
    lng: number;
    accuracy: number;
    distanceMeters: number;
    status: 'VALID' | 'MANUAL' | 'GEOFENCE_WARNING';
    idempotencyToken?: string;
  }): Promise<AttendanceData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.recordClockOut(params as any);
    }

    const existing = await this.getAttendance(params.attendanceId);
    if (!existing) {
      throw new Error('Jornada no encontrada.');
    }

    // Proteger salida ya registrada
    if (existing.clockOutTime) {
      return existing;
    }

    const clockInIso = existing.clockInTime || params.timestamp.toISOString();
    const clockOutIso = params.timestamp.toISOString();
    const calc = calculateShiftHours(clockInIso, clockOutIso);

    const now = new Date();
    await db.transaction(async (tx: any) => {
      await tx
        .update(schema.attendances)
        .set({
          clockOutTime: params.timestamp,
          clockOutLat: params.lat,
          clockOutLng: params.lng,
          clockOutAccuracy: params.accuracy,
          clockOutDistanceMeters: params.distanceMeters,
          clockOutStatus: params.status,
          workedDays: calc.workedDays.toString(),
          dayHours: calc.dayHours.toString(),
          nightHours: calc.nightHours.toString(),
          totalHours: calc.totalHours.toString(),
          status: 'COMPLETA',
          updatedAt: now,
        })
        .where(eq(schema.attendances.id, params.attendanceId));

      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: existing.organizationId,
        userId: existing.userId,
        action: 'CLOCK_OUT_RECORDED',
        entity: 'ATTENDANCE',
        entityId: params.attendanceId,
        details: {
          totalHours: calc.totalHours,
          nightHours: calc.nightHours,
          dayHours: calc.dayHours,
          workedDays: calc.workedDays,
        },
        createdAt: now,
      });
    });

    return (await this.getAttendance(params.attendanceId))!;
  }

  async correctAttendance(params: {
    attendanceId?: string;
    organizationId: string;
    userId: string;
    date: string;
    clockInTime?: string;
    clockOutTime?: string;
    status: 'COMPLETA' | 'INCOMPLETA' | 'AUSENTE' | 'LIBRE' | 'JUSTIFICADA';
    workedDays?: number;
    reason?: string;
    correctionReason?: string;
    adminUserId?: string;
    correctedByUserId?: string;
    adminName?: string;
    correctedByName?: string;
  }): Promise<AttendanceData> {
    assertDatabaseAvailable();
    const effectiveReason = params.reason || params.correctionReason || '';
    const effectiveAdminId = params.adminUserId || params.correctedByUserId || 'user_admin';
    const effectiveAdminName = params.adminName || params.correctedByName || 'Administrador';

    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.correctAttendance({
        ...params,
        reason: effectiveReason,
        adminUserId: effectiveAdminId,
        adminName: effectiveAdminName,
      } as any);
    }

    if (!effectiveReason || effectiveReason.trim().length < 5) {
      throw new Error('El motivo de la corrección es obligatorio (mínimo 5 caracteres).');
    }

    let calc = { workedDays: params.workedDays ?? 1, dayHours: 0, nightHours: 0, totalHours: 0 };
    if (params.clockInTime && params.clockOutTime) {
      calc = calculateShiftHours(params.clockInTime, params.clockOutTime);
      if (params.workedDays !== undefined) {
        calc.workedDays = params.workedDays;
      }
    }

    const now = new Date();
    let attId = params.attendanceId;

    await db.transaction(async (tx: any) => {
      if (attId) {
        await tx
          .update(schema.attendances)
          .set({
            clockInTime: params.clockInTime ? new Date(params.clockInTime) : undefined,
            clockOutTime: params.clockOutTime ? new Date(params.clockOutTime) : undefined,
            workedDays: calc.workedDays.toString(),
            dayHours: calc.dayHours.toString(),
            nightHours: calc.nightHours.toString(),
            totalHours: calc.totalHours.toString(),
            status: params.status,
            isManualCorrection: true,
            correctionReason: effectiveReason,
            correctedByUserId: effectiveAdminId,
            correctedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.attendances.id, attId));
      } else {
        attId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await tx.insert(schema.attendances).values({
          id: attId,
          organizationId: params.organizationId,
          userId: params.userId,
          date: params.date,
          clockInTime: params.clockInTime ? new Date(params.clockInTime) : null,
          clockOutTime: params.clockOutTime ? new Date(params.clockOutTime) : null,
          workedDays: calc.workedDays.toString(),
          dayHours: calc.dayHours.toString(),
          nightHours: calc.nightHours.toString(),
          totalHours: calc.totalHours.toString(),
          status: params.status,
          isManualCorrection: true,
          correctionReason: effectiveReason,
          correctedByUserId: effectiveAdminId,
          correctedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: params.organizationId,
        userId: effectiveAdminId,
        action: 'ATTENDANCE_CORRECTED',
        entity: 'ATTENDANCE',
        entityId: attId!,
        details: {
          reason: effectiveReason,
          adminName: effectiveAdminName,
          status: params.status,
          workedDays: calc.workedDays,
        },
        createdAt: now,
      });
    });

    return (await this.getAttendance(attId!))!;
  }

  async listAttendances(
    orgId: string = 'org_mepy_2026',
    filters: {
      date?: string;
      startDate?: string;
      endDate?: string;
      userId?: string;
      crewId?: string;
      status?: string;
      includeDeactivated?: boolean;
    }
  ): Promise<AttendanceData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listAttendances(orgId, filters);
    }

    const conditions = [eq(schema.attendances.organizationId, orgId)];

    if (filters.date) {
      conditions.push(eq(schema.attendances.date, filters.date));
    }
    if (filters.startDate) {
      conditions.push(gte(schema.attendances.date, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.attendances.date, filters.endDate));
    }
    if (filters.userId && filters.userId !== 'ALL') {
      conditions.push(eq(schema.attendances.userId, filters.userId));
    }
    if (filters.status && filters.status !== 'ALL') {
      conditions.push(eq(schema.attendances.status, filters.status));
    }

    const rows = await db.select().from(schema.attendances).where(and(...conditions));
    return rows.map((att: any) => ({
      id: att.id,
      organizationId: att.organizationId,
      userId: att.userId,
      shiftId: att.shiftId,
      date: att.date,
      clockInTime: att.clockInTime ? att.clockInTime.toISOString() : null,
      clockInLat: att.clockInLat,
      clockInLng: att.clockInLng,
      clockInAccuracy: att.clockInAccuracy,
      clockInDistanceMeters: att.clockInDistanceMeters,
      clockInStatus: att.clockInStatus as any,
      clockOutTime: att.clockOutTime ? att.clockOutTime.toISOString() : null,
      clockOutLat: att.clockOutLat,
      clockOutLng: att.clockOutLng,
      clockOutAccuracy: att.clockOutAccuracy,
      clockOutDistanceMeters: att.clockOutDistanceMeters,
      clockOutStatus: att.clockOutStatus as any,
      workedDays: Number(att.workedDays),
      dayHours: Number(att.dayHours),
      nightHours: Number(att.nightHours),
      totalHours: Number(att.totalHours),
      status: att.status as any,
      isManualCorrection: att.isManualCorrection,
      correctionReason: att.correctionReason,
      idempotencyToken: att.idempotencyToken,
      notes: att.notes,
    }));
  }

  /**
   * INCIDENCIAS
   */
  async listAttendanceIncidents(orgId: string = 'org_mepy_2026', status?: string): Promise<AttendanceIncidentData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listAttendanceIncidents(orgId, status);
    }

    const conditions = [eq(schema.attendanceIncidents.organizationId, orgId)];
    if (status && status !== 'ALL') {
      conditions.push(eq(schema.attendanceIncidents.status, status));
    }

    const rows = await db.select().from(schema.attendanceIncidents).where(and(...conditions));
    const users = await this.listUsers(orgId, true);
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((inc: any) => ({
      id: inc.id,
      organizationId: inc.organizationId,
      userId: inc.userId,
      userName: userMap.get(inc.userId) || 'Funcionario',
      attendanceId: inc.attendanceId,
      date: inc.date,
      type: inc.type as any,
      description: inc.description,
      status: inc.status as any,
      resolutionNotes: inc.resolutionNotes,
      resolvedByUserId: inc.resolvedByUserId,
      resolvedByName: inc.resolvedByUserId ? userMap.get(inc.resolvedByUserId) : undefined,
      resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
      createdAt: inc.createdAt.toISOString(),
    }));
  }

  async createAttendanceIncident(data: {
    organizationId: string;
    userId: string;
    date: string;
    type: AttendanceIncidentData['type'];
    description: string;
    attendanceId?: string;
  }): Promise<AttendanceIncidentData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.createAttendanceIncident(data);
    }

    const newId = `inc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date();

    await db.insert(schema.attendanceIncidents).values({
      id: newId,
      organizationId: data.organizationId,
      userId: data.userId,
      date: data.date,
      type: data.type,
      description: data.description,
      attendanceId: data.attendanceId,
      status: 'PENDING',
      createdAt: now,
    });

    const user = await this.getUser(data.userId);

    return {
      id: newId,
      organizationId: data.organizationId,
      userId: data.userId,
      userName: user?.name || 'Funcionario',
      attendanceId: data.attendanceId,
      date: data.date,
      type: data.type,
      description: data.description,
      status: 'PENDING',
      createdAt: now.toISOString(),
    };
  }

  async resolveAttendanceIncident(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    resolutionNotes: string,
    adminUserId: string,
    adminName: string
  ): Promise<AttendanceIncidentData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.resolveAttendanceIncident(id, status, resolutionNotes, adminUserId, adminName);
    }

    const [existingInc] = await db.select().from(schema.attendanceIncidents).where(eq(schema.attendanceIncidents.id, id));
    const targetOrgId = existingInc?.organizationId || 'org_mepy_2026';

    const now = new Date();
    await db.transaction(async (tx: any) => {
      await tx
        .update(schema.attendanceIncidents)
        .set({
          status,
          resolutionNotes,
          resolvedByUserId: adminUserId,
          resolvedAt: now,
        })
        .where(eq(schema.attendanceIncidents.id, id));

      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: targetOrgId,
        userId: adminUserId,
        action: 'INCIDENT_RESOLVED',
        entity: 'INCIDENT',
        entityId: id,
        details: { status, resolutionNotes, adminName },
        createdAt: now,
      });
    });

    const [inc] = await db.select().from(schema.attendanceIncidents).where(eq(schema.attendanceIncidents.id, id));
    if (!inc) return null;

    const user = await this.getUser(inc.userId);
    return {
      id: inc.id,
      organizationId: inc.organizationId,
      userId: inc.userId,
      userName: user?.name,
      attendanceId: inc.attendanceId,
      date: inc.date,
      type: inc.type as any,
      description: inc.description,
      status: inc.status as any,
      resolutionNotes: inc.resolutionNotes,
      resolvedByUserId: inc.resolvedByUserId,
      resolvedByName: adminName,
      resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
      createdAt: inc.createdAt.toISOString(),
    };
  }

  /**
   * CIERRES DE PERÍODO (Inmutabilidad y Snapshot Completo)
   */
  async listPeriodClosures(orgId: string = 'org_mepy_2026'): Promise<PeriodClosureData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listPeriodClosures(orgId);
    }

    const rows = await db
      .select()
      .from(schema.periodClosures)
      .where(eq(schema.periodClosures.organizationId, orgId))
      .orderBy(desc(schema.periodClosures.startDate));

    return rows.map((c: any) => ({
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status as any,
      approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
      approvedByUserId: c.approvedByUserId,
      nightHourStart: c.nightHourStart,
      nightHourEnd: c.nightHourEnd,
      nightSurchargePercent: c.nightSurchargePercent,
      rulesSnapshot: (c.rulesSnapshot as any) || {},
      summaryData: (c.summaryData as any) || {},
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async getPeriodClosure(id: string): Promise<(PeriodClosureData & { detailsSnapshot?: any[] }) | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.getPeriodClosure(id) || null;
    }

    const [c] = await db.select().from(schema.periodClosures).where(eq(schema.periodClosures.id, id));
    if (!c) return null;

    return {
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status as any,
      approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
      approvedByUserId: c.approvedByUserId,
      nightHourStart: c.nightHourStart,
      nightHourEnd: c.nightHourEnd,
      nightSurchargePercent: c.nightSurchargePercent,
      rulesSnapshot: (c.rulesSnapshot as any) || {},
      summaryData: (c.summaryData as any) || {},
      detailsSnapshot: (c.detailsSnapshot as any) || [],
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async createPeriodClosureDraft(params: {
    organizationId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<PeriodClosureData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.createPeriodClosureDraft(params);
    }

    const org = await this.getOrganization(params.organizationId);
    const newId = `closure_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date();

    // Calcular resumen preliminar
    const attendances = await this.listAttendances(params.organizationId, {
      startDate: params.startDate,
      endDate: params.endDate,
    });

    let totalDaysWorked = 0;
    let totalHalfDays = 0;
    let totalDayHours = 0;
    let totalNightHours = 0;
    let totalHours = 0;

    attendances.forEach((a) => {
      totalDaysWorked += a.workedDays;
      if (a.workedDays === 0.5) totalHalfDays += 1;
      totalDayHours += a.dayHours;
      totalNightHours += a.nightHours;
      totalHours += a.totalHours;
    });

    const summaryData = {
      totalEmployees: new Set(attendances.map((a) => a.userId)).size,
      totalDaysWorked,
      totalHalfDays,
      totalDayHours,
      totalNightHours,
      totalHours,
      payrollStatus: org.halfDayRuleConfirmed ? ('APROBADO' as const) : ('PENDIENTE_CONFIGURACION' as const),
    };

    const rulesSnapshot = {
      halfDayRuleConfirmed: org.halfDayRuleConfirmed,
      hourlyRateRuleConfirmed: org.hourlyRateRuleConfirmed,
      nightHourStart: org.nightHourStart,
      nightHourEnd: org.nightHourEnd,
      nightSurchargePercent: org.nightSurchargePercent,
      wageCalculationFormula: 'Jornal Base * Dias + (Horas Nocturnas * Valor Hora * 0.30)',
    };

    await db.insert(schema.periodClosures).values({
      id: newId,
      organizationId: params.organizationId,
      name: params.name,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'BORRADOR',
      nightHourStart: org.nightHourStart,
      nightHourEnd: org.nightHourEnd,
      nightSurchargePercent: org.nightSurchargePercent,
      rulesSnapshot,
      summaryData,
      detailsSnapshot: attendances,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getPeriodClosure(newId))!;
  }

  async approvePeriodClosure(
    closureId: string,
    adminUserId: string = 'user_admin',
    adminName: string = 'Aldo Samudio'
  ): Promise<PeriodClosureData | null> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.approvePeriodClosure(closureId, adminUserId, adminName);
    }

    const closure = await this.getPeriodClosure(closureId);
    if (!closure) return null;

    const org = await this.getOrganization(closure.organizationId);
    const attendances = await this.listAttendances(closure.organizationId, {
      startDate: closure.startDate,
      endDate: closure.endDate,
    });
    const users = await this.listUsers(closure.organizationId, true);
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Generar detalle inmutable por persona y jornada con sus importes congelados
    const detailsSnapshot = attendances.map((att) => {
      const u = userMap.get(att.userId);
      const baseDailyWage = u?.baseDailyWage || 100000;
      const hourlyRate = baseDailyWage / 8;
      const basePay = att.workedDays * baseDailyWage;
      const nightPay = att.nightHours * hourlyRate * (org.nightSurchargePercent / 100);
      const totalPay = basePay + nightPay;

      return {
        ...att,
        userName: u?.name || 'Funcionario',
        crewId: u?.crewId,
        baseDailyWage,
        hourlyRate,
        basePay,
        nightPay,
        totalPay,
      };
    });

    let totalDaysWorked = 0;
    let totalHalfDays = 0;
    let totalDayHours = 0;
    let totalNightHours = 0;
    let totalHours = 0;

    attendances.forEach((a) => {
      totalDaysWorked += a.workedDays;
      if (a.workedDays === 0.5) totalHalfDays += 1;
      totalDayHours += a.dayHours;
      totalNightHours += a.nightHours;
      totalHours += a.totalHours;
    });

    const summaryData = {
      totalEmployees: new Set(attendances.map((a) => a.userId)).size,
      totalDaysWorked,
      totalHalfDays,
      totalDayHours,
      totalNightHours,
      totalHours,
      payrollStatus: 'APROBADO' as const,
    };

    const rulesSnapshot = {
      halfDayRuleConfirmed: true,
      hourlyRateRuleConfirmed: true,
      nightHourStart: org.nightHourStart,
      nightHourEnd: org.nightHourEnd,
      nightSurchargePercent: org.nightSurchargePercent,
      wageCalculationFormula: 'Jornal Base * Dias + (Horas Nocturnas * Valor Hora * 0.30)',
      approvedBy: adminName,
    };

    const now = new Date();
    await db.transaction(async (tx: any) => {
      await tx
        .update(schema.periodClosures)
        .set({
          status: 'APROBADO',
          approvedAt: now,
          approvedByUserId: adminUserId,
          rulesSnapshot,
          summaryData,
          detailsSnapshot,
          updatedAt: now,
        })
        .where(eq(schema.periodClosures.id, closureId));

      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: closure.organizationId,
        userId: adminUserId,
        action: 'PERIOD_CLOSED',
        entity: 'CLOSURE',
        entityId: closureId,
        details: { approvedBy: adminName, summaryData },
        createdAt: now,
      });
    });

    return (await this.getPeriodClosure(closureId))!;
  }

  /**
   * INVITACIONES
   */
  async createInvitation(data: {
    organizationId: string;
    email: string;
    name: string;
    role: string;
    crewId?: string | null;
    invitedByUserId: string;
  }): Promise<{ id: string; token: string; expiresAt: Date }> {
    assertDatabaseAvailable();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 días
    const newId = `inv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return { id: newId, token, expiresAt };
    }

    await db.insert(schema.invitations).values({
      id: newId,
      organizationId: data.organizationId,
      email: data.email.toLowerCase().trim(),
      name: data.name,
      role: data.role,
      crewId: data.crewId,
      token,
      expiresAt,
      invitedByUserId: data.invitedByUserId,
      createdAt: new Date(),
    });

    return { id: newId, token, expiresAt };
  }

  async getInvitationByToken(token: string) {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return {
        id: 'mock_inv_token',
        email: 'invitado.demo@empresa.com.py',
        name: 'Funcionario Invitado',
        role: 'FUNCIONARIO',
        crewId: 'crew_a',
        organizationId: 'org_mepy_2026',
        token,
        expiresAt: new Date(Date.now() + 3600000),
        acceptedAt: null,
      };
    }

    const [inv] = await db
      .select()
      .from(schema.invitations)
      .where(and(eq(schema.invitations.token, token)));

    return inv || null;
  }

  async acceptInvitation(token: string, passwordHash: string): Promise<UserData> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return this.createUser({
        id: `user_${Date.now()}`,
        organizationId: 'org_mepy_2026',
        name: 'Funcionario Invitado',
        email: 'invitado.demo@empresa.com.py',
        passwordHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_a',
        baseDailyWage: 100000,
        isActive: true,
      });
    }

    const inv = await this.getInvitationByToken(token);
    if (!inv || inv.acceptedAt || new Date() > inv.expiresAt) {
      throw new Error('La invitación no es válida o ya ha expirado.');
    }

    const now = new Date();
    const newUserId = `user_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    await db.transaction(async (tx: any) => {
      await tx.insert(schema.users).values({
        id: newUserId,
        organizationId: inv.organizationId,
        name: inv.name,
        email: inv.email,
        passwordHash,
        role: inv.role as any,
        crewId: inv.crewId,
        baseDailyWage: 100000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await tx
        .update(schema.invitations)
        .set({ acceptedAt: now })
        .where(eq(schema.invitations.id, inv.id));
    });

    return (await this.getUser(newUserId))!;
  }

  /**
   * RECUPERACIÓN DE CONTRASEÑA (Tokens seguros de un solo uso)
   */
  async createPasswordReset(email: string): Promise<{ token: string; userName: string } | null> {
    assertDatabaseAvailable();
    const user = await this.getUserByEmail(email);
    if (!user || !user.isActive) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hora de validez
    const newId = `reset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      dataStore.createPasswordReset(email);
      return { token, userName: user.name };
    }

    await db.insert(schema.passwordResetTokens).values({
      id: newId,
      userId: user.id,
      token,
      expiresAt,
      createdAt: new Date(),
    });

    return { token, userName: user.name };
  }

  async verifyResetToken(token: string): Promise<boolean> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return true;
    }

    const [row] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(and(eq(schema.passwordResetTokens.token, token)));

    if (!row || row.usedAt || new Date() > row.expiresAt) {
      return false;
    }

    return true;
  }

  async resetPasswordWithToken(token: string, passwordHash: string): Promise<boolean> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.resetPasswordWithToken(token, passwordHash);
    }

    const [row] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(and(eq(schema.passwordResetTokens.token, token)));

    if (!row || row.usedAt || new Date() > row.expiresAt) {
      return false;
    }

    const user = await this.getUser(row.userId);
    const targetOrgId = user?.organizationId || 'org_mepy_2026';

    const now = new Date();
    await db.transaction(async (tx: any) => {
      // 1. Quemamos el token para que sea de UN SOLO USO
      await tx
        .update(schema.passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(schema.passwordResetTokens.id, row.id));

      // 2. Actualizamos la contraseña del usuario
      await tx
        .update(schema.users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(schema.users.id, row.userId));

      // 3. Auditoría
      await tx.insert(schema.auditLogs).values({
        id: `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        organizationId: targetOrgId,
        userId: row.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'USER',
        entityId: row.userId,
        details: { resetAt: now.toISOString() },
        createdAt: now,
      });
    });

    return true;
  }

  async listAuditLogs(orgId: string = 'org_mepy_2026'): Promise<AuditLogData[]> {
    assertDatabaseAvailable();
    if (!isDatabaseConnected() && isDemoModeEnabled()) {
      return dataStore.listAuditLogs(orgId);
    }

    const rows = await db
      .select({
        id: schema.auditLogs.id,
        organizationId: schema.auditLogs.organizationId,
        userId: schema.auditLogs.userId,
        userName: schema.users.name,
        action: schema.auditLogs.action,
        entity: schema.auditLogs.entity,
        entityId: schema.auditLogs.entityId,
        details: schema.auditLogs.details,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .where(eq(schema.auditLogs.organizationId, orgId))
      .orderBy(desc(schema.auditLogs.createdAt));

    return rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      userId: r.userId || '',
      userName: r.userName || undefined,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      details: (r.details as Record<string, unknown>) || undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export const dbService = new DatabaseService();
