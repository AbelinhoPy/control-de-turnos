// src/lib/export/pdf-generator.ts
// Generador de reportes en PDF formato A4 listo para impresión

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTimeAsuncion, APP_TIMEZONE, getDayNameEs, formatDateAsuncion } from '../time/timezone';
import { dbService } from '../db-service';

export async function generateReportPdf(params: {
  orgId: string;
  reportType: 'asistencia-diaria' | 'historial-individual' | 'horas-jornales' | 'cobertura' | 'incidencias' | 'cierre';
  startDate: string;
  endDate: string;
  userId?: string;
  crewId?: string;
  closureId?: string;
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

  const shifts = await dbService.listShifts(params.orgId, params.startDate, params.endDate, params.crewId);
  const attendances = await dbService.listAttendances(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
    crewId: params.crewId,
    userId: params.userId,
  });

  const isLandscape = ['asistencia-diaria', 'historial-individual', 'horas-jornales', 'cobertura', 'cierre'].includes(
    params.reportType
  );

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Función para encabezado institucional en cada reporte
  const drawHeader = (title: string, subtitle: string) => {
    doc.setFillColor(15, 79, 95); // #0F4F5F Azul Petróleo
    doc.rect(0, 0, pageWidth, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(org.name.toUpperCase(), 14, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Control de Turnos 24/7', pageWidth - 14, 11, { align: 'right' });

    doc.setTextColor(15, 79, 95);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 27);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 33);

    const emitted = `Emitido: ${new Intl.DateTimeFormat('es-PY', {
      timeZone: APP_TIMEZONE,
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date())} hs`;
    doc.text(emitted, pageWidth - 14, 33, { align: 'right' });

    doc.setDrawColor(200, 220, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 36, pageWidth - 14, 36);
  };

  const crewMap = new Map(crews.map((c) => [c.id, c.name]));

  // 1. HORAS Y JORNALES
  if (params.reportType === 'horas-jornales') {
    drawHeader(
      'REPORTE DE HORAS Y JORNALES POR PERÍODO',
      `Período: ${params.startDate} al ${params.endDate} | Franja Nocturna (+${org.nightSurchargePercent}%): ${org.nightHourStart} a ${org.nightHourEnd}`
    );

    const head = [
      [
        'Funcionario',
        'Cuadrilla',
        'Días Compl.',
        'Medios Jorn.',
        'Total Días',
        'Horas Diurnas',
        'Horas Noct.',
        'Total Horas',
        'Jornal Base (Gs.)',
        'Total a Pagar (Gs.)',
        'Estado',
      ],
    ];

    let grandDays = 0;
    let grandHalfDays = 0;
    let grandDayHours = 0;
    let grandNightHours = 0;
    let grandTotalHours = 0;
    let grandTotalPay = 0;

    const body = users.map((u) => {
      const userAtts = attendances.filter((a) => a.userId === u.id);
      let fullDays = 0;
      let halfDays = 0;
      let dayHours = 0;
      let nightHours = 0;
      let totalHours = 0;

      userAtts.forEach((a) => {
        const wd = Number(a.workedDays);
        if (wd === 1.0) fullDays++;
        else if (wd === 0.5) halfDays++;
        dayHours += Number(a.dayHours);
        nightHours += Number(a.nightHours);
        totalHours += Number(a.totalHours);
      });

      const totalDays = fullDays + halfDays * 0.5;
      const baseWage = u.baseDailyWage || 100000;
      const hourlyRate = baseWage / 8;
      const basePay = totalDays * baseWage;
      const nightPay = nightHours * hourlyRate * (org.nightSurchargePercent / 100);
      const totalPay = basePay + nightPay;

      grandDays += fullDays;
      grandHalfDays += halfDays;
      grandDayHours += dayHours;
      grandNightHours += nightHours;
      grandTotalHours += totalHours;
      grandTotalPay += totalPay;

      return [
        u.name,
        u.crewId ? crewMap.get(u.crewId) || 'Volante' : 'Volante',
        fullDays.toString(),
        halfDays.toString(),
        totalDays.toFixed(1),
        dayHours.toFixed(1),
        nightHours.toFixed(1),
        totalHours.toFixed(1),
        baseWage.toLocaleString('es-PY'),
        org.halfDayRuleConfirmed ? Math.round(totalPay).toLocaleString('es-PY') : 'Pendiente config.',
        org.halfDayRuleConfirmed ? 'Aprobado' : 'Pendiente config.',
      ];
    });

    body.push([
      'TOTALES GENERALES',
      '',
      grandDays.toString(),
      grandHalfDays.toString(),
      (grandDays + grandHalfDays * 0.5).toFixed(1),
      grandDayHours.toFixed(1),
      grandNightHours.toFixed(1),
      grandTotalHours.toFixed(1),
      '-',
      org.halfDayRuleConfirmed ? Math.round(grandTotalPay).toLocaleString('es-PY') : 'Pendiente',
      '-',
    ]);

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: { fillColor: [15, 79, 95], textColor: 255, fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  // 2. ASISTENCIA DIARIA
  else if (params.reportType === 'asistencia-diaria') {
    drawHeader(
      'REPORTE DE ASISTENCIA DIARIA Y CONTROL DE NOVEDADES',
      `Rango consultado: ${params.startDate} al ${params.endDate} | Sede: ${org.workplaceName}`
    );

    const head = [
      [
        'Fecha',
        'Funcionario',
        'Cuadrilla',
        'Turno Prog.',
        'Hora Ent.',
        'Hora Sal.',
        'Estado',
        'Horas Trab.',
        'Validación GPS',
        'Observaciones / Corrección',
      ],
    ];

    const body: string[][] = [];
    const filteredShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

    filteredShifts.forEach((s) => {
      const u = users.find((usr) => usr.id === s.userId);
      if (!u) return;
      const att = attendances.find((a) => a.userId === u.id && a.date === s.date);

      const inTime = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--';
      const outTime = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--';

      let statusLabel = 'Ausente';
      if (s.shiftCode === 'L') statusLabel = 'Libre';
      else if (att) {
        if (att.status === 'COMPLETA') statusLabel = 'Completa';
        else if (att.status === 'EN_CURSO') statusLabel = 'En curso';
        else if (att.status === 'INCOMPLETA') statusLabel = 'Incompleta';
        else if (att.status === 'AUSENTE') statusLabel = 'Ausente';
      }

      body.push([
        s.date,
        u.name,
        u.crewId ? crewMap.get(u.crewId) || 'General' : 'General',
        s.shiftCode,
        inTime,
        outTime,
        statusLabel,
        att ? `${Number(att.totalHours).toFixed(1)} hs` : '0 hs',
        att?.clockInStatus === 'VALID' ? 'Dentro radio' : att?.clockInStatus === 'MANUAL' ? 'Manual' : '-',
        att?.correctionReason || att?.notes || '',
      ]);
    });

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: { fillColor: [15, 79, 95], textColor: 255, fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  // 3. HISTORIAL INDIVIDUAL
  else if (params.reportType === 'historial-individual') {
    const selectedUser = users.find((u) => u.id === params.userId) || users[0];

    drawHeader(
      `HISTORIAL DE ASISTENCIA - ${selectedUser?.name.toUpperCase()}`,
      `Cuadrilla: ${selectedUser?.crewId ? crewMap.get(selectedUser.crewId) : 'General'} | Período: ${params.startDate} al ${params.endDate}`
    );

    const head = [
      [
        'Fecha',
        'Día',
        'Turno Asig.',
        'Entrada',
        'Salida',
        'Días Trab.',
        'Horas Diurnas',
        'Horas Noct.',
        'Total Horas',
        'Observaciones',
      ],
    ];

    const userShifts = shifts.filter((s) => s.userId === selectedUser?.id);
    let totD = 0;
    let totDiurnas = 0;
    let totNoct = 0;
    let totH = 0;

    const body = userShifts.map((s) => {
      const att = attendances.find((a) => a.userId === selectedUser?.id && a.date === s.date);
      const inTime = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--';
      const outTime = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--';
      const wd = att ? Number(att.workedDays) : 0;
      const dh = att ? Number(att.dayHours) : 0;
      const nh = att ? Number(att.nightHours) : 0;
      const th = att ? Number(att.totalHours) : 0;

      totD += wd;
      totDiurnas += dh;
      totNoct += nh;
      totH += th;

      return [
        s.date,
        getDayNameEs(s.date),
        s.shiftCode === 'L' ? 'Libre' : `Turno ${s.shiftCode}`,
        inTime,
        outTime,
        wd.toFixed(1),
        dh.toFixed(1),
        nh.toFixed(1),
        th.toFixed(1),
        att?.notes || att?.correctionReason || '',
      ];
    });

    body.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      totD.toFixed(1),
      totDiurnas.toFixed(1),
      totNoct.toFixed(1),
      totH.toFixed(1),
      '',
    ]);

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: { fillColor: [15, 79, 95], textColor: 255, fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  // 4. COBERTURA DE TURNOS
  else if (params.reportType === 'cobertura') {
    drawHeader(
      'REPORTE DE COBERTURA DE TURNOS 24/7',
      `Período: ${params.startDate} al ${params.endDate} | Meta inicial: 2 funcionarios por turno activo`
    );

    const head = [
      ['Fecha', 'Día', 'Turno Mañana (06-14)', 'Turno Tarde (14-22)', 'Turno Noche (22-06)', 'Total Activo', 'Estado'],
    ];

    const dates = Array.from(new Set(shifts.map((s) => s.date))).sort();
    const body: string[][] = [];

    dates.forEach((d) => {
      const dayShifts = shifts.filter((s) => s.date === d);
      const mCount = dayShifts.filter((s) => s.shiftCode === 'M').length;
      const tCount = dayShifts.filter((s) => s.shiftCode === 'T').length;
      const nCount = dayShifts.filter((s) => s.shiftCode === 'N').length;
      const total = mCount + tCount + nCount;
      const isFull = mCount >= 2 && tCount >= 2 && nCount >= 2;

      body.push([
        d,
        getDayNameEs(d),
        `${mCount} / 2`,
        `${tCount} / 2`,
        `${nCount} / 2`,
        `${total} pers.`,
        isFull ? 'Cobertura Completa' : 'Alerta de Cobertura',
      ]);
    });

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: { fillColor: [15, 79, 95], textColor: 255, fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  // 5. INCIDENCIAS Y CORRECCIONES
  else if (params.reportType === 'incidencias') {
    drawHeader(
      'REPORTE DE INCIDENCIAS, MARCAS MANUALES Y AUDITORÍA',
      `Período: ${params.startDate} al ${params.endDate}`
    );

    const incidents = await dbService.listAttendanceIncidents(params.orgId);
    const head = [
      ['Fecha', 'Funcionario', 'Tipo', 'Descripción / Solicitud', 'Estado', 'Resolución / Motivo', 'Resuelto Por'],
    ];

    const body = incidents.map((inc) => [
      inc.date,
      inc.userName || 'Funcionario',
      inc.type,
      inc.description,
      inc.status === 'APPROVED' ? 'Aprobada' : inc.status === 'REJECTED' ? 'Rechazada' : 'Pendiente',
      inc.resolutionNotes || '-',
      inc.resolvedByName || '-',
    ]);

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: { fillColor: [15, 79, 95], textColor: 255, fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  // 6. CIERRE DE PERÍODO (Consulta por closureId específico y snapshot inmutable)
  else {
    let activeClosure: any = null;
    if (params.closureId) {
      const fetched = await dbService.getPeriodClosure(params.closureId);
      if (fetched && fetched.organizationId === params.orgId) {
        activeClosure = fetched;
      }
    }

    if (activeClosure) {
      drawHeader(
        `REPORTE DE CIERRE DE PERÍODO — ${activeClosure.name.toUpperCase()} (INMUTABLE)`,
        `Período: ${activeClosure.startDate} al ${activeClosure.endDate} | Estado: ${activeClosure.status === 'APROBADO' ? 'APROBADO (Inmutable / Congelado)' : activeClosure.status}`
      );

      const summaryData = (activeClosure.summaryData as any) || {};

      // Tabla 1: Resumen General y Reglas Inmutables
      const summaryHead = [
        ['Parámetro', 'Valor Registrado', 'Parámetro', 'Valor Registrado'],
      ];

      const summaryBody = [
        [
          'Estado del Cierre:',
          activeClosure.status === 'APROBADO' ? 'APROBADO (Congelado)' : activeClosure.status,
          'Personal Activo:',
          (summaryData.totalEmployees || 0).toString(),
        ],
        [
          'Rango de Fechas:',
          `${activeClosure.startDate} al ${activeClosure.endDate}`,
          'Días Totales Computados:',
          (summaryData.totalDaysWorked || 0).toFixed(1),
        ],
        [
          'Aprobado Por:',
          activeClosure.approvedByName || 'Pendiente de aprobación',
          'Total Horas Diurnas:',
          `${(summaryData.totalDayHours || 0).toFixed(1)} hs`,
        ],
        [
          'Fecha de Aprobación:',
          activeClosure.approvedAt ? formatDateAsuncion(activeClosure.approvedAt) : 'Borrador',
          'Total Horas Nocturnas (+30%):',
          `${(summaryData.totalNightHours || 0).toFixed(1)} hs`,
        ],
        [
          'Franja Nocturna Aplicada:',
          `${activeClosure.nightHourStart} a ${activeClosure.nightHourEnd} hs`,
          'Total General de Horas:',
          `${(summaryData.totalHours || 0).toFixed(1)} hs`,
        ],
      ];

      autoTable(doc, {
        startY: 40,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        showHead: 'everyPage',
        headStyles: { fillColor: [15, 79, 95], textColor: 255, fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      // Tabla 2: Detalle por Funcionario (Snapshot)
      const lastY = (doc as any).lastAutoTable?.finalY || 80;
      doc.setFontSize(11);
      doc.setTextColor(15, 79, 95);
      doc.text('Detalle por Funcionario y Liquidación (Snapshot Inmutable):', 14, lastY + 8);

      const detailHead = [
        ['Funcionario', 'Cuadrilla', 'Días Trab.', 'Hs Diurnas', 'Hs Nocturnas', 'Total Horas', 'Jornal Base (Gs.)', 'Total Pagado (Gs.)'],
      ];

      const details = (activeClosure as any)?.detailsSnapshot || [];
      const detailBody = details.map((d: any) => [
        d.userName || 'Funcionario',
        d.crewId || 'General',
        Number(d.workedDays || 0).toFixed(1),
        Number(d.dayHours || 0).toFixed(1),
        Number(d.nightHours || 0).toFixed(1),
        Number(d.totalHours || 0).toFixed(1),
        Number(d.baseDailyWage || 100000).toLocaleString('es-PY'),
        Number(d.totalPay || 0).toLocaleString('es-PY'),
      ]);

      if (detailBody.length > 0) {
        autoTable(doc, {
          startY: lastY + 12,
          head: detailHead,
          body: detailBody,
          theme: 'grid',
          showHead: 'everyPage',
          headStyles: { fillColor: [30, 127, 148], textColor: 255, fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [245, 250, 252] },
          margin: { left: 14, right: 14 },
        });
      }
    } else {
      // Si no se pasó closureId o no pertenece a la organización: BORRADOR DE RANGO NO CERRADO
      drawHeader(
        'BORRADOR DE CIERRE DE PERÍODO (NO CERRADO)',
        `Rango: ${params.startDate} al ${params.endDate} | Estado: BORRADOR NO CERRADO (Valores preliminares en vivo)`
      );

      const draftAttendances = await dbService.listAttendances(params.orgId, {
        startDate: params.startDate,
        endDate: params.endDate,
      });

      let totalDays = 0;
      let totalDayH = 0;
      let totalNightH = 0;
      let totalH = 0;

      draftAttendances.forEach((a) => {
        totalDays += a.workedDays;
        totalDayH += a.dayHours;
        totalNightH += a.nightHours;
        totalH += a.totalHours;
      });

      const summaryHead = [['Parámetro', 'Valor Preliminar', 'Parámetro', 'Valor Preliminar']];
      const summaryBody = [
        [
          'Estado del Documento:',
          'BORRADOR NO CERRADO',
          'Personal con Registros:',
          new Set(draftAttendances.map((a) => a.userId)).size.toString(),
        ],
        [
          'Rango Consultado:',
          `${params.startDate} al ${params.endDate}`,
          'Días Totales Computados:',
          totalDays.toFixed(1),
        ],
        [
          'Advertencia:',
          'Valores sujetos a cambio',
          'Total Horas Diurnas:',
          `${totalDayH.toFixed(1)} hs`,
        ],
        [
          'Franja Nocturna (+30%):',
          `${org.nightHourStart} a ${org.nightHourEnd} hs`,
          'Total Horas Nocturnas:',
          `${totalNightH.toFixed(1)} hs`,
        ],
        [
          'Tipo de Reporte:',
          'Borrador de liquidación',
          'Total General Horas:',
          `${totalH.toFixed(1)} hs`,
        ],
      ];

      autoTable(doc, {
        startY: 40,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        showHead: 'everyPage',
        headStyles: { fillColor: [180, 83, 9], textColor: 255, fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      const lastY = (doc as any).lastAutoTable?.finalY || 80;
      doc.setFontSize(11);
      doc.setTextColor(180, 83, 9);
      doc.text('Detalle Preliminar de Jornadas (Borrador no cerrado):', 14, lastY + 8);

      const detailHead = [
        ['Fecha', 'Funcionario', 'Días Trab.', 'Hs Diurnas', 'Hs Nocturnas', 'Total Horas', 'Estado'],
      ];

      const userMap = new Map(users.map((u) => [u.id, u.name]));
      const detailBody = draftAttendances.slice(0, 100).map((a) => [
        a.date,
        userMap.get(a.userId) || 'Funcionario',
        Number(a.workedDays).toFixed(1),
        Number(a.dayHours).toFixed(1),
        Number(a.nightHours).toFixed(1),
        Number(a.totalHours).toFixed(1),
        a.status,
      ]);

      if (detailBody.length > 0) {
        autoTable(doc, {
          startY: lastY + 12,
          head: detailHead,
          body: detailBody,
          theme: 'grid',
          showHead: 'everyPage',
          headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [255, 251, 235] },
          margin: { left: 14, right: 14 },
        });
      }
    }
  }

  // Numeración de páginas al pie en todas las páginas
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${i} de ${pageCount} | Control de Turnos 24/7 - Sistema de Gestión de Turnos y Jornales`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}
