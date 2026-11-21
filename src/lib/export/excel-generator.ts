// src/lib/export/excel-generator.ts
import ExcelJS from 'exceljs';
import {
  getDayNameEs,
  getShortDayNameEs,
  formatDateAsuncion,
  APP_TIMEZONE,
} from '../time/timezone';
import { dataStore, ShiftData, AttendanceData, UserData } from '../data-store';

/**
 * Genera el archivo Excel de Planificación de Turnos exactamente con la estructura de
 * «Planificacion_Turnos_Noviembre_MEPY.xlsx» (3 hojas: Resumen y Cuadrillas, Programación General, Calendario por Equipos)
 */
export async function generatePlanningExcel(params: {
  orgId: string;
  startDate: string;
  endDate: string;
  dates: string[];
}): Promise<Buffer> {
  const org = dataStore.getOrganization(params.orgId);
  const crews = dataStore.listCrews(params.orgId);
  const templates = dataStore.listShiftTemplates(params.orgId);
  const users = dataStore.listUsers(params.orgId, false).filter((u) => u.role !== 'ADMIN');
  const shifts = dataStore.listShifts(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Turnos 24/7 - Aldo Samudio';
  wb.created = new Date();

  // -------------------------------------------------------------
  // HOJA 1: Resumen y Cuadrillas
  // -------------------------------------------------------------
  const ws1 = wb.addWorksheet('Resumen y Cuadrillas', {
    views: [{ showGridLines: true }],
  });

  // Título
  ws1.mergeCells('B2:G2');
  const titleCell = ws1.getCell('B2');
  titleCell.value = 'PLANIFICACIÓN DE TURNOS 24/7 - ROTACIÓN ERGONÓMICA Y SALUDABLE';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F4F5F' }, // Azul petróleo
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 28;

  // Subtítulo
  ws1.mergeCells('B3:G3');
  const subCell = ws1.getCell('B3');
  subCell.value = `${org.name} | Período: ${params.startDate} al ${params.endDate} | Rotación hacia adelante (M -> T -> N -> L)`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(3).height = 18;

  // Sección Cuadrillas
  ws1.getCell('B5').value = 'Distribución de Equipos e Integrantes';
  ws1.getCell('B5').font = { bold: true, size: 11, color: { argb: 'FF0F4F5F' } };

  const crewHeaders = ['Equipo', 'Integrantes', 'Rol / Turno Asignado', 'Color Identificatorio'];
  const crewHeaderRow = ws1.getRow(6);
  crewHeaders.forEach((h, idx) => {
    const c = crewHeaderRow.getCell(idx + 2);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  let rowIdx = 7;
  crews.forEach((cr) => {
    const members = users.filter((u) => u.crewId === cr.id).map((u) => u.name).join(', ');
    const r = ws1.getRow(rowIdx);
    r.getCell(2).value = cr.name;
    r.getCell(3).value = members || 'Sin asignar';
    r.getCell(4).value = cr.description;
    r.getCell(5).value = cr.color;
    rowIdx++;
  });

  // Sección Turnos Diarios
  rowIdx += 2;
  ws1.getCell(`B${rowIdx}`).value = 'Definición de Turnos Diarios';
  ws1.getCell(`B${rowIdx}`).font = { bold: true, size: 11, color: { argb: 'FF0F4F5F' } };
  rowIdx++;

  const shiftHeaders = ['Código', 'Nombre del Turno', 'Horario', 'Duración', 'Personal Objetivo'];
  const shiftHeaderRow = ws1.getRow(rowIdx);
  shiftHeaders.forEach((h, idx) => {
    const c = shiftHeaderRow.getCell(idx + 2);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E7F94' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rowIdx++;

  templates.forEach((st) => {
    const r = ws1.getRow(rowIdx);
    r.getCell(2).value = st.code;
    r.getCell(3).value = st.name;
    r.getCell(4).value = st.startTime && st.endTime ? `${st.startTime} a ${st.endTime}` : 'No aplica';
    r.getCell(5).value = `${st.durationHours} horas`;
    r.getCell(6).value = st.code === 'L' ? '-' : `${st.targetHeadcount} personas`;
    rowIdx++;
  });

  ws1.columns = [
    { width: 4 },
    { width: 18 },
    { width: 32 },
    { width: 42 },
    { width: 22 },
    { width: 20 },
    { width: 20 },
  ];

  // -------------------------------------------------------------
  // HOJA 2: Programación General (Cronograma con cobertura diaria)
  // -------------------------------------------------------------
  const ws2 = wb.addWorksheet('Programación General', {
    views: [{ showGridLines: true }],
  });

  const numCols = params.dates.length + 2;
  ws2.mergeCells(2, 2, 2, numCols + 1);
  const titleCell2 = ws2.getCell(2, 2);
  titleCell2.value = 'CRONOGRAMA GENERAL - ROTACIÓN ERGONÓMICA DE RESTABLECIMIENTO';
  titleCell2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 28;

  // Encabezados de columnas (Fila 4: Días del mes, Fila 5: Nombres de días)
  const rDates = ws2.getRow(4);
  const rDayNames = ws2.getRow(5);

  rDates.getCell(2).value = 'Equipo';
  rDates.getCell(3).value = 'Nombre';
  rDayNames.getCell(2).value = '';
  rDayNames.getCell(3).value = '';

  params.dates.forEach((dStr, idx) => {
    const colNumber = idx + 4;
    const [, , d] = dStr.split('-');
    rDates.getCell(colNumber).value = parseInt(d, 10);
    rDates.getCell(colNumber).alignment = { horizontal: 'center' };
    rDates.getCell(colNumber).font = { bold: true };

    const shortDay = getShortDayNameEs(dStr);
    rDayNames.getCell(colNumber).value = shortDay;
    rDayNames.getCell(colNumber).alignment = { horizontal: 'center' };
    rDayNames.getCell(colNumber).font = { bold: true, size: 9 };
  });

  // Estilos de encabezado
  for (let c = 2; c <= numCols + 1; c++) {
    rDates.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EBEF' } };
    rDayNames.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EBEF' } };
  }

  let curRow = 6;
  users.forEach((u) => {
    const crew = crews.find((c) => c.id === u.crewId);
    const row = ws2.getRow(curRow);
    row.getCell(2).value = crew?.name || 'General';
    row.getCell(3).value = u.name;

    params.dates.forEach((dStr, idx) => {
      const colNum = idx + 4;
      const shift = shifts.find((s) => s.userId === u.id && s.date === dStr);
      const code = shift?.shiftCode || 'L';
      const cell = row.getCell(colNum);
      cell.value = code;
      cell.alignment = { horizontal: 'center' };
      cell.font = { bold: true };

      // Colores de turno
      if (code === 'M') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }; // Azul claro
      } else if (code === 'T') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Verde claro
      } else if (code === 'N') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // Violeta claro
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Gris
      }
    });
    curRow++;
  });

  // CONTROL DE COBERTURA DIARIA
  curRow += 2;
  ws2.getCell(curRow, 2).value = 'CONTROL DE COBERTURA DIARIA';
  ws2.getCell(curRow, 2).font = { bold: true, size: 11, color: { argb: 'FF0F4F5F' } };
  curRow++;

  const coverageShifts = [
    { code: 'M', name: 'Turno Mañana (06:00 a 14:00)' },
    { code: 'T', name: 'Turno Tarde (14:00 a 22:00)' },
    { code: 'N', name: 'Turno Noche (22:00 a 06:00)' },
  ];

  coverageShifts.forEach((cs) => {
    const row = ws2.getRow(curRow);
    row.getCell(3).value = cs.name;
    row.getCell(3).font = { bold: true };

    params.dates.forEach((dStr, idx) => {
      const colNum = idx + 4;
      const count = shifts.filter((s) => s.date === dStr && s.shiftCode === cs.code).length;
      const cell = row.getCell(colNum);
      cell.value = count;
      cell.alignment = { horizontal: 'center' };
      cell.font = { bold: true };
      if (count < 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; // Alerta rojo
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Verde
      }
    });
    curRow++;
  });

  // Total Activo y Estado
  const totalRow = ws2.getRow(curRow);
  totalRow.getCell(3).value = 'Total Personal Activo';
  totalRow.getCell(3).font = { bold: true };
  params.dates.forEach((dStr, idx) => {
    const colNum = idx + 4;
    const count = shifts.filter((s) => s.date === dStr && s.shiftCode !== 'L').length;
    totalRow.getCell(colNum).value = count;
    totalRow.getCell(colNum).alignment = { horizontal: 'center' };
    totalRow.getCell(colNum).font = { bold: true };
  });

  ws2.getColumn(2).width = 16;
  ws2.getColumn(3).width = 24;
  for (let c = 4; c <= numCols + 1; c++) {
    ws2.getColumn(c).width = 6;
  }

  // -------------------------------------------------------------
  // HOJA 3: Calendario por Equipos
  // -------------------------------------------------------------
  const ws3 = wb.addWorksheet('Calendario por Equipos', {
    views: [{ showGridLines: true }],
  });

  ws3.mergeCells('B2:H2');
  const titleCell3 = ws3.getCell('B2');
  titleCell3.value = 'CALENDARIO INDIVIDUALIZADO POR EQUIPO - ROTACIÓN OPTIMIZADA';
  titleCell3.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
  titleCell3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(2).height = 28;

  let eqRow = 4;
  crews.forEach((cr) => {
    ws3.getCell(eqRow, 2).value = `${cr.name} (${cr.description})`;
    ws3.getCell(eqRow, 2).font = { bold: true, size: 12, color: { argb: 'FF0F4F5F' } };
    eqRow++;

    const members = users.filter((u) => u.crewId === cr.id);
    members.forEach((m) => {
      ws3.getCell(eqRow, 3).value = m.name;
      ws3.getCell(eqRow, 3).font = { bold: true };

      params.dates.slice(0, 15).forEach((dStr, idx) => {
        const colNum = idx + 4;
        const shift = shifts.find((s) => s.userId === m.id && s.date === dStr);
        const cell = ws3.getCell(eqRow, colNum);
        cell.value = shift?.shiftCode || 'L';
        cell.alignment = { horizontal: 'center' };
      });
      eqRow++;
    });
    eqRow++;
  });

  ws3.getColumn(2).width = 20;
  ws3.getColumn(3).width = 22;
  for (let c = 4; c <= 20; c++) {
    ws3.getColumn(c).width = 6;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Genera el archivo Excel de Historial de Horas y Asistencia con la estructura exacta de
 * «Historial Horas Noviembre_2026 (RESUMEN 15 DIAS).xlsx»
 * (Una hoja por cada funcionario + Fila de totales y Resumen de horas)
 */
export async function generateAttendanceHistoryExcel(params: {
  orgId: string;
  startDate: string;
  endDate: string;
  userIds?: string[];
  includeDeactivated?: boolean;
}): Promise<Buffer> {
  const org = dataStore.getOrganization(params.orgId);
  const crews = dataStore.listCrews(params.orgId);
  const users = dataStore
    .listUsers(params.orgId, params.includeDeactivated)
    .filter((u) => u.role !== 'ADMIN')
    .filter((u) => !params.userIds || params.userIds.includes(u.id));

  const shifts = dataStore.listShifts(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const attendances = dataStore.listAttendances(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Turnos 24/7 - Aldo Samudio';
  wb.created = new Date();

  // Si no hay usuarios filtrados, creamos hoja vacía
  if (users.length === 0) {
    const ws = wb.addWorksheet('Sin datos');
    ws.getCell('A1').value = 'No se encontraron funcionarios para el período seleccionado.';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  for (const user of users) {
    const crew = crews.find((c) => c.id === user.crewId);
    // Sanear nombre de hoja (máximo 31 caracteres, sin caracteres especiales)
    const sheetName = user.name.replace(/[:\\/?*\[\]]/g, '').slice(0, 30);
    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // Fila 2: Título
    ws.mergeCells('B2:K2');
    const titleCell = ws.getCell('B2');
    titleCell.value = `HISTORIAL DE ASISTENCIA Y HORAS - ${user.name.toUpperCase()} (${crew?.name || 'General'})`;
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4F5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 26;

    // Fila 3: Subtítulo
    ws.mergeCells('B3:K3');
    const subCell = ws.getCell('B3');
    subCell.value = `Modalidad: ${crew?.type === 'ROTATING' ? 'Volante' : 'Fijo'} | Período: ${params.startDate} al ${params.endDate} | Recargo Nocturno (${org.nightSurchargePercent}%): ${org.nightHourStart} a ${org.nightHourEnd} hs`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF333333' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 18;

    // Fila 5: Encabezados de tabla
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

    // Obtener días del período
    const userShifts = shifts.filter((s) => s.userId === user.id);
    const userAttendances = attendances.filter((a) => a.userId === user.id);

    // Mapear cada día
    let currentRow = 6;
    let sumWorkedDays = 0;
    let sumDayHours = 0;
    let sumNightHours = 0;
    let sumTotalHours = 0;

    // Ordenar turnos por fecha
    const sortedShifts = [...userShifts].sort((a, b) => a.date.localeCompare(b.date));

    sortedShifts.forEach((shift) => {
      const att = userAttendances.find((a) => a.date === shift.date);
      const row = ws.getRow(currentRow);

      // 1. Fecha
      row.getCell(2).value = shift.date;
      row.getCell(2).alignment = { horizontal: 'center' };

      // 2. Día
      row.getCell(3).value = getDayNameEs(shift.date);
      row.getCell(3).alignment = { horizontal: 'left' };

      // 3. Turno Asignado
      row.getCell(4).value = shift.shiftCode === 'L' ? 'Libre' : `Turno ${shift.shiftCode}`;
      row.getCell(4).alignment = { horizontal: 'center' };

      // 4. Hora Entrada
      const inTime = att?.clockInTime ? formatTime(att.clockInTime) : '';
      row.getCell(5).value = inTime;
      row.getCell(5).alignment = { horizontal: 'center' };

      // 5. Hora Salida
      const outTime = att?.clockOutTime ? formatTime(att.clockOutTime) : '';
      row.getCell(6).value = outTime;
      row.getCell(6).alignment = { horizontal: 'center' };

      // 6. Días Trabajados
      const workedDays = att ? Number(att.workedDays) : 0;
      row.getCell(7).value = workedDays;
      row.getCell(7).numFmt = '0.0';
      row.getCell(7).alignment = { horizontal: 'right' };
      sumWorkedDays += workedDays;

      // 7. Horas Diurnas
      const dayHours = att ? Number(att.dayHours) : 0;
      row.getCell(8).value = dayHours;
      row.getCell(8).numFmt = '0.0';
      row.getCell(8).alignment = { horizontal: 'right' };
      sumDayHours += dayHours;

      // 8. Horas Nocturnas
      const nightHours = att ? Number(att.nightHours) : 0;
      row.getCell(9).value = nightHours;
      row.getCell(9).numFmt = '0.0';
      row.getCell(9).alignment = { horizontal: 'right' };
      sumNightHours += nightHours;

      // 9. Total Horas
      const totalHours = att ? Number(att.totalHours) : 0;
      row.getCell(10).value = totalHours;
      row.getCell(10).numFmt = '0.0';
      row.getCell(10).alignment = { horizontal: 'right' };
      sumTotalHours += totalHours;

      // 10. Observaciones
      const obs = att?.notes || att?.correctionReason || (shift.shiftCode === 'L' ? 'Día Libre' : '');
      row.getCell(11).value = obs;

      currentRow++;
    });

    // Fila de TOTALES
    const totRow = ws.getRow(currentRow);
    totRow.getCell(2).value = 'TOTALES DEL PERÍODO';
    totRow.getCell(2).font = { bold: true, color: { argb: 'FF0F4F5F' } };
    ws.mergeCells(`B${currentRow}:F${currentRow}`);

    totRow.getCell(7).value = sumWorkedDays;
    totRow.getCell(7).numFmt = '0.0';
    totRow.getCell(7).font = { bold: true };

    totRow.getCell(8).value = sumDayHours;
    totRow.getCell(8).numFmt = '0.0';
    totRow.getCell(8).font = { bold: true };

    totRow.getCell(9).value = sumNightHours;
    totRow.getCell(9).numFmt = '0.0';
    totRow.getCell(9).font = { bold: true };

    totRow.getCell(10).value = sumTotalHours;
    totRow.getCell(10).numFmt = '0.0';
    totRow.getCell(10).font = { bold: true };

    for (let c = 2; c <= 11; c++) {
      totRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EBEF' } };
    }

    // Cuadro de resumen al pie
    currentRow += 2;
    ws.getCell(`B${currentRow}`).value = 'RESUMEN DE HORAS Y JORNALES:';
    ws.getCell(`B${currentRow}`).font = { bold: true, size: 11, color: { argb: 'FF0F4F5F' } };
    currentRow++;

    ws.getCell(`B${currentRow}`).value = 'Días trabajados (completos + medios):';
    ws.getCell(`D${currentRow}`).value = `${sumWorkedDays} días`;
    ws.getCell(`D${currentRow}`).font = { bold: true };
    currentRow++;

    ws.getCell(`B${currentRow}`).value = 'Total Horas Diurnas:';
    ws.getCell(`D${currentRow}`).value = `${sumDayHours} hs`;
    ws.getCell(`D${currentRow}`).font = { bold: true };
    currentRow++;

    ws.getCell(`B${currentRow}`).value = `Total Horas Nocturnas (+${org.nightSurchargePercent}% recargo):`;
    ws.getCell(`D${currentRow}`).value = `${sumNightHours} hs`;
    ws.getCell(`D${currentRow}`).font = { bold: true };
    currentRow++;

    ws.getCell(`B${currentRow}`).value = 'Estado de Liquidación Monetaria:';
    ws.getCell(`D${currentRow}`).value = org.halfDayRuleConfirmed
      ? 'Aprobada'
      : 'Pendiente de confirmación de reglas por administración';
    ws.getCell(`D${currentRow}`).font = {
      bold: true,
      color: { argb: org.halfDayRuleConfirmed ? 'FF16A34A' : 'FFD97706' },
    };

    // Ajustar anchos
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 14;
    ws.getColumn(6).width = 14;
    ws.getColumn(7).width = 16;
    ws.getColumn(8).width = 16;
    ws.getColumn(9).width = 18;
    ws.getColumn(10).width = 16;
    ws.getColumn(11).width = 38;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('es-PY', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '--:--';
  }
}
