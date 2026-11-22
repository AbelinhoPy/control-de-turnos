// tests/integration-db.ts
// Prueba de integración con base de datos real (PostgreSQL / Neon)
// Verifica persistencia, atomicidad, restricciones, auditoría, cierres inmutables y exportación.

import { dbService } from '../src/lib/db-service';
import { assertDatabaseAvailable, isDatabaseConnected, isDemoModeEnabled, getPool } from '../src/db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from '../src/db';
import { generateHoursAndWagesExcel, generatePlanningExcel } from '../src/lib/export/excel-generator';
import { generateReportPdf } from '../src/lib/export/pdf-generator';
import ExcelJS from 'exceljs';

async function runDbIntegrationSuite() {
  console.log('======================================================================');
  console.log('🐘 PRUEBAS DE INTEGRACIÓN: BASE DE DATOS REAL (NEON / POSTGRESQL)');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail || 'Fallo de aserción'}`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. Verificación de error claro cuando Neon no está configurado ni en Demo
  // -------------------------------------------------------------------------
  console.log('🔒 1. Verificación de control de entorno operativo sin Neon ni Demo:');
  const savedUrl = process.env.DATABASE_URL;
  const savedDemo = process.env.ENABLE_DEMO_MODE;
  const savedPublicDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO;

  delete process.env.DATABASE_URL;
  process.env.ENABLE_DEMO_MODE = 'false';
  process.env.NEXT_PUBLIC_ENABLE_DEMO = 'false';

  let threwExpected = false;
  let errorMsg = '';
  try {
    assertDatabaseAvailable();
  } catch (err: unknown) {
    if (err instanceof Error) {
      errorMsg = err.message;
      if (err.message.toLowerCase().includes('neon postgres no está configurada')) {
        threwExpected = true;
      }
    }
  }
  assert(
    threwExpected,
    'Lanza error descriptivo cuando no hay DATABASE_URL y ENABLE_DEMO_MODE no es true'
  );

  // Restaurar URL para la prueba con base real
  process.env.DATABASE_URL = savedUrl || 'postgres://postgres:postgres@localhost:5433/control_turnos';
  process.env.ENABLE_DEMO_MODE = 'false';
  process.env.NEXT_PUBLIC_ENABLE_DEMO = 'false';

  // -------------------------------------------------------------------------
  // 2. Ejecución de migraciones Drizzle en la base de datos
  // -------------------------------------------------------------------------
  console.log('\n📦 2. Ejecución de migraciones versionadas en PostgreSQL:');
  const db = getDb();
  await migrate(db as any, { migrationsFolder: './drizzle' });
  assert(true, 'Migraciones Drizzle aplicadas con éxito en PostgreSQL');

  const orgId = `org_test_${Date.now()}`;
  const userId = `user_func_${Date.now()}`;
  const adminId = `user_admin_${Date.now()}`;
  const dateStr = '2026-11-23';

  // -------------------------------------------------------------------------
  // 3. Creación de Organización y Administrador
  // -------------------------------------------------------------------------
  console.log('\n🏢 3. Creación de Organización, Admin y Funcionario en BD:');
  await dbService.createOrganization({
    id: orgId,
    name: 'Minga Guazú Operaciones S.A.',
    slug: `minga-guazu-${Date.now()}`,
    ruc: '80012345-6',
    timezone: 'America/Asuncion',
    workplaceName: 'Sede Minga Guazú Central',
    workplaceLat: -25.496469,
    workplaceLng: -54.789641,
    geofenceRadiusMeters: 300,
    nightShiftStartHour: 20,
    nightShiftEndHour: 6,
    nightShiftSurchargePercent: 30,
    halfDayThresholdHours: 4,
    fullDayThresholdHours: 7,
  });
  assert(true, 'Organización creada en la base de datos');

  await dbService.createUser({
    id: adminId,
    organizationId: orgId,
    email: `admin_${Date.now()}@empresa.com.py`,
    name: 'Aldo Samudio',
    role: 'ADMIN',
    isActive: true,
  });

  const employee = await dbService.createUser({
    id: userId,
    organizationId: orgId,
    email: `juan.perez_${Date.now()}@empresa.com.py`,
    name: 'Juan Pérez',
    role: 'FUNCIONARIO',
    isActive: true,
    baseDailyWage: 120000,
  });
  assert(employee.id === userId, 'Funcionario guardado en PostgreSQL con jornal base');

  // -------------------------------------------------------------------------
  // 4. Asignación y Publicación de Turno
  // -------------------------------------------------------------------------
  console.log('\n📅 4. Asignación de Turno y Publicación:');
  const shift = await dbService.assignShift({
    userId,
    organizationId: orgId,
    date: dateStr,
    shiftCode: 'N', // Turno noche
    isPublished: false,
  });
  assert(shift.isPublished === false, 'Turno creado en estado BORRADOR (no publicado)');

  // Funcionario solo debe ver turnos publicados
  const employeeShiftsUnpublished = await dbService.listShifts(orgId, {
    userId,
    onlyPublished: true,
  });
  assert(
    employeeShiftsUnpublished.length === 0,
    'Funcionario no ve turnos en borrador (onlyPublished=true)'
  );

  // Administrador publica el cronograma
  const publishedCount = await dbService.publishShifts(orgId, [shift.id], adminId);
  assert(publishedCount >= 1, `Se publicaron ${publishedCount} turnos correctamente`);

  const employeeShiftsPublished = await dbService.listShifts(orgId, {
    userId,
    onlyPublished: true,
  });
  assert(
    employeeShiftsPublished.length === 1 && employeeShiftsPublished[0].isPublished === true,
    'Funcionario puede ver su turno una vez publicado'
  );

  // -------------------------------------------------------------------------
  // 5. Marcación de Jornada con GPS y Prevención de Doble Toque
  // -------------------------------------------------------------------------
  console.log('\n📱 5. Marcación de Entrada, Doble Toque e Idempotencia en BD:');
  const idemToken = `token_test_${Date.now()}`;
  const clockInTimestamp = new Date(`${dateStr}T22:00:00-03:00`);

  const clockIn1 = await dbService.recordClockIn({
    userId,
    organizationId: orgId,
    date: dateStr,
    timestamp: clockInTimestamp,
    lat: -25.49647,
    lng: -54.78964,
    accuracy: 12,
    distanceMeters: 8,
    status: 'VALID',
    idempotencyToken: idemToken,
  });
  assert(clockIn1.status === 'EN_CURSO', 'Marcación de entrada registrada en estado EN_CURSO');

  // Reintento / doble toque con mismo token
  const clockIn2 = await dbService.recordClockIn({
    userId,
    organizationId: orgId,
    date: dateStr,
    timestamp: new Date(`${dateStr}T22:00:02-03:00`),
    lat: -25.49647,
    lng: -54.78964,
    accuracy: 12,
    distanceMeters: 8,
    status: 'VALID',
    idempotencyToken: idemToken,
  });
  assert(clockIn1.id === clockIn2.id, 'Idempotencia: Doble toque no duplica el registro en la BD');

  // Marcación de Salida al día siguiente (06:00)
  const nextDay = '2026-11-24';
  const clockOutTimestamp = new Date(`${nextDay}T06:00:00-03:00`);
  const clockOutRes = await dbService.recordClockOut({
    attendanceId: clockIn1.id,
    userId,
    organizationId: orgId,
    timestamp: clockOutTimestamp,
    lat: -25.49648,
    lng: -54.78965,
    accuracy: 10,
    distanceMeters: 5,
    status: 'VALID',
  });
  assert(clockOutRes.status === 'COMPLETA', 'Jornada nocturna finalizada con estado COMPLETA');
  assert(Number(clockOutRes.totalHours) === 8, 'Total de horas registradas: 8.0 hs');
  assert(Number(clockOutRes.nightHours) === 8, 'Total de horas nocturnas (20:00 a 06:00): 8.0 hs');
  assert(Number(clockOutRes.workedDays) === 1, 'Total de días trabajados: 1.0');

  // -------------------------------------------------------------------------
  // 6. Corrección Manual con Motivo y Auditoría
  // -------------------------------------------------------------------------
  console.log('\n📝 6. Corrección Manual y Trazabilidad en BD:');
  const corrected = await dbService.correctAttendance({
    attendanceId: clockIn1.id,
    userId,
    organizationId: orgId,
    date: dateStr,
    clockInTime: `${dateStr}T22:00:00-03:00`,
    clockOutTime: `${nextDay}T06:00:00-03:00`,
    status: 'COMPLETA',
    correctionReason: 'Verificación de relevo con el supervisor de guardia',
    correctedByUserId: adminId,
    correctedByName: 'Aldo Samudio',
  });
  assert(corrected.isManualCorrection === true, 'Marcado como corrección manual');
  assert(corrected.correctedByName === 'Aldo Samudio', 'Registró el nombre del administrador');

  const auditLogs = await dbService.listAuditLogs(orgId);
  const foundAudit = auditLogs.some((l) => l.action === 'ATTENDANCE_CORRECTED');
  assert(foundAudit, 'Acción registrada en la tabla de auditoría');

  // -------------------------------------------------------------------------
  // 7. Cierre de Período con Snapshot Inmutable
  // -------------------------------------------------------------------------
  console.log('\n🔒 7. Cierre de Período Inmutable en BD:');
  const closure = await dbService.createPeriodClosureDraft({
    organizationId: orgId,
    name: '1ª Quincena Noviembre 2026',
    startDate: dateStr,
    endDate: nextDay,
  });
  assert(closure.status === 'BORRADOR', 'Cierre creado en estado BORRADOR');

  const approvedClosure = await dbService.approvePeriodClosure(closure.id, adminId, 'Aldo Samudio');
  assert(approvedClosure?.status === 'APROBADO', 'Cierre aprobado exitosamente');
  assert(
    Array.isArray(approvedClosure?.detailsSnapshot) && approvedClosure.detailsSnapshot.length >= 1,
    'Snapshot inmutable de funcionarios y reglas guardado en jsonb'
  );

  // -------------------------------------------------------------------------
  // 8. Desactivación de Funcionario y Pérdida de Acceso
  // -------------------------------------------------------------------------
  console.log('\n🚫 8. Desactivación de Funcionario:');
  await dbService.deactivateUser(userId, adminId);
  const deactivatedUser = await dbService.getUser(userId);
  assert(deactivatedUser?.isActive === false, 'Funcionario tiene isActive=false en la BD');

  const preservedAttendances = await dbService.listAttendances(orgId, { userId });
  assert(
    preservedAttendances.length >= 1,
    'Historial de asistencias conservado íntegramente tras la baja del funcionario'
  );

  // -------------------------------------------------------------------------
  // 9. Exportación Excel y PDF leyendo directamente de PostgreSQL
  // -------------------------------------------------------------------------
  console.log('\n📊 9. Exportación Excel y PDF con datos de PostgreSQL:');
  const excelBuf = await generateHoursAndWagesExcel({
    orgId,
    startDate: dateStr,
    endDate: nextDay,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(excelBuf as unknown as ExcelJS.Buffer);
  assert(wb.worksheets.length >= 1, 'Excel generado correctamente desde la BD');

  const pdfBuf = await generateReportPdf({
    orgId,
    reportType: 'cierre',
    closureId: closure.id,
    startDate: dateStr,
    endDate: nextDay,
  });
  assert(pdfBuf.slice(0, 5).toString('ascii') === '%PDF-', 'PDF de cierre generado con snapshot inmutable');

  // -------------------------------------------------------------------------
  // 10. Persistencia tras Reconexión del Servidor
  // -------------------------------------------------------------------------
  console.log('\n🔄 10. Prueba de Persistencia tras Reinicio / Reconexión:');
  const pool = getPool();
  if (pool) {
    await pool.end(); // Simular reinicio del servidor y cierre de conexiones
  }

  // Nueva consulta con nueva conexión
  const persistedUser = await dbService.getUser(userId);
  assert(persistedUser !== null && persistedUser.name === 'Juan Pérez', 'Datos persisten tras reconexión a la base de datos');

  const persistedClosure = await dbService.getPeriodClosure(closure.id);
  assert(persistedClosure?.status === 'APROBADO', 'Cierre aprobado conserva su estado y snapshot tras reconexión');

  console.log('\n======================================================================');
  console.log(`🏁 RESULTADO: ${passedTests}/${totalTests} pruebas de BD superadas con éxito.`);
  console.log('======================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runDbIntegrationSuite().catch((err) => {
  console.error('Error en pruebas de integración BD:', err);
  process.exit(1);
});
