// tests/verification.ts
import { validateGeofence } from '../src/lib/geo/geofence';
import { calculateShiftHours, APP_TIMEZONE, formatDateAsuncion } from '../src/lib/time/timezone';
import { dataStore } from '../src/lib/data-store';
import { generatePlanningExcel, generateAttendanceHistoryExcel } from '../src/lib/export/excel-generator';
import { generateReportPdf } from '../src/lib/export/pdf-generator';
import ExcelJS from 'exceljs';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 SUITE DE PRUEBAS AUTOMATIZADAS - CONTROL DE TURNOS 24/7');
  console.log('===============================================================\n');

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

  // -----------------------------------------------------------------
  // 1. PRUEBA DE GEOFENCING Y TOLERANCIA GPS
  // -----------------------------------------------------------------
  console.log('📍 1. Pruebas de Geofencing y Precisión GPS:');
  const workplace = { latitude: -25.2867, longitude: -57.647 };
  const radiusMeters = 300;

  // Caso 1.1: Usuario dentro del radio con buena señal
  const insideCoord = { latitude: -25.2868, longitude: -57.6471 }; // ~15 metros
  const resInside = validateGeofence(insideCoord, 15, {
    center: workplace,
    radiusMeters,
  });
  assert(resInside.isValid === true, 'Ubicación dentro del radio (300m) es aceptada');

  // Caso 1.2: Usuario fuera del área (ej: a 2 km)
  const outsideCoord = { latitude: -25.31, longitude: -57.647 }; // ~2.5 km
  const resOutside = validateGeofence(outsideCoord, 15, {
    center: workplace,
    radiusMeters,
  });
  assert(
    resOutside.isValid === false && resOutside.errorCode === 'OUT_OF_BOUNDS',
    'Ubicación fuera del área es rechazada con mensaje descriptivo',
    resOutside.message
  );

  // Caso 1.3: Baja precisión del GPS (>120m)
  const lowAccuracyCoord = { latitude: -25.2867, longitude: -57.647 };
  const resLowAcc = validateGeofence(lowAccuracyCoord, 250, {
    center: workplace,
    radiusMeters,
  });
  assert(
    resLowAcc.isValid === false && resLowAcc.errorCode === 'LOW_ACCURACY',
    'Marcación con baja precisión GPS (±250m) es rechazada con recomendación al usuario',
    resLowAcc.message
  );

  // -----------------------------------------------------------------
  // 2. PRUEBA DE ASOCIACIÓN DE TURNO NOCTURNO QUE CRUZA MEDIANOCHE
  // -----------------------------------------------------------------
  console.log('\n🌙 2. Pruebas de Turno Nocturno (22:00 a 06:00 del día siguiente):');
  const clockInNight = '2026-11-08T22:00:00-03:00';
  const clockOutMorning = '2026-11-09T06:00:00-03:00'; // Salida al día siguiente a las 06:00
  const calcNight = calculateShiftHours(clockInNight, clockOutMorning);

  assert(calcNight.totalHours === 8, 'Total de horas trabajadas en turno noche es exactamente 8.0 hs');
  assert(
    calcNight.nightHours === 8,
    'Todas las 8 horas (22:00 a 06:00) caen en la franja nocturna (20:00 a 06:00)'
  );
  assert(calcNight.dayHours === 0, 'Las horas diurnas para el turno noche son 0.0 hs');
  assert(calcNight.workedDays === 1.0, 'Computa 1.0 día trabajado completo');

  // Turno Tarde (14:00 a 22:00): 14:00 a 20:00 (6h diurnas) y 20:00 a 22:00 (2h nocturnas)
  const clockInTarde = '2026-11-08T14:00:00-03:00';
  const clockOutTarde = '2026-11-08T22:00:00-03:00';
  const calcTarde = calculateShiftHours(clockInTarde, clockOutTarde);
  assert(calcTarde.dayHours === 6, 'Turno Tarde desglosa 6.0 horas diurnas (14:00 a 20:00)');
  assert(calcTarde.nightHours === 2, 'Turno Tarde desglosa 2.0 horas nocturnas (+30%) (20:00 a 22:00)');

  // -----------------------------------------------------------------
  // 3. PRUEBA DE MEDIO JORNAL APROBADO
  // -----------------------------------------------------------------
  console.log('\n⏱️ 3. Pruebas de Medio Jornal:');
  const clockInHalf = '2026-11-11T06:00:00-03:00';
  const clockOutHalf = '2026-11-11T10:00:00-03:00'; // 4 horas
  const calcHalf = calculateShiftHours(clockInHalf, clockOutHalf);
  assert(calcHalf.totalHours === 4, 'Jornada de 4 horas calculada correctamente');
  assert(calcHalf.workedDays === 0.5, 'Jornada de 4 horas clasifica como 0.5 medio jornal');

  // -----------------------------------------------------------------
  // 4. PRUEBA DE IDEMPOTENCIA / PREVENCIÓN DE DOBLE TOQUE
  // -----------------------------------------------------------------
  console.log('\n🔒 4. Pruebas de Idempotencia y Prevención de Duplicados:');
  const token = 'idem_test_duplicate_token_123';
  const mark1 = dataStore.recordClockIn({
    userId: 'user_p3',
    organizationId: 'org_mepy_2026',
    date: '2026-11-20',
    timestamp: new Date('2026-11-20T13:58:00-03:00'),
    lat: -25.2867,
    lng: -57.647,
    accuracy: 10,
    distanceMeters: 5,
    status: 'VALID',
    idempotencyToken: token,
  });

  const mark2 = dataStore.recordClockIn({
    userId: 'user_p3',
    organizationId: 'org_mepy_2026',
    date: '2026-11-20',
    timestamp: new Date('2026-11-20T13:58:01-03:00'),
    lat: -25.2867,
    lng: -57.647,
    accuracy: 10,
    distanceMeters: 5,
    status: 'VALID',
    idempotencyToken: token,
  });

  assert(mark1.id === mark2.id, 'Doble toque con mismo token devuelve la misma marcación sin duplicar');

  // -----------------------------------------------------------------
  // 5. PRUEBA DE CORRECCIÓN MANUAL Y AUDITORÍA
  // -----------------------------------------------------------------
  console.log('\n📝 5. Pruebas de Corrección Manual y Trazabilidad:');
  const corrected = dataStore.correctAttendance({
    userId: 'user_p7',
    organizationId: 'org_mepy_2026',
    date: '2026-11-08',
    clockInTime: '2026-11-08T22:00:00-03:00',
    clockOutTime: '2026-11-09T06:00:00-03:00',
    status: 'COMPLETA',
    correctionReason: 'Olvido de marcación validado con relevo de guardia',
    correctedByUserId: 'user_admin',
    correctedByName: 'Aldo Samudio',
  });

  assert(corrected.isManualCorrection === true, 'Registro marcado como corrección manual');
  assert(corrected.correctedByName === 'Aldo Samudio', 'Se registra el administrador responsable');
  assert(
    Boolean(corrected.correctionReason),
    'Se exige y conserva el motivo obligatorio de la corrección'
  );

  const logs = dataStore.listAuditLogs('org_mepy_2026');
  const logFound = logs.some(
    (l) => l.action === 'ATTENDANCE_CORRECTED' && l.userId === 'user_admin'
  );
  assert(logFound, 'La acción se registró en la bitácora inmutable de auditoría');

  // -----------------------------------------------------------------
  // 6. PRUEBA DE FUNCIONARIO DESACTIVADO CON HISTORIAL
  // -----------------------------------------------------------------
  console.log('\n👤 6. Pruebas de Funcionario Desactivado:');
  const deactivatedUser = dataStore.getUserById('user_p9_desactivado');
  assert(deactivatedUser !== undefined, 'Existe funcionario dado de baja en los datos de prueba');
  assert(deactivatedUser?.isActive === false, 'El funcionario tiene estado inactivo (isActive: false)');

  const userHistory = dataStore.listAttendances('org_mepy_2026', {
    userId: 'user_p9_desactivado',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
  });
  assert(
    userHistory.length > 0,
    `El funcionario desactivado conserva su historial de asistencias (${userHistory.length} registros)`
  );

  // -----------------------------------------------------------------
  // 7. PRUEBA DE GENERACIÓN DE EXCEL CON PLANTILLAS MEPY
  // -----------------------------------------------------------------
  console.log('\n📊 7. Pruebas de Exportación Excel:');
  const planningExcelBuffer = await generatePlanningExcel({
    orgId: 'org_mepy_2026',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    dates: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
  });

  const wbPlan = new ExcelJS.Workbook();
  await wbPlan.xlsx.load(planningExcelBuffer as unknown as ExcelJS.Buffer);
  const sheetNames = wbPlan.worksheets.map((w) => w.name);

  assert(sheetNames.includes('Resumen y Cuadrillas'), 'Excel contiene hoja «Resumen y Cuadrillas»');
  assert(sheetNames.includes('Programación General'), 'Excel contiene hoja «Programación General»');
  assert(sheetNames.includes('Calendario por Equipos'), 'Excel contiene hoja «Calendario por Equipos»');

  const historyExcelBuffer = await generateAttendanceHistoryExcel({
    orgId: 'org_mepy_2026',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    includeDeactivated: true,
  });
  const wbHist = new ExcelJS.Workbook();
  await wbHist.xlsx.load(historyExcelBuffer as unknown as ExcelJS.Buffer);
  assert(
    wbHist.worksheets.length >= 8,
    `Excel de Historial contiene una pestaña por cada funcionario (${wbHist.worksheets.length} pestañas)`
  );

  // -----------------------------------------------------------------
  // 8. PRUEBA DE GENERACIÓN DE PDF A4
  // -----------------------------------------------------------------
  console.log('\n📄 8. Pruebas de Exportación PDF A4:');
  const pdfBuffer = await generateReportPdf({
    orgId: 'org_mepy_2026',
    reportType: 'horas-jornales',
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    includeDeactivated: true,
  });

  const isPdf = pdfBuffer.slice(0, 5).toString('ascii') === '%PDF-';
  assert(isPdf, 'El documento generado es un archivo PDF válido (%PDF-)');
  assert(pdfBuffer.length > 2000, `El PDF tiene contenido real (${pdfBuffer.length} bytes)`);

  // Resumen final
  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO FINAL: ${passedTests}/${totalTests} pruebas superadas exitosamente.`);
  console.log('===============================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error(e);
  process.exit(1);
});
