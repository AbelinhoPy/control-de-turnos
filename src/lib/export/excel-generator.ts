// src/lib/export/excel-generator.ts
// Generador profesional de planillas Excel nativas .xlsx para Control de Turnos 24/7
// Diseñado para estricta fidelidad con las planillas oficiales del cliente:
// 1. «Planificacion_Turnos_Noviembre_MEPY.xlsx» (3 pestañas con rotación y cobertura)
// 2. «Historial Horas  Noviembre_2026 (RESUMEN 15 DIAS).xlsx» (1 pestaña por funcionario con desglose)

import ExcelJS from 'exceljs';
import {
  getDayNameEs,
  getShortDayNameEs,
  formatDateAsuncion,
  formatTimeAsuncion,
  getDatesInRange,
  APP_TIMEZONE,
} from '../time/timezone';
import { dbService } from '../db-service';

/**
 * REPORTE 1: Asistencia Diaria
 */
export async function generateDailyAttendanceExcel(params: {
  orgId: string;
  date: string;
  crewId?: string;
  userId?: string;
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const crews = await dbService.listCrews(params.orgId);
  const users = await dbService.listUsers(params.orgId, true);
  const shifts = await dbService.listShifts(params.orgId, params.date, params.date, params.crewId, params.userId);
  const attendances = await dbService.listAttendances(params.orgId, {
    date: params.date,
    crewId: params.crewId,
    userId: params.userId,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Turnos 24/7';
  wb.created = new Date();

  const ws = wb.addWorksheet('Asistencia Diaria', { views: [{ showGridLines: true }] });

  // Título
  ws.mergeCells('A1:I1');
  const title = ws.getCell('A1');
  title.value = `REPORTE DE ASISTENCIA DIARIA - ${org.name.toUpperCase()}`;
  title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // Subtítulo
  ws.mergeCells('A2:I2');
  const sub = ws.getCell('A2');
  sub.value = `Fecha: ${params.date} (${getDayNameEs(params.date)}) | Sede: ${org.workplaceName}`;
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 18;

  // Encabezados
  const headers = [
    'Funcionario',
    'Cuadrilla',
    'Turno Programado',
    'Hora Entrada',
    'Hora Salida',
    'Horas Trab.',
    'Estado',
    'Validación GPS',
    'Observaciones / Corrección',
  ];

  const hRow = ws.getRow(4);
  headers.forEach((h, idx) => {
    const cell = hRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  hRow.height = 24;

  let rowIdx = 5;
  const crewMap = new Map(crews.map((c) => [c.id, c.name]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  for (const shift of shifts) {
    const user = userMap.get(shift.userId);
    const att = attendances.find((a) => a.userId === shift.userId);
    const row = ws.getRow(rowIdx);

    row.getCell(1).value = user?.name || 'Funcionario';
    row.getCell(2).value = user?.crewId ? crewMap.get(user.crewId) || 'Sin cuadrilla' : 'Sin cuadrilla';
    row.getCell(3).value = shift.shiftCode === 'L' ? 'Libre' : `Turno ${shift.shiftCode}`;
    row.getCell(4).value = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--';
    row.getCell(5).value = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--';
    row.getCell(6).value = att?.totalHours || 0;
    row.getCell(7).value = att?.status || (shift.shiftCode === 'L' ? 'LIBRE' : 'PENDIENTE');
    row.getCell(8).value = att?.clockInStatus === 'VALID' ? 'Verificado en radio' : att?.clockInStatus === 'MANUAL' ? 'Corrección manual' : 'Sin registro';
    row.getCell(9).value = att?.correctionReason || att?.notes || '';

    // Alineaciones
    row.getCell(1).alignment = { horizontal: 'left' };
    row.getCell(2).alignment = { horizontal: 'left' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'left' };

    rowIdx++;
  }

  // Autoajuste de anchos
  ws.columns = [
    { width: 24 },
    { width: 22 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 20 },
    { width: 35 },
  ];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * REPORTE 2: Historial Individual (1 Pestaña por Funcionario con desglose de 15/30 días)
 * Fidelidad con «Historial Horas  Noviembre_2026 (RESUMEN 15 DIAS).xlsx»
 */
export async function generateAttendanceHistoryExcel(params: {
  orgId: string;
  startDate: string;
  endDate: string;
  userIds?: string[];
  crewId?: string;
  includeDeactivated?: boolean;
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const crews = await dbService.listCrews(params.orgId);
  let users = await dbService.listUsers(params.orgId, params.includeDeactivated ?? true);
  users = users.filter((u) => u.role !== 'ADMIN');

  if (params.crewId && params.crewId !== 'ALL') {
    users = users.filter((u) => u.crewId === params.crewId);
  }
  if (params.userIds && params.userIds.length > 0) {
    users = users.filter((u) => params.userIds!.includes(u.id));
  }

  const shifts = await dbService.listShifts(params.orgId, params.startDate, params.endDate);
  const attendances = await dbService.listAttendances(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Turnos 24/7';
  wb.created = new Date();

  if (users.length === 0) {
    const ws = wb.addWorksheet('Sin datos');
    ws.getCell('A1').value = 'No se encontraron funcionarios para los filtros seleccionados.';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  const crewMap = new Map(crews.map((c) => [c.id, c]));

  for (const user of users) {
    const crew = user.crewId ? crewMap.get(user.crewId) : null;
    const sheetName = user.name.replace(/[:\\/?*\[\]]/g, '').slice(0, 30);
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });

    // Título
    ws.mergeCells('B2:K2');
    const titleCell = ws.getCell('B2');
    titleCell.value = `HISTORIAL DE ASISTENCIA Y HORAS - ${user.name.toUpperCase()} (${crew?.name || 'General'})`;
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 26;

    // Subtítulo
    ws.mergeCells('B3:K3');
    const subCell = ws.getCell('B3');
    subCell.value = `Modalidad: ${crew?.type === 'ROTATING' ? 'Volante' : 'Fijo'} | Período: ${params.startDate} al ${params.endDate} | Recargo Nocturno (${org.nightSurchargePercent}%): ${org.nightHourStart} a ${org.nightHourEnd} hs`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 18;

    // Encabezados
    const headers = [
      'Fecha',
      'Día',
      'Turno\nAsignado',
      'Hora\nEntrada',
      'Hora\nSalida',
      'Días\nTrabajados',
      'Horas\nDiurnas',
      'Horas Noct.\n(30%)',
      'Total Horas\nDía',
      'Observaciones',
    ];

    const hRow = ws.getRow(5);
    headers.forEach((h, idx) => {
      const c = hRow.getCell(idx + 2);
      c.value = h;
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    hRow.height = 30;

    const userShifts = shifts.filter((s) => s.userId === user.id);
    const userAttendances = attendances.filter((a) => a.userId === user.id);
    const sortedShifts = [...userShifts].sort((a, b) => a.date.localeCompare(b.date));

    let currentRow = 6;
    let sumWorkedDays = 0;
    let sumDayHours = 0;
    let sumNightHours = 0;
    let sumTotalHours = 0;

    sortedShifts.forEach((shift) => {
      const att = userAttendances.find((a) => a.date === shift.date);
      const row = ws.getRow(currentRow);

      row.getCell(2).value = shift.date;
      row.getCell(3).value = getDayNameEs(shift.date);
      row.getCell(4).value = shift.shiftCode === 'L' ? 'Libre' : `Turno ${shift.shiftCode}`;
      row.getCell(5).value = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '';
      row.getCell(6).value = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '';

      const workedDays = att ? Number(att.workedDays) : 0;
      row.getCell(7).value = workedDays;
      row.getCell(7).numFmt = '0.0';
      sumWorkedDays += workedDays;

      const dayH = att ? Number(att.dayHours) : 0;
      row.getCell(8).value = dayH;
      row.getCell(8).numFmt = '0.0';
      sumDayHours += dayH;

      const nightH = att ? Number(att.nightHours) : 0;
      row.getCell(9).value = nightH;
      row.getCell(9).numFmt = '0.0';
      sumNightHours += nightH;

      const totalH = att ? Number(att.totalHours) : 0;
      row.getCell(10).value = totalH;
      row.getCell(10).numFmt = '0.0';
      sumTotalHours += totalH;

      row.getCell(11).value = att?.correctionReason || att?.notes || (shift.shiftCode === 'L' ? 'Franco programado' : '');

      // Alineaciones
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'left' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'right' };
      row.getCell(8).alignment = { horizontal: 'right' };
      row.getCell(9).alignment = { horizontal: 'right' };
      row.getCell(10).alignment = { horizontal: 'right' };
      row.getCell(11).alignment = { horizontal: 'left' };

      currentRow++;
    });

    // Fila de Totales
    const totRow = ws.getRow(currentRow);
    totRow.getCell(2).value = 'TOTALES';
    totRow.getCell(2).font = { bold: true };
    totRow.getCell(7).value = sumWorkedDays;
    totRow.getCell(7).font = { bold: true };
    totRow.getCell(7).numFmt = '0.0';
    totRow.getCell(8).value = sumDayHours;
    totRow.getCell(8).font = { bold: true };
    totRow.getCell(8).numFmt = '0.0';
    totRow.getCell(9).value = sumNightHours;
    totRow.getCell(9).font = { bold: true };
    totRow.getCell(9).numFmt = '0.0';
    totRow.getCell(10).value = sumTotalHours;
    totRow.getCell(10).font = { bold: true };
    totRow.getCell(10).numFmt = '0.0';

    totRow.eachCell((cell, colNumber) => {
      if (colNumber >= 2 && colNumber <= 11) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      }
    });

    // Resumen de Liquidación de Jornales
    currentRow += 2;
    ws.mergeCells(currentRow, 2, currentRow, 6);
    ws.getCell(currentRow, 2).value = 'RESUMEN DEL PERÍODO Y ESTIMACIÓN DE JORNAL';
    ws.getCell(currentRow, 2).font = { bold: true, color: { argb: 'FF0F4F5F' } };
    currentRow++;

    const baseWage = user.baseDailyWage || 100000;
    const hourlyRate = baseWage / 8;
    const baseAmount = sumWorkedDays * baseWage;
    const nightSurchargeAmount = sumNightHours * hourlyRate * (org.nightSurchargePercent / 100);
    const totalAmount = baseAmount + nightSurchargeAmount;

    const summaryRows = [
      ['Jornal Base Diario Configurado:', `Gs. ${baseWage.toLocaleString('es-PY')}`],
      ['Total Días Trabajados Computados:', `${sumWorkedDays.toFixed(1)} días`],
      ['Total Horas Diurnas:', `${sumDayHours.toFixed(1)} hs`],
      ['Total Horas Nocturnas (Recargo 30%):', `${sumNightHours.toFixed(1)} hs`],
      ['Total General Horas:', `${sumTotalHours.toFixed(1)} hs`],
      ['Subtotal Jornales Base:', `Gs. ${Math.round(baseAmount).toLocaleString('es-PY')}`],
      [`Recargo Nocturno (+${org.nightSurchargePercent}%):`, `Gs. ${Math.round(nightSurchargeAmount).toLocaleString('es-PY')}`],
      ['TOTAL ESTIMADO A PAGAR:', `Gs. ${Math.round(totalAmount).toLocaleString('es-PY')}`],
    ];

    summaryRows.forEach(([label, val], idx) => {
      const r = ws.getRow(currentRow + idx);
      r.getCell(2).value = label;
      r.getCell(4).value = val;
      r.getCell(2).font = { bold: idx >= 5 };
      r.getCell(4).font = { bold: idx >= 5 };
      if (idx === 7) {
        r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }
    });

    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 14;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 14;
    ws.getColumn(8).width = 14;
    ws.getColumn(9).width = 16;
    ws.getColumn(10).width = 14;
    ws.getColumn(11).width = 30;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * REPORTE 3: Horas y Jornales
 */
export async function generateHoursAndWagesExcel(params: {
  orgId: string;
  startDate: string;
  endDate: string;
  crewId?: string;
  userId?: string;
  includeDeactivated?: boolean;
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const crews = await dbService.listCrews(params.orgId);
  let users = await dbService.listUsers(params.orgId, params.includeDeactivated ?? true);
  users = users.filter((u) => u.role !== 'ADMIN');

  if (params.crewId && params.crewId !== 'ALL') {
    users = users.filter((u) => u.crewId === params.crewId);
  }
  if (params.userId && params.userId !== 'ALL') {
    users = users.filter((u) => u.id === params.userId);
  }

  const attendances = await dbService.listAttendances(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
    crewId: params.crewId,
    userId: params.userId,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Horas y Jornales', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:J1');
  const t = ws.getCell('A1');
  t.value = `REPORTE CONSOLIDADO DE HORAS Y JORNALES - ${org.name.toUpperCase()}`;
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = `Período: ${params.startDate} al ${params.endDate} | Franja Nocturna: ${org.nightHourStart} a ${org.nightHourEnd} (+${org.nightSurchargePercent}%)`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  const headers = [
    'Funcionario',
    'Cuadrilla',
    'Días Totales',
    'Medios Jornales',
    'Horas Diurnas',
    'Horas Noct. (30%)',
    'Total Horas',
    'Jornal Base (Gs.)',
    'Recargo Noct. (Gs.)',
    'Total a Pagar (Gs.)',
  ];

  const hRow = ws.getRow(4);
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  hRow.height = 24;

  let rowIdx = 5;
  const crewMap = new Map(crews.map((c) => [c.id, c.name]));

  let sumDays = 0;
  let sumHalfDays = 0;
  let sumDayH = 0;
  let sumNightH = 0;
  let sumTotalH = 0;
  let sumBasePay = 0;
  let sumNightPay = 0;
  let sumTotalPay = 0;

  for (const user of users) {
    const userAtts = attendances.filter((a) => a.userId === user.id);
    let uDays = 0;
    let uHalf = 0;
    let uDayH = 0;
    let uNightH = 0;
    let uTotH = 0;

    userAtts.forEach((a) => {
      const wd = Number(a.workedDays);
      uDays += wd;
      if (wd === 0.5) uHalf++;
      uDayH += Number(a.dayHours);
      uNightH += Number(a.nightHours);
      uTotH += Number(a.totalHours);
    });

    const baseWage = user.baseDailyWage || 100000;
    const hourlyRate = baseWage / 8;
    const basePay = uDays * baseWage;
    const nightPay = uNightH * hourlyRate * (org.nightSurchargePercent / 100);
    const totalPay = basePay + nightPay;

    const row = ws.getRow(rowIdx);
    row.getCell(1).value = user.name;
    row.getCell(2).value = user.crewId ? crewMap.get(user.crewId) || 'Sin cuadrilla' : 'Sin cuadrilla';
    row.getCell(3).value = uDays;
    row.getCell(4).value = uHalf;
    row.getCell(5).value = uDayH;
    row.getCell(6).value = uNightH;
    row.getCell(7).value = uTotH;
    row.getCell(8).value = baseWage;
    row.getCell(9).value = Math.round(nightPay);
    row.getCell(10).value = Math.round(totalPay);

    row.getCell(3).numFmt = '0.0';
    row.getCell(5).numFmt = '0.0';
    row.getCell(6).numFmt = '0.0';
    row.getCell(7).numFmt = '0.0';
    row.getCell(8).numFmt = '#,##0';
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '#,##0';

    sumDays += uDays;
    sumHalfDays += uHalf;
    sumDayH += uDayH;
    sumNightH += uNightH;
    sumTotalH += uTotH;
    sumBasePay += basePay;
    sumNightPay += nightPay;
    sumTotalPay += totalPay;

    rowIdx++;
  }

  // Fila de totales
  const totRow = ws.getRow(rowIdx);
  totRow.getCell(1).value = 'TOTALES GENERALES';
  totRow.getCell(1).font = { bold: true };
  totRow.getCell(3).value = sumDays;
  totRow.getCell(4).value = sumHalfDays;
  totRow.getCell(5).value = sumDayH;
  totRow.getCell(6).value = sumNightH;
  totRow.getCell(7).value = sumTotalH;
  totRow.getCell(9).value = Math.round(sumNightPay);
  totRow.getCell(10).value = Math.round(sumTotalPay);
  totRow.font = { bold: true };

  ws.columns = [
    { width: 24 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 20 },
  ];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * REPORTE 4: Cobertura de Turnos (Objetivo vs Presentes)
 */
export async function generateShiftCoverageExcel(params: {
  orgId: string;
  startDate: string;
  endDate: string;
  crewId?: string;
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const dates = getDatesInRange(params.startDate, params.endDate);
  const shifts = await dbService.listShifts(params.orgId, params.startDate, params.endDate, params.crewId);
  const attendances = await dbService.listAttendances(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
    crewId: params.crewId,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cobertura 24-7', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:H1');
  const t = ws.getCell('A1');
  t.value = `CONTROL DE COBERTURA DE TURNOS 24/7 - ${org.name.toUpperCase()}`;
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = `Período: ${params.startDate} al ${params.endDate} | Meta de Cobertura: 2 personas por turno activo`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  const headers = [
    'Fecha',
    'Día',
    'Turno',
    'Requeridos',
    'Programados',
    'Asistieron',
    'Diferencia',
    'Estado Cobertura',
  ];

  const hRow = ws.getRow(4);
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const shiftDefs = [
    { code: 'M', name: 'Mañana (06:00 a 14:00)' },
    { code: 'T', name: 'Tarde (14:00 a 22:00)' },
    { code: 'N', name: 'Noche (22:00 a 06:00)' },
  ];

  let curRow = 5;

  for (const dateStr of dates) {
    for (const sDef of shiftDefs) {
      const scheduledCount = shifts.filter((s) => s.date === dateStr && s.shiftCode === sDef.code).length;
      const attendedCount = attendances.filter(
        (a) => a.date === dateStr && a.clockInTime && (a.status === 'COMPLETA' || a.status === 'EN_CURSO')
      ).length;

      const diff = attendedCount - 2;
      const row = ws.getRow(curRow);

      row.getCell(1).value = dateStr;
      row.getCell(2).value = getDayNameEs(dateStr);
      row.getCell(3).value = sDef.name;
      row.getCell(4).value = 2;
      row.getCell(5).value = scheduledCount;
      row.getCell(6).value = attendedCount;
      row.getCell(7).value = diff;
      row.getCell(8).value = attendedCount >= 2 ? 'CUBIERTO' : attendedCount === 1 ? 'ALERTA (1)' : 'DÉFICIT (0)';

      if (attendedCount < 2) {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
        row.getCell(8).font = { bold: true, color: { argb: 'FF991B1B' } };
      } else {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(8).font = { bold: true, color: { argb: 'FF166534' } };
      }

      curRow++;
    }
  }

  ws.columns = [
    { width: 14 },
    { width: 14 },
    { width: 26 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
  ];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * REPORTE 5: Incidencias y Correcciones
 */
export async function generateIncidentsExcel(params: {
  orgId: string;
  status?: string;
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const incidents = await dbService.listAttendanceIncidents(params.orgId, params.status);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Incidencias y Auditoría', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:H1');
  const t = ws.getCell('A1');
  t.value = `REGISTRO DE INCIDENCIAS Y CORRECCIONES MANUALES - ${org.name.toUpperCase()}`;
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  const headers = [
    'Fecha',
    'Funcionario',
    'Tipo de Incidencia',
    'Descripción / Solicitud',
    'Estado',
    'Resolución Administrativa',
    'Resuelto Por',
    'Fecha Resolución',
  ];

  const hRow = ws.getRow(3);
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  let rowIdx = 4;
  for (const inc of incidents) {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = inc.date;
    r.getCell(2).value = inc.userName || 'Funcionario';
    r.getCell(3).value = inc.type;
    r.getCell(4).value = inc.description;
    r.getCell(5).value = inc.status === 'APPROVED' ? 'APROBADA' : inc.status === 'REJECTED' ? 'RECHAZADA' : 'PENDIENTE';
    r.getCell(6).value = inc.resolutionNotes || '';
    r.getCell(7).value = inc.resolvedByName || '';
    r.getCell(8).value = inc.resolvedAt ? formatDateAsuncion(inc.resolvedAt) : '';

    rowIdx++;
  }

  ws.columns = [
    { width: 14 },
    { width: 22 },
    { width: 18 },
    { width: 32 },
    { width: 14 },
    { width: 32 },
    { width: 20 },
    { width: 16 },
  ];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * REPORTE 6: Cierre del Período (Resumen + Detalle Inmutable)
 */
export async function generateClosureExcel(params: {
  orgId: string;
  closureId?: string;
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const closures = await dbService.listPeriodClosures(params.orgId);
  const targetClosure = params.closureId
    ? await dbService.getPeriodClosure(params.closureId)
    : closures[0]
    ? await dbService.getPeriodClosure(closures[0].id)
    : null;

  const wb = new ExcelJS.Workbook();

  if (!targetClosure) {
    const ws = wb.addWorksheet('Sin Cierres');
    ws.getCell('A1').value = 'No se encontró ningún cierre de período.';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // Hoja 1: Resumen y Reglas Inmutables
  const ws1 = wb.addWorksheet('Resumen de Cierre');
  ws1.mergeCells('A1:F1');
  ws1.getCell('A1').value = `CIERRE DE PERÍODO: ${targetClosure.name.toUpperCase()}`;
  ws1.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };

  ws1.getCell('A3').value = 'Estado del Cierre:';
  ws1.getCell('B3').value = targetClosure.status;
  ws1.getCell('A4').value = 'Rango de Fechas:';
  ws1.getCell('B4').value = `${targetClosure.startDate} al ${targetClosure.endDate}`;
  ws1.getCell('A5').value = 'Aprobado Por:';
  ws1.getCell('B5').value = targetClosure.approvedByName || 'Pendiente de aprobación';
  ws1.getCell('A6').value = 'Fecha Aprobación:';
  ws1.getCell('B6').value = targetClosure.approvedAt || 'Borrador';

  ws1.getCell('A8').value = 'Reglas Aplicadas (Snapshot):';
  ws1.getCell('A8').font = { bold: true };
  ws1.getCell('A9').value = 'Franja Nocturna:';
  ws1.getCell('B9').value = `${targetClosure.nightHourStart} a ${targetClosure.nightHourEnd} hs`;
  ws1.getCell('A10').value = 'Recargo Nocturno:';
  ws1.getCell('B10').value = `${targetClosure.nightSurchargePercent}%`;

  const sData = targetClosure.summaryData as any;
  ws1.getCell('A12').value = 'Totales Consolidados:';
  ws1.getCell('A12').font = { bold: true };
  ws1.getCell('A13').value = 'Personal Activo:';
  ws1.getCell('B13').value = sData?.totalEmployees || 0;
  ws1.getCell('A14').value = 'Días Trabajados Totales:';
  ws1.getCell('B14').value = sData?.totalDaysWorked || 0;
  ws1.getCell('A15').value = 'Horas Diurnas Totales:';
  ws1.getCell('B15').value = sData?.totalDayHours || 0;
  ws1.getCell('A16').value = 'Horas Nocturnas Totales:';
  ws1.getCell('B16').value = sData?.totalNightHours || 0;
  ws1.getCell('A17').value = 'Total General Horas:';
  ws1.getCell('B17').value = sData?.totalHours || 0;

  ws1.columns = [{ width: 28 }, { width: 32 }, { width: 14 }, { width: 14 }];

  // Hoja 2: Detalle por Jornada
  const ws2 = wb.addWorksheet('Detalle de Jornadas');
  const details = (targetClosure as any).detailsSnapshot || [];

  const headers = ['Fecha', 'Funcionario', 'Cuadrilla', 'Turno', 'Días Trab.', 'Horas Diurnas', 'Horas Noct.', 'Total Horas', 'Jornal Base (Gs.)', 'Total Pagado (Gs.)'];
  const hRow = ws2.getRow(1);
  headers.forEach((h, idx) => {
    const c = hRow.getCell(idx + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
  });

  let dRow = 2;
  details.forEach((item: any) => {
    const r = ws2.getRow(dRow);
    r.getCell(1).value = item.date;
    r.getCell(2).value = item.userName;
    r.getCell(3).value = item.crewId || '-';
    r.getCell(4).value = item.shiftCode || 'M';
    r.getCell(5).value = Number(item.workedDays);
    r.getCell(6).value = Number(item.dayHours);
    r.getCell(7).value = Number(item.nightHours);
    r.getCell(8).value = Number(item.totalHours);
    r.getCell(9).value = Number(item.baseDailyWage || 100000);
    r.getCell(10).value = Number(item.totalPay || 0);

    r.getCell(5).numFmt = '0.0';
    r.getCell(6).numFmt = '0.0';
    r.getCell(7).numFmt = '0.0';
    r.getCell(8).numFmt = '0.0';
    r.getCell(9).numFmt = '#,##0';
    r.getCell(10).numFmt = '#,##0';

    dRow++;
  });

  ws2.columns = [
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
  ];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * PLANIFICACIÓN DE TURNOS (3 pestañas con formato original de «Planificacion_Turnos_Noviembre_MEPY.xlsx»)
 */
export async function generatePlanningExcel(params: {
  orgId: string;
  startDate: string;
  endDate: string;
  dates: string[];
}): Promise<Buffer> {
  const org = await dbService.getOrganization(params.orgId);
  const crews = await dbService.listCrews(params.orgId);
  const templates = await dbService.listShiftTemplates(params.orgId);
  let users = await dbService.listUsers(params.orgId, false);
  users = users.filter((u) => u.role !== 'ADMIN');
  const shifts = await dbService.listShifts(params.orgId, params.startDate, params.endDate);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Turnos 24/7 - Aldo Samudio';
  wb.created = new Date();

  // 1. Resumen y Cuadrillas
  const ws1 = wb.addWorksheet('Resumen y Cuadrillas', { views: [{ showGridLines: true }] });
  ws1.mergeCells('B2:G2');
  const titleCell = ws1.getCell('B2');
  titleCell.value = 'PLANIFICACIÓN DE TURNOS 24/7 - ROTACIÓN ERGONÓMICA Y SALUDABLE';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 28;

  ws1.mergeCells('B3:G3');
  const subCell = ws1.getCell('B3');
  subCell.value = `${org.name} | Período: ${params.startDate} al ${params.endDate} | Rotación hacia adelante (M -> T -> N -> L)`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(3).height = 18;

  const summaryHeaders = ['Cuadrilla', 'Turno / Patrón', 'Horario', 'Personal Asignado', 'Modalidad'];
  const h1 = ws1.getRow(5);
  summaryHeaders.forEach((h, idx) => {
    const c = h1.getCell(idx + 2);
    c.value = h;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const crewDetails = [
    { name: 'Cuadrilla A', pattern: 'Mañana (M)', time: '06:00 a 14:00', mod: 'Fijo (Lunes a Sábado)' },
    { name: 'Cuadrilla B', pattern: 'Tarde (T)', time: '14:00 a 22:00', mod: 'Fijo (Lunes a Sábado)' },
    { name: 'Cuadrilla C', pattern: 'Noche (N)', time: '22:00 a 06:00 (+1)', mod: 'Fijo (Lunes a Sábado)' },
    { name: 'Cuadrilla D', pattern: 'Rotativo 2M-2T-2N-2L', time: 'Rotativo continuo', mod: 'Volante (Rotación continua)' },
  ];

  crewDetails.forEach((cd, idx) => {
    const r = ws1.getRow(6 + idx);
    const crw = crews.find((c) => c.name.includes(cd.name.split(' ')[1]));
    const crewUsers = users.filter((u) => u.crewId === crw?.id);
    const names = crewUsers.map((u) => u.name).join(', ');

    r.getCell(2).value = cd.name;
    r.getCell(3).value = cd.pattern;
    r.getCell(4).value = cd.time;
    r.getCell(5).value = names || '2 asignados';
    r.getCell(6).value = cd.mod;

    r.getCell(2).alignment = { horizontal: 'left' };
    r.getCell(3).alignment = { horizontal: 'left' };
    r.getCell(4).alignment = { horizontal: 'center' };
    r.getCell(5).alignment = { horizontal: 'left' };
    r.getCell(6).alignment = { horizontal: 'left' };
  });

  ws1.getColumn(2).width = 16;
  ws1.getColumn(3).width = 24;
  ws1.getColumn(4).width = 22;
  ws1.getColumn(5).width = 36;
  ws1.getColumn(6).width = 26;

  // 2. Programación General
  const ws2 = wb.addWorksheet('Programación General', { views: [{ showGridLines: true }] });
  const numCols = params.dates.length;

  ws2.mergeCells(2, 2, 2, numCols + 3);
  const pTitle = ws2.getCell(2, 2);
  pTitle.value = `PROGRAMACIÓN GENERAL DE COBERTURA - ${params.startDate} AL ${params.endDate}`;
  pTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  pTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  pTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 26;

  const headerRow = ws2.getRow(4);
  headerRow.getCell(2).value = 'Cuadrilla';
  headerRow.getCell(3).value = 'Funcionario';
  headerRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
  headerRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };

  params.dates.forEach((dStr, idx) => {
    const colNum = idx + 4;
    const cell = headerRow.getCell(colNum);
    cell.value = `${dStr.slice(-2)}\n${getShortDayNameEs(dStr)}`;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  let curRow = 5;
  const crewMap = new Map(crews.map((c) => [c.id, c.name]));

  users.forEach((user) => {
    const row = ws2.getRow(curRow);
    row.getCell(2).value = user.crewId ? crewMap.get(user.crewId) || 'Volante' : 'Volante';
    row.getCell(3).value = user.name;

    params.dates.forEach((dStr, idx) => {
      const colNum = idx + 4;
      const sh = shifts.find((s) => s.userId === user.id && s.date === dStr);
      const code = sh?.shiftCode || 'L';
      const cell = row.getCell(colNum);
      cell.value = code;
      cell.alignment = { horizontal: 'center' };
      cell.font = { bold: true, size: 10 };

      if (code === 'M') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      } else if (code === 'T') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      } else if (code === 'N') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    });
    curRow++;
  });

  ws2.getColumn(2).width = 18;
  ws2.getColumn(3).width = 24;
  for (let c = 4; c <= numCols + 3; c++) {
    ws2.getColumn(c).width = 6;
  }

  // 3. Calendario por Equipos
  const ws3 = wb.addWorksheet('Calendario por Equipos', { views: [{ showGridLines: true }] });
  ws3.mergeCells('B2:E2');
  ws3.getCell('B2').value = 'CALENDARIO DE TURNOS POR CUADRILLA';
  ws3.getCell('B2').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  ws3.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };

  let eRow = 4;
  crews.forEach((crew) => {
    ws3.getCell(eRow, 2).value = crew.name.toUpperCase();
    ws3.getCell(eRow, 2).font = { bold: true, size: 11, color: { argb: 'FF0F4F5F' } };
    eRow++;

    const crewUsers = users.filter((u) => u.crewId === crew.id);
    crewUsers.forEach((u) => {
      ws3.getCell(eRow, 3).value = u.name;
      ws3.getCell(eRow, 4).value = u.email;
      eRow++;
    });
    eRow++;
  });

  ws3.getColumn(2).width = 22;
  ws3.getColumn(3).width = 26;
  ws3.getColumn(4).width = 32;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
