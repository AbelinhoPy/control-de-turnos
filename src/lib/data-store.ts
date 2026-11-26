// src/lib/data-store.ts
// Capa de acceso unificada para Neon Postgres / Fallback de Demostración Local
import bcrypt from 'bcryptjs';
import { calculateShiftHours, APP_TIMEZONE, formatDateAsuncion } from './time/timezone';

export interface OrgData {
  id: string;
  name: string;
  slug: string;
  nightHourStart: string; // "20:00"
  nightHourEnd: string;   // "06:00"
  nightSurchargePercent: number; // 30
  workplaceName: string;
  workplaceLat: number;
  workplaceLng: number;
  geofenceRadiusMeters: number;
  halfDayRuleConfirmed: boolean;
  hourlyRateRuleConfirmed: boolean;
  requirePhotoOnClock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrewData {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  type: 'FIXED' | 'ROTATING';
  description: string;
  color: string;
  badgeColorClass: string;
}

export interface ShiftTemplateData {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: number;
  crossesMidnight: boolean;
  targetHeadcount: number;
  colorClass: string;
}

export interface UserData {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'FUNCIONARIO';
  crewId: string | null;
  documentNumber?: string;
  phone?: string;
  baseDailyWage: number; // PYG
  isActive: boolean;
  deactivatedAt?: string | null;
  createdAt: string;
}

export interface ShiftData {
  id: string;
  organizationId: string;
  userId: string;
  crewId: string | null;
  shiftTemplateId: string;
  shiftCode: string; // M, T, N, L
  date: string; // YYYY-MM-DD
  isPublished: boolean;
  publishedAt?: string | null;
  publishedByUserId?: string | null;
  notes?: string;
}

export interface AttendanceData {
  id: string;
  organizationId: string;
  userId: string;
  shiftId?: string | null;
  date: string; // YYYY-MM-DD (fecha del inicio del turno)
  clockInTime?: string | null; // ISO timestamptz
  clockInLat?: number | null;
  clockInLng?: number | null;
  clockInAccuracy?: number | null;
  clockInDistanceMeters?: number | null;
  clockInStatus?: 'VALID' | 'MANUAL' | 'GEOFENCE_WARNING';
  clockInPhoto?: string | null;
  clockOutTime?: string | null; // ISO timestamptz
  clockOutLat?: number | null;
  clockOutLng?: number | null;
  clockOutAccuracy?: number | null;
  clockOutDistanceMeters?: number | null;
  clockOutStatus?: 'VALID' | 'MANUAL' | 'GEOFENCE_WARNING';
  clockOutPhoto?: string | null;
  workedDays: number; // 1.0, 0.5, 0
  dayHours: number;
  nightHours: number;
  totalHours: number;
  status: 'EN_CURSO' | 'COMPLETA' | 'INCOMPLETA' | 'AUSENTE' | 'LIBRE' | 'JUSTIFICADA';
  isManualCorrection: boolean;
  correctionReason?: string | null;
  correctedByUserId?: string | null;
  correctedByName?: string | null;
  correctedAt?: string | null;
  idempotencyToken?: string | null;
  notes?: string | null;
  gpsRiskScore?: number | null;
  gpsRiskFlags?: string | null;
}

export interface AttendanceIncidentData {
  id: string;
  organizationId: string;
  userId: string;
  userName?: string;
  attendanceId?: string | null;
  date: string;
  type: 'GPS_ERROR' | 'FORGOT_CLOCK_OUT' | 'FORGOT_CLOCK_IN' | 'DISCREPANCY' | 'OTHER';
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  resolutionNotes?: string | null;
  resolvedByUserId?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface PeriodClosureData {
  id: string;
  organizationId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'BORRADOR' | 'APROBADO';
  approvedAt?: string | null;
  approvedByUserId?: string | null;
  approvedByName?: string | null;
  nightHourStart: string;
  nightHourEnd: string;
  nightSurchargePercent: number;
  rulesSnapshot: {
    halfDayRuleConfirmed: boolean;
    hourlyRateRuleConfirmed: boolean;
    nightHourStart: string;
    nightHourEnd: string;
    nightSurchargePercent: number;
    wageCalculationFormula: string;
  };
  summaryData: {
    totalEmployees: number;
    totalDaysWorked: number;
    totalHalfDays: number;
    totalDayHours: number;
    totalNightHours: number;
    totalHours: number;
    payrollStatus: 'PENDIENTE_CONFIGURACION' | 'APROBADO';
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogData {
  id: string;
  organizationId: string;
  userId: string;
  userName?: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// In-Memory Seed State
class DataStoreManager {
  private organization: OrgData;
  private crews: CrewData[] = [];
  private shiftTemplates: ShiftTemplateData[] = [];
  private users: UserData[] = [];
  private shifts: ShiftData[] = [];
  private attendances: AttendanceData[] = [];
  private incidents: AttendanceIncidentData[] = [];
  private periodClosures: PeriodClosureData[] = [];
  private invitations: Array<{
    id: string;
    organizationId: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'FUNCIONARIO';
    crewId?: string | null;
    token: string;
    expiresAt: string;
    acceptedAt?: string | null;
  }> = [];
  private resetTokens: Array<{
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
    usedAt?: string | null;
  }> = [];
  private auditLogs: AuditLogData[] = [];

  constructor() {
    this.organization = {
      id: 'org_mepy_2026',
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
      requirePhotoOnClock: true,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-21T18:00:00Z',
    };

    this.initSeedData();
  }

  private initSeedData() {
    const salt = bcrypt.genSaltSync(10);
    const defaultHash = bcrypt.hashSync('Control2026!', salt);

    // 1. Cuadrillas
    this.crews = [
      {
        id: 'crew_a',
        organizationId: this.organization.id,
        name: 'Equipo A',
        code: 'A',
        type: 'FIXED',
        description: 'Fijo Mañana (06:00 a 14:00) - Libera días 1 y 2',
        color: 'Azul Real',
        badgeColorClass: 'bg-blue-100 text-blue-800 border-blue-300',
      },
      {
        id: 'crew_b',
        organizationId: this.organization.id,
        name: 'Equipo B',
        code: 'B',
        type: 'FIXED',
        description: 'Fijo Tarde (14:00 a 22:00) - Libera días 3 y 4',
        color: 'Verde Esmeralda',
        badgeColorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      },
      {
        id: 'crew_c',
        organizationId: this.organization.id,
        name: 'Equipo C',
        code: 'C',
        type: 'FIXED',
        description: 'Fijo Noche (22:00 a 06:00) - Libera días 5 y 6',
        color: 'Violeta Intenso',
        badgeColorClass: 'bg-purple-100 text-purple-800 border-purple-300',
      },
      {
        id: 'crew_d',
        organizationId: this.organization.id,
        name: 'Equipo D (Volante)',
        code: 'D',
        type: 'ROTATING',
        description: 'Volante (Rotación Natural: 2M -> 2T -> 2N -> 2L)',
        color: 'Naranja Vivo',
        badgeColorClass: 'bg-amber-100 text-amber-800 border-amber-300',
      },
    ];

    // 2. Plantillas de turnos
    this.shiftTemplates = [
      {
        id: 'st_m',
        organizationId: this.organization.id,
        code: 'M',
        name: 'Mañana',
        startTime: '06:00',
        endTime: '14:00',
        durationHours: 8,
        crossesMidnight: false,
        targetHeadcount: 2,
        colorClass: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      {
        id: 'st_t',
        organizationId: this.organization.id,
        code: 'T',
        name: 'Tarde',
        startTime: '14:00',
        endTime: '22:00',
        durationHours: 8,
        crossesMidnight: false,
        targetHeadcount: 2,
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        id: 'st_n',
        organizationId: this.organization.id,
        code: 'N',
        name: 'Noche',
        startTime: '22:00',
        endTime: '06:00',
        durationHours: 8,
        crossesMidnight: true,
        targetHeadcount: 2,
        colorClass: 'bg-purple-50 text-purple-700 border-purple-200',
      },
      {
        id: 'st_l',
        organizationId: this.organization.id,
        code: 'L',
        name: 'Libre',
        startTime: null,
        endTime: null,
        durationHours: 0,
        crossesMidnight: false,
        targetHeadcount: 0,
        colorClass: 'bg-gray-100 text-gray-500 border-gray-200',
      },
    ];

    // 3. Usuarios
    // Admin principal: Aldo Samudio
    this.users = [
      {
        id: 'user_admin',
        organizationId: this.organization.id,
        name: 'Aldo Samudio',
        email: 'aldo.samudio@empresa.com.py',
        passwordHash: defaultHash,
        role: 'ADMIN',
        crewId: null,
        documentNumber: '1.234.567',
        phone: '+595 981 100 200',
        baseDailyWage: 0,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      // Equipo A (Fijo Mañana)
      {
        id: 'user_p1',
        organizationId: this.organization.id,
        name: 'Porfirio Giménez',
        email: 'porfirio.gimenez@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_a',
        documentNumber: '3.456.789',
        phone: '+595 981 200 301',
        baseDailyWage: 120000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'user_p2',
        organizationId: this.organization.id,
        name: 'David Rojas',
        email: 'david.rojas@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_a',
        documentNumber: '4.123.456',
        phone: '+595 981 200 302',
        baseDailyWage: 120000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      // Equipo B (Fijo Tarde)
      {
        id: 'user_p3',
        organizationId: this.organization.id,
        name: 'Rubén Cáceres',
        email: 'ruben.caceres@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_b',
        documentNumber: '2.987.654',
        phone: '+595 981 200 303',
        baseDailyWage: 120000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'user_p4',
        organizationId: this.organization.id,
        name: 'Mario Ayala',
        email: 'mario.ayala@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_b',
        documentNumber: '3.789.012',
        phone: '+595 981 200 304',
        baseDailyWage: 120000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      // Equipo C (Fijo Noche)
      {
        id: 'user_p5',
        organizationId: this.organization.id,
        name: 'Darío Fernández',
        email: 'dario.fernandez@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_c',
        documentNumber: '4.567.890',
        phone: '+595 981 200 305',
        baseDailyWage: 130000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'user_p6',
        organizationId: this.organization.id,
        name: 'Ariel Martínez',
        email: 'ariel.martinez@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_c',
        documentNumber: '5.123.789',
        phone: '+595 981 200 306',
        baseDailyWage: 130000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      // Equipo D (Volante)
      {
        id: 'user_p7',
        organizationId: this.organization.id,
        name: 'Edgar Romero',
        email: 'edgar.romero@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_d',
        documentNumber: '3.654.321',
        phone: '+595 981 200 307',
        baseDailyWage: 125000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'user_p8',
        organizationId: this.organization.id,
        name: 'Marcelo Benítez',
        email: 'marcelo.benitez@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_d',
        documentNumber: '4.890.123',
        phone: '+595 981 200 308',
        baseDailyWage: 125000,
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
      // Funcionario Desactivado con historial
      {
        id: 'user_p9_desactivado',
        organizationId: this.organization.id,
        name: 'Carlos Duarte (Baja)',
        email: 'carlos.duarte@demo.com',
        passwordHash: defaultHash,
        role: 'FUNCIONARIO',
        crewId: 'crew_a',
        documentNumber: '2.345.678',
        phone: '+595 981 999 888',
        baseDailyWage: 110000,
        isActive: false,
        deactivatedAt: '2026-11-10T12:00:00Z',
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];

    // 4. Generar Programación de Noviembre 2026 (exacta al Excel de MEPY)
    // Patrón volante: 2M -> 2T -> 2N -> 2L
    // Fechas del 1 al 30 de Noviembre de 2026
    const daysInNov = 30;
    const volanteSequence = ['M', 'M', 'T', 'T', 'N', 'N', 'L', 'L'];

    for (let day = 1; day <= daysInNov; day++) {
      const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
      
      // Ciclo para equipo fijo:
      // Equipo A (M): Trabaja 6 días, descansa 2 (o cubre según rotación)
      // En la plantilla MEPY: 4 y 5 descanso, 6 al 11 Mañana, etc.
      const dayMod8 = (day - 1) % 8;
      
      // Asignar a cada empleado
      for (const u of this.users) {
        if (u.role === 'ADMIN') continue;

        let code = 'L';
        if (u.crewId === 'crew_a') {
          // Mañana (libera 2 días cada 8)
          code = dayMod8 === 3 || dayMod8 === 4 ? 'L' : 'M';
        } else if (u.crewId === 'crew_b') {
          // Tarde (libera 2 días cada 8)
          code = dayMod8 === 5 || dayMod8 === 6 ? 'L' : 'T';
        } else if (u.crewId === 'crew_c') {
          // Noche (libera 2 días cada 8)
          code = dayMod8 === 7 || dayMod8 === 0 ? 'L' : 'N';
        } else if (u.crewId === 'crew_d') {
          // Volante: 2M -> 2T -> 2N -> 2L
          code = volanteSequence[(day - 1) % 8];
        }

        // Si es el usuario desactivado y la fecha es posterior al 10/11, no tiene turnos programados
        if (u.id === 'user_p9_desactivado' && day > 10) {
          continue;
        }

        const template = this.shiftTemplates.find((st) => st.code === code) || this.shiftTemplates[0];

        const shiftId = `shift_${u.id}_${dateStr}`;
        this.shifts.push({
          id: shiftId,
          organizationId: this.organization.id,
          userId: u.id,
          crewId: u.crewId,
          shiftTemplateId: template.id,
          shiftCode: code,
          date: dateStr,
          isPublished: true,
          publishedAt: '2026-10-31T18:00:00Z',
          publishedByUserId: 'user_admin',
          notes: u.crewId === 'crew_d' ? 'Cobertura volante' : 'Turno regular',
        });

        // 5. Asistencias para la primera quincena (1 al 15 Nov)
        if (day <= 15) {
          this.generateDemoAttendance(u, dateStr, code, shiftId, day);
        }
      }
    }

    // Incidencia pendiente de revisión
    this.incidents.push({
      id: 'inc_101',
      organizationId: this.organization.id,
      userId: 'user_p1',
      userName: 'Porfirio Giménez',
      attendanceId: 'att_user_p1_2026-11-12',
      date: '2026-11-12',
      type: 'GPS_ERROR',
      description: 'El GPS del celular marcó fuera del radio al ingresar a la caseta por interferencia de señal.',
      status: 'PENDING',
      createdAt: '2026-11-12T06:15:00Z',
    });

    // Incidencia ya resuelta por Aldo
    this.incidents.push({
      id: 'inc_102',
      organizationId: this.organization.id,
      userId: 'user_p7',
      userName: 'Edgar Romero',
      attendanceId: 'att_user_p7_2026-11-08',
      date: '2026-11-08',
      type: 'FORGOT_CLOCK_OUT',
      description: 'Olvidó registrar salida a las 06:00 hs por relevo de emergencia.',
      status: 'APPROVED',
      resolutionNotes: 'Verificado con el compañero del relevo de guardia. Marcación aprobada.',
      resolvedByUserId: 'user_admin',
      resolvedByName: 'Aldo Samudio',
      resolvedAt: '2026-11-09T08:30:00Z',
      createdAt: '2026-11-08T07:10:00Z',
    });

    // Cierre de período histórico (1ª Quincena Noviembre 2026) en estado BORRADOR
    this.periodClosures.push({
      id: 'closure_nov_2026_q1',
      organizationId: this.organization.id,
      name: '1ª Quincena Noviembre 2026',
      startDate: '2026-11-01',
      endDate: '2026-11-15',
      status: 'BORRADOR',
      nightHourStart: '20:00',
      nightHourEnd: '06:00',
      nightSurchargePercent: 30,
      rulesSnapshot: {
        halfDayRuleConfirmed: false,
        hourlyRateRuleConfirmed: false,
        nightHourStart: '20:00',
        nightHourEnd: '06:00',
        nightSurchargePercent: 30,
        wageCalculationFormula: 'Pendiente de confirmación administrativa (Jornal base / 8h + 30% recargo)',
      },
      summaryData: {
        totalEmployees: 9,
        totalDaysWorked: 92,
        totalHalfDays: 1,
        totalDayHours: 546,
        totalNightHours: 198,
        totalHours: 744,
        payrollStatus: 'PENDIENTE_CONFIGURACION',
      },
      createdAt: '2026-11-16T08:00:00Z',
      updatedAt: '2026-11-21T17:00:00Z',
    });

    // Auditoría
    this.auditLogs.push({
      id: 'aud_1',
      organizationId: this.organization.id,
      userId: 'user_admin',
      userName: 'Aldo Samudio',
      action: 'SHIFT_PUBLISHED',
      entity: 'shifts',
      entityId: 'plan_nov_2026',
      details: { period: 'Noviembre 2026', totalShifts: this.shifts.length },
      createdAt: '2026-10-31T18:00:00Z',
    });
  }

  private generateDemoAttendance(
    user: UserData,
    dateStr: string,
    shiftCode: string,
    shiftId: string,
    day: number
  ) {
    const attId = `att_${user.id}_${dateStr}`;

    // Si es Libre
    if (shiftCode === 'L') {
      this.attendances.push({
        id: attId,
        organizationId: this.organization.id,
        userId: user.id,
        shiftId,
        date: dateStr,
        workedDays: 0,
        dayHours: 0,
        nightHours: 0,
        totalHours: 0,
        status: 'LIBRE',
        isManualCorrection: false,
        notes: 'Día Libre programado',
      });
      return;
    }

    // Caso especial: Medio jornal aprobado (Día 11 para David Rojas user_p2)
    if (user.id === 'user_p2' && day === 11) {
      const clockIn = `${dateStr}T06:00:00-03:00`;
      const clockOut = `${dateStr}T10:00:00-03:00`; // 4 horas
      const calc = calculateShiftHours(clockIn, clockOut);
      this.attendances.push({
        id: attId,
        organizationId: this.organization.id,
        userId: user.id,
        shiftId,
        date: dateStr,
        clockInTime: clockIn,
        clockInLat: -25.4964,
        clockInLng: -54.7896,
        clockInAccuracy: 14,
        clockInDistanceMeters: 18,
        clockInStatus: 'VALID',
        clockOutTime: clockOut,
        clockOutLat: -25.4965,
        clockOutLng: -54.7897,
        clockOutAccuracy: 12,
        clockOutDistanceMeters: 22,
        clockOutStatus: 'VALID',
        workedDays: 0.5, // MEDIO JORNAL APROBADO
        dayHours: 4,
        nightHours: 0,
        totalHours: 4,
        status: 'COMPLETA',
        isManualCorrection: true,
        correctionReason: 'Retiro anticipado autorizado por consulta médica. Medio jornal aprobado.',
        correctedByUserId: 'user_admin',
        correctedByName: 'Aldo Samudio',
        correctedAt: `${dateStr}T11:00:00-03:00`,
        notes: 'Medio jornal aprobado por Aldo Samudio',
      });
      return;
    }

    // Caso especial: Corrección manual de marcación olvidada (Día 8 para Edgar Romero user_p7)
    if (user.id === 'user_p7' && day === 8) {
      const clockIn = `${dateStr}T22:00:00-03:00`;
      const nextDate = `2026-11-09`;
      const clockOut = `${nextDate}T06:00:00-03:00`;
      const calc = calculateShiftHours(clockIn, clockOut);
      this.attendances.push({
        id: attId,
        organizationId: this.organization.id,
        userId: user.id,
        shiftId,
        date: dateStr,
        clockInTime: clockIn,
        clockInLat: -25.496469,
        clockInLng: -54.789641,
        clockInAccuracy: 10,
        clockInDistanceMeters: 5,
        clockInStatus: 'VALID',
        clockOutTime: clockOut,
        clockOutLat: -25.496469,
        clockOutLng: -54.789641,
        clockOutAccuracy: 0,
        clockOutDistanceMeters: 0,
        clockOutStatus: 'MANUAL',
        workedDays: 1,
        dayHours: calc.dayHours,
        nightHours: calc.nightHours, // 8h nocturnas
        totalHours: calc.totalHours,
        status: 'COMPLETA',
        isManualCorrection: true,
        correctionReason: 'Corrección manual de salida por olvido de marcación validado con relevo.',
        correctedByUserId: 'user_admin',
        correctedByName: 'Aldo Samudio',
        correctedAt: `${nextDate}T08:30:00-03:00`,
        notes: 'Salida cargada manualmente por administración',
      });
      return;
    }

    // Caso especial: Marcación incompleta (Día 14 para Ramón Peralta user_p6)
    if (user.id === 'user_p6' && day === 14) {
      const clockIn = `${dateStr}T22:03:00-03:00`;
      this.attendances.push({
        id: attId,
        organizationId: this.organization.id,
        userId: user.id,
        shiftId,
        date: dateStr,
        clockInTime: clockIn,
        clockInLat: -25.4964,
        clockInLng: -54.7896,
        clockInAccuracy: 18,
        clockInDistanceMeters: 24,
        clockInStatus: 'VALID',
        clockOutTime: null,
        workedDays: 0,
        dayHours: 0,
        nightHours: 0,
        totalHours: 0,
        status: 'INCOMPLETA',
        isManualCorrection: false,
        notes: 'Falta marcación de salida',
      });
      return;
    }

    // Caso especial: Ausencia (Día 7 para Porfirio Giménez user_p1)
    if (user.id === 'user_p1' && day === 7) {
      this.attendances.push({
        id: attId,
        organizationId: this.organization.id,
        userId: user.id,
        shiftId,
        date: dateStr,
        workedDays: 0,
        dayHours: 0,
        nightHours: 0,
        totalHours: 0,
        status: 'AUSENTE',
        isManualCorrection: false,
        notes: 'Ausencia sin aviso',
      });
      return;
    }

    // Jornadas normales según turno
    let clockIn: string;
    let clockOut: string;

    if (shiftCode === 'M') {
      clockIn = `${dateStr}T05:58:00-03:00`;
      clockOut = `${dateStr}T14:02:00-03:00`;
    } else if (shiftCode === 'T') {
      clockIn = `${dateStr}T13:57:00-03:00`;
      clockOut = `${dateStr}T22:04:00-03:00`;
    } else {
      // Noche: entra a las 22:00 y sale a las 06:00 del día siguiente
      clockIn = `${dateStr}T21:55:00-03:00`;
      const nextDayNum = day + 1;
      const nextDateStr = `2026-11-${String(nextDayNum).padStart(2, '0')}`;
      clockOut = `${nextDateStr}T06:03:00-03:00`;
    }

    const calc = calculateShiftHours(clockIn, clockOut);

    this.attendances.push({
      id: attId,
      organizationId: this.organization.id,
      userId: user.id,
      shiftId,
      date: dateStr,
      clockInTime: clockIn,
      clockInLat: -25.496469 + (Math.random() - 0.5) * 0.0003,
      clockInLng: -54.789641 + (Math.random() - 0.5) * 0.0003,
      clockInAccuracy: 12 + Math.floor(Math.random() * 10),
      clockInDistanceMeters: 15 + Math.floor(Math.random() * 40),
      clockInStatus: 'VALID',
      clockOutTime: clockOut,
      clockOutLat: -25.496469 + (Math.random() - 0.5) * 0.0003,
      clockOutLng: -54.789641 + (Math.random() - 0.5) * 0.0003,
      clockOutAccuracy: 10 + Math.floor(Math.random() * 8),
      clockOutDistanceMeters: 12 + Math.floor(Math.random() * 35),
      clockOutStatus: 'VALID',
      workedDays: calc.workedDays,
      dayHours: calc.dayHours,
      nightHours: calc.nightHours,
      totalHours: calc.totalHours,
      status: 'COMPLETA',
      isManualCorrection: false,
    });
  }

  // --- MÉTODOS PÚBLICOS ---

  public getOrganization(orgId: string): OrgData {
    return this.organization;
  }

  public updateOrganization(orgId: string, updates: Partial<OrgData>): OrgData {
    this.organization = {
      ...this.organization,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.organization;
  }

  public listCrews(orgId: string): CrewData[] {
    return this.crews.filter((c) => c.organizationId === orgId);
  }

  public listShiftTemplates(orgId: string): ShiftTemplateData[] {
    return this.shiftTemplates.filter((s) => s.organizationId === orgId);
  }

  public listUsers(orgId: string, includeDeactivated = false): UserData[] {
    return this.users.filter(
      (u) => u.organizationId === orgId && (includeDeactivated || u.isActive)
    );
  }

  public getUserById(userId: string): UserData | undefined {
    return this.users.find((u) => u.id === userId);
  }

  public getUserByEmail(email: string): UserData | undefined {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(userData: Omit<UserData, 'id' | 'createdAt'>): UserData {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user: UserData = {
      ...userData,
      id,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  public updateUser(userId: string, updates: Partial<UserData>): UserData {
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('Usuario no encontrado');
    this.users[idx] = { ...this.users[idx], ...updates };
    return this.users[idx];
  }

  public deactivateUser(userId: string): UserData {
    return this.updateUser(userId, {
      isActive: false,
      deactivatedAt: new Date().toISOString(),
    });
  }

  public reactivateUser(userId: string): UserData {
    return this.updateUser(userId, {
      isActive: true,
      deactivatedAt: null,
    });
  }

  public listShifts(orgId: string, filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    crewId?: string;
    onlyPublished?: boolean;
  }): ShiftData[] {
    return this.shifts.filter((s) => {
      if (s.organizationId !== orgId) return false;
      if (filters?.startDate && s.date < filters.startDate) return false;
      if (filters?.endDate && s.date > filters.endDate) return false;
      if (filters?.userId && s.userId !== filters.userId) return false;
      if (filters?.crewId && s.crewId !== filters.crewId) return false;
      if (filters?.onlyPublished && !s.isPublished) return false;
      return true;
    });
  }

  public saveShift(shift: Omit<ShiftData, 'id'> & { id?: string }): ShiftData {
    if (shift.id) {
      const idx = this.shifts.findIndex((s) => s.id === shift.id);
      if (idx !== -1) {
        this.shifts[idx] = { ...this.shifts[idx], ...shift };
        return this.shifts[idx];
      }
    }
    const existingIdx = this.shifts.findIndex(
      (s) => s.userId === shift.userId && s.date === shift.date
    );
    const newShift: ShiftData = {
      ...shift,
      id: shift.id || `shift_${shift.userId}_${shift.date}`,
    };
    if (existingIdx !== -1) {
      this.shifts[existingIdx] = newShift;
    } else {
      this.shifts.push(newShift);
    }
    return newShift;
  }

  public publishShifts(orgId: string, startDate: string, endDate: string, adminUserId: string) {
    let count = 0;
    const now = new Date().toISOString();
    for (const s of this.shifts) {
      if (s.organizationId === orgId && s.date >= startDate && s.date <= endDate) {
        s.isPublished = true;
        s.publishedAt = now;
        s.publishedByUserId = adminUserId;
        count++;
      }
    }
    return { count };
  }

  public listAttendances(orgId: string, filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    status?: string;
  }): AttendanceData[] {
    return this.attendances.filter((a) => {
      if (a.organizationId !== orgId) return false;
      if (filters?.startDate && a.date < filters.startDate) return false;
      if (filters?.endDate && a.date > filters.endDate) return false;
      if (filters?.userId && a.userId !== filters.userId) return false;
      if (filters?.status && a.status !== filters.status) return false;
      return true;
    });
  }

  public getAttendanceByDate(userId: string, dateStr: string): AttendanceData | undefined {
    return this.attendances.find((a) => a.userId === userId && a.date === dateStr);
  }

  public recordClockIn(params: {
    userId: string;
    organizationId: string;
    date: string;
    timestamp: Date;
    lat: number;
    lng: number;
    accuracy: number;
    distanceMeters: number;
    status: 'VALID' | 'GEOFENCE_WARNING';
    shiftId?: string | null;
    photo?: string | null;
    idempotencyToken?: string;
  }): AttendanceData {
    // Verificar idempotencia
    if (params.idempotencyToken) {
      const existing = this.attendances.find(
        (a) => a.idempotencyToken === params.idempotencyToken
      );
      if (existing) return existing;
    }

    const existingAtt = this.getAttendanceByDate(params.userId, params.date);
    const inTimeIso = params.timestamp.toISOString();

    if (existingAtt) {
      existingAtt.clockInTime = inTimeIso;
      existingAtt.clockInLat = params.lat;
      existingAtt.clockInLng = params.lng;
      existingAtt.clockInAccuracy = params.accuracy;
      existingAtt.clockInDistanceMeters = params.distanceMeters;
      existingAtt.clockInStatus = params.status;
      if (params.photo) existingAtt.clockInPhoto = params.photo;
      existingAtt.status = 'EN_CURSO';
      existingAtt.idempotencyToken = params.idempotencyToken;
      return existingAtt;
    }

    const newAtt: AttendanceData = {
      id: `att_${params.userId}_${params.date}`,
      organizationId: params.organizationId,
      userId: params.userId,
      shiftId: params.shiftId,
      date: params.date,
      clockInTime: inTimeIso,
      clockInLat: params.lat,
      clockInLng: params.lng,
      clockInAccuracy: params.accuracy,
      clockInDistanceMeters: params.distanceMeters,
      clockInStatus: params.status,
      clockInPhoto: params.photo ?? null,
      workedDays: 0,
      dayHours: 0,
      nightHours: 0,
      totalHours: 0,
      status: 'EN_CURSO',
      isManualCorrection: false,
      idempotencyToken: params.idempotencyToken,
    };
    this.attendances.push(newAtt);
    return newAtt;
  }

  public recordClockOut(params: {
    attendanceId: string;
    timestamp: Date;
    lat: number;
    lng: number;
    accuracy: number;
    distanceMeters: number;
    status: 'VALID' | 'GEOFENCE_WARNING';
    photo?: string | null;
    idempotencyToken?: string;
  }): AttendanceData {
    const att = this.attendances.find((a) => a.id === params.attendanceId);
    if (!att) throw new Error('Registro de asistencia no encontrado');

    // La salida nunca debe registrarse sin una entrada previa válida
    if (!att.clockInTime) {
      throw new Error('No se puede registrar salida en una jornada sin hora de entrada válida.');
    }

    // Proteger salida ya registrada (evitar sobreescrituras en reintentos)
    if (att.clockOutTime) {
      return att;
    }

    const outTimeIso = params.timestamp.toISOString();
    att.clockOutTime = outTimeIso;
    att.clockOutLat = params.lat;
    att.clockOutLng = params.lng;
    att.clockOutAccuracy = params.accuracy;
    att.clockOutDistanceMeters = params.distanceMeters;
    att.clockOutStatus = params.status;
    if (params.photo) att.clockOutPhoto = params.photo;
    if (params.idempotencyToken) {
      att.idempotencyToken = params.idempotencyToken;
    }

    const calc = calculateShiftHours(att.clockInTime, outTimeIso);
    att.totalHours = calc.totalHours;
    att.dayHours = calc.dayHours;
    att.nightHours = calc.nightHours;
    att.workedDays = calc.workedDays;
    att.status = 'COMPLETA';
    if (params.idempotencyToken) {
      att.idempotencyToken = params.idempotencyToken;
    }

    return att;
  }

  public correctAttendance(params: {
    attendanceId?: string;
    userId: string;
    organizationId: string;
    date: string;
    clockInTime?: string | null;
    clockOutTime?: string | null;
    workedDays?: number;
    status: AttendanceData['status'];
    correctionReason: string;
    correctedByUserId: string;
    correctedByName: string;
    notes?: string;
  }): AttendanceData {
    let att = params.attendanceId
      ? this.attendances.find((a) => a.id === params.attendanceId)
      : this.getAttendanceByDate(params.userId, params.date);

    if (!att) {
      att = {
        id: `att_${params.userId}_${params.date}`,
        organizationId: params.organizationId,
        userId: params.userId,
        date: params.date,
        workedDays: 0,
        dayHours: 0,
        nightHours: 0,
        totalHours: 0,
        status: params.status,
        isManualCorrection: true,
      };
      this.attendances.push(att);
    }

    att.clockInTime = params.clockInTime;
    att.clockOutTime = params.clockOutTime;
    att.status = params.status;
    att.isManualCorrection = true;
    att.correctionReason = params.correctionReason;
    att.correctedByUserId = params.correctedByUserId;
    att.correctedByName = params.correctedByName;
    att.correctedAt = new Date().toISOString();
    if (params.notes) att.notes = params.notes;

    if (att.clockInTime && att.clockOutTime) {
      const calc = calculateShiftHours(att.clockInTime, att.clockOutTime);
      att.totalHours = calc.totalHours;
      att.dayHours = calc.dayHours;
      att.nightHours = calc.nightHours;
      att.workedDays = params.workedDays !== undefined ? params.workedDays : calc.workedDays;
    } else if (params.workedDays !== undefined) {
      att.workedDays = params.workedDays;
    }

    // Registrar en auditoría
    this.createAuditLog({
      organizationId: params.organizationId,
      userId: params.correctedByUserId,
      userName: params.correctedByName,
      action: 'ATTENDANCE_CORRECTED',
      entity: 'attendances',
      entityId: att.id,
      details: {
        date: params.date,
        reason: params.correctionReason,
        status: att.status,
        totalHours: att.totalHours,
      },
    });

    return att;
  }

  public listIncidents(orgId: string, status?: string): AttendanceIncidentData[] {
    return this.incidents.filter(
      (inc) => inc.organizationId === orgId && (!status || inc.status === status)
    );
  }

  public createIncident(data: Omit<AttendanceIncidentData, 'id' | 'createdAt'>): AttendanceIncidentData {
    const incident: AttendanceIncidentData = {
      ...data,
      id: `inc_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.incidents.push(incident);
    return incident;
  }

  public resolveIncident(params: {
    incidentId: string;
    status: 'APPROVED' | 'REJECTED';
    resolutionNotes: string;
    resolvedByUserId: string;
    resolvedByName: string;
  }): AttendanceIncidentData {
    const inc = this.incidents.find((i) => i.id === params.incidentId);
    if (!inc) throw new Error('Incidencia no encontrada');

    inc.status = params.status;
    inc.resolutionNotes = params.resolutionNotes;
    inc.resolvedByUserId = params.resolvedByUserId;
    inc.resolvedByName = params.resolvedByName;
    inc.resolvedAt = new Date().toISOString();

    return inc;
  }

  public listPeriodClosures(orgId: string): PeriodClosureData[] {
    return this.periodClosures.filter((p) => p.organizationId === orgId);
  }

  public createPeriodClosure(data: Omit<PeriodClosureData, 'id' | 'createdAt' | 'updatedAt'>): PeriodClosureData {
    const closure: PeriodClosureData = {
      ...data,
      id: `closure_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.periodClosures.push(closure);
    return closure;
  }

  public approvePeriodClosure(closureId: string, adminUserId: string, adminName: string): PeriodClosureData {
    const closure = this.periodClosures.find((c) => c.id === closureId);
    if (!closure) throw new Error('Cierre de período no encontrado');

    closure.status = 'APROBADO';
    closure.approvedAt = new Date().toISOString();
    closure.approvedByUserId = adminUserId;
    closure.approvedByName = adminName;
    closure.updatedAt = new Date().toISOString();

    this.createAuditLog({
      organizationId: closure.organizationId,
      userId: adminUserId,
      userName: adminName,
      action: 'PERIOD_CLOSED_APPROVED',
      entity: 'period_closures',
      entityId: closure.id,
      details: {
        period: closure.name,
        startDate: closure.startDate,
        endDate: closure.endDate,
        summary: closure.summaryData,
      },
    });

    return closure;
  }

  public createAuditLog(data: Omit<AuditLogData, 'id' | 'createdAt'>): AuditLogData {
    const log: AuditLogData = {
      ...data,
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.push(log);
    return log;
  }

  public listAuditLogs(orgId: string): AuditLogData[] {
    return this.auditLogs
      .filter((a) => a.organizationId === orgId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  public createInvitation(data: {
    organizationId: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'FUNCIONARIO';
    crewId?: string | null;
    invitedByUserId: string;
  }) {
    const token = `inv_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inv = {
      id: `inv_${Date.now()}`,
      ...data,
      token,
      expiresAt,
    };
    this.invitations.push(inv);
    return inv;
  }

  public getInvitationByToken(token: string) {
    const inv = this.invitations.find((i) => i.token === token && !i.acceptedAt);
    if (!inv) return null;
    if (new Date(inv.expiresAt).getTime() < Date.now()) return null;
    return inv;
  }

  public acceptInvitation(token: string, password: string): UserData {
    const inv = this.getInvitationByToken(token);
    if (!inv) throw new Error('Invitación inválida o expirada');

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const user = this.createUser({
      organizationId: inv.organizationId,
      name: inv.name,
      email: inv.email,
      passwordHash,
      role: inv.role,
      crewId: inv.crewId || null,
      baseDailyWage: 120000,
      isActive: true,
    });

    inv.acceptedAt = new Date().toISOString();
    return user;
  }

  public createPasswordReset(email: string) {
    const user = this.getUserByEmail(email);
    if (!user) return null;

    const token = `pwd_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 horas
    this.resetTokens.push({
      id: `rst_${Date.now()}`,
      userId: user.id,
      token,
      expiresAt,
    });
    return { token, email: user.email, name: user.name };
  }

  public resetPasswordWithToken(token: string, newPassword: string): boolean {
    const entry = this.resetTokens.find((r) => r.token === token && !r.usedAt);
    if (!entry) return false;
    if (new Date(entry.expiresAt).getTime() < Date.now()) return false;

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);
    this.updateUser(entry.userId, { passwordHash });
    entry.usedAt = new Date().toISOString();
    return true;
  }

  public getUser(userId: string): UserData | undefined {
    return this.getUserById(userId);
  }

  public getAttendance(id: string): AttendanceData | undefined {
    return this.attendances.find((a) => a.id === id);
  }

  public findOpenAttendance(userId: string): AttendanceData | undefined {
    const cutoff = Date.now() - 30 * 3600 * 1000;
    return this.attendances
      .slice()
      .reverse()
      .find((a) => {
        if (a.userId !== userId || !a.clockInTime || a.clockOutTime) return false;
        const inTime = new Date(a.clockInTime).getTime();
        return inTime >= cutoff;
      });
  }

  public getAttendanceByIdempotencyToken(token: string): AttendanceData | undefined {
    if (!token) return undefined;
    return this.attendances.find((a) => a.idempotencyToken === token);
  }

  public getAttendanceForUserAndDate(userId: string, date: string): AttendanceData | undefined {
    return this.getAttendanceByDate(userId, date);
  }

  public assignShift(data: any): ShiftData {
    return this.saveShift(data);
  }

  public listAttendanceIncidents(orgId: string, status?: string): AttendanceIncidentData[] {
    return this.listIncidents(orgId, status);
  }

  public createAttendanceIncident(data: any): AttendanceIncidentData {
    return this.createIncident(data);
  }

  public resolveAttendanceIncident(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    resolutionNotes: string,
    adminUserId: string,
    adminName: string
  ): AttendanceIncidentData {
    return this.resolveIncident({ incidentId: id, status, resolutionNotes, resolvedByUserId: adminUserId, resolvedByName: adminName });
  }

  public getPeriodClosure(id: string): PeriodClosureData | undefined {
    return this.periodClosures.find((c) => c.id === id);
  }

  public createPeriodClosureDraft(params: {
    organizationId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): PeriodClosureData {
    return this.createPeriodClosure({
      organizationId: params.organizationId,
      name: params.name,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'BORRADOR',
      nightHourStart: '20:00',
      nightHourEnd: '06:00',
      nightSurchargePercent: 30,
      rulesSnapshot: {
        halfDayRuleConfirmed: false,
        hourlyRateRuleConfirmed: false,
        nightHourStart: '20:00',
        nightHourEnd: '06:00',
        nightSurchargePercent: 30,
        wageCalculationFormula: 'Jornal Base * Dias + (Horas Nocturnas * Valor Hora * 0.30)',
      },
      summaryData: {
        totalEmployees: 9,
        totalDaysWorked: 15,
        totalHalfDays: 1,
        totalDayHours: 84,
        totalNightHours: 36,
        totalHours: 120,
        payrollStatus: 'PENDIENTE_CONFIGURACION',
      },
    });
  }
}

// Instancia singleton para el runtime
export const dataStore = new DataStoreManager();
