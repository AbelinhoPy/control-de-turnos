// src/lib/export/pdf-generator.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTimeAsuncion, APP_TIMEZONE, getDayNameEs } from '../time/timezone';
import { dataStore } from '../data-store';

export async function generateReportPdf(params: {
  orgId: string;
  reportType: 'asistencia-diaria' | 'historial-individual' | 'horas-jornales' | 'cobertura' | 'incidencias' | 'cierre';
  startDate: string;
  endDate: string;
  userId?: string;
  includeDeactivated?: boolean;
}): Promise<Buffer> {
  const org = dataStore.getOrganization(params.orgId);
  const crews = dataStore.listCrews(params.orgId);
  const users = dataStore
    .listUsers(params.orgId, params.includeDeactivated)
    .filter((u) => u.role !== 'ADMIN');
  const shifts = dataStore.listShifts(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const attendances = dataStore.listAttendances(params.orgId, {
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const isLandscape = ['asistencia-diaria', 'historial-individual', 'horas-jornales', 'cobertura'].includes(
    params.reportType
  );

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Función para encabezado institucional
  const drawHeader = (title: string, subtitle: string) => {
    // Franja superior azul petróleo
    doc.setFillColor(15, 79, 95); // #0F4F5F
    doc.rect(0, 0, pageWidth, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(org.name.toUpperCase(), 14, 11);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Control de Turnos 24/7', pageWidth - 14, 11, { align: 'right' });

    // Título del reporte
    doc.setTextColor(15, 79, 95);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 27);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, 14, 33);

    const emitted = `Emitido: ${new Intl.DateTimeFormat('es-PY', {
      timeZone: APP_TIMEZONE,
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date())} hs`;
    doc.text(emitted, pageWidth - 14, 33, { align: 'right' });

    // Línea separadora
    doc.setDrawColor(200, 220, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 36, pageWidth - 14, 36);
  };

  // Switch de reportes
  if (params.reportType === 'horas-jornales') {
    drawHeader(
      'REPORTE DE HORAS Y JORNALES POR PERÍODO',
      `Período: ${params.startDate} al ${params.endDate} | Recargo Nocturno: ${org.nightSurchargePercent}% (${org.nightHourStart} a ${org.nightHourEnd})`
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
        'Jornal Base',
        'Importe Est.',
        'Estado Liquidación',
      ],
    ];

    let grandDays = 0;
    let grandHalfDays = 0;
    let grandDayHours = 0;
    let grandNightHours = 0;
    let grandTotalHours = 0;

    const body = users.map((u) => {
      const crew = crews.find((c) => c.id === u.crewId);
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

      grandDays += fullDays;
      grandHalfDays += halfDays;
      grandDayHours += dayHours;
      grandNightHours += nightHours;
      grandTotalHours += totalHours;

      return [
        u.name,
        crew?.name || 'General',
        fullDays.toString(),
        halfDays.toString(),
        (fullDays + halfDays * 0.5).toFixed(1),
        dayHours.toFixed(1),
        nightHours.toFixed(1),
        totalHours.toFixed(1),
        u.baseDailyWage ? `₲ ${u.baseDailyWage.toLocaleString('es-PY')}` : 'No def.',
        org.halfDayRuleConfirmed ? 'Calculado' : 'Pendiente',
        org.halfDayRuleConfirmed ? 'Aprobado' : 'Pendiente config.',
      ];
    });

    // Fila totalizadora
    body.push([
      'TOTALES',
      '',
      grandDays.toString(),
      grandHalfDays.toString(),
      (grandDays + grandHalfDays * 0.5).toFixed(1),
      grandDayHours.toFixed(1),
      grandNightHours.toFixed(1),
      grandTotalHours.toFixed(1),
      '-',
      '-',
      '-',
    ]);

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 79, 95],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  } else if (params.reportType === 'asistencia-diaria') {
    drawHeader(
      'REPORTE DE ASISTENCIA DIARIA Y CONTROL DE NOVEDADES',
      `Rango consultado: ${params.startDate} al ${params.endDate}`
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
        'Observaciones / Novedad',
      ],
    ];

    const body: string[][] = [];
    const filteredShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

    filteredShifts.forEach((s) => {
      const u = users.find((usr) => usr.id === s.userId);
      if (!u) return;
      const crew = crews.find((c) => c.id === u.crewId);
      const att = attendances.find((a) => a.userId === u.id && a.date === s.date);

      const inTime = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--';
      const outTime = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--';

      let statusLabel = 'Ausente';
      if (s.shiftCode === 'L') statusLabel = 'Día Libre';
      else if (att) {
        if (att.status === 'COMPLETA') statusLabel = 'Completa';
        else if (att.status === 'EN_CURSO') statusLabel = 'En curso';
        else if (att.status === 'INCOMPLETA') statusLabel = 'Incompleta';
        else if (att.status === 'AUSENTE') statusLabel = 'Ausente';
      }

      body.push([
        s.date,
        u.name,
        crew?.name || 'General',
        s.shiftCode,
        inTime,
        outTime,
        statusLabel,
        att ? `${Number(att.totalHours).toFixed(1)} hs` : '0 hs',
        att?.notes || att?.correctionReason || '',
      ]);
    });

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 79, 95],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  } else if (params.reportType === 'historial-individual') {
    const selectedUser = users.find((u) => u.id === params.userId) || users[0];
    const crew = crews.find((c) => c.id === selectedUser?.crewId);

    drawHeader(
      `HISTORIAL DE ASISTENCIA - ${selectedUser?.name.toUpperCase()}`,
      `Equipo: ${crew?.name || 'General'} | Período: ${params.startDate} al ${params.endDate}`
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
      headStyles: {
        fillColor: [15, 79, 95],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  } else if (params.reportType === 'cobertura') {
    drawHeader(
      'REPORTE DE COBERTURA DE TURNOS 24/7',
      `Período: ${params.startDate} al ${params.endDate} | Meta inicial: 2 funcionarios por turno`
    );

    const head = [
      [
        'Fecha',
        'Día',
        'Mañana (Prog / Pres)',
        'Tarde (Prog / Pres)',
        'Noche (Prog / Pres)',
        'Total Activos',
        'Estado Cobertura',
      ],
    ];

    const datesMap = new Map<string, { m: number; t: number; n: number; total: number }>();
    shifts.forEach((s) => {
      if (!datesMap.has(s.date)) {
        datesMap.set(s.date, { m: 0, t: 0, n: 0, total: 0 });
      }
      const entry = datesMap.get(s.date)!;
      if (s.shiftCode === 'M') entry.m++;
      if (s.shiftCode === 'T') entry.t++;
      if (s.shiftCode === 'N') entry.n++;
      if (s.shiftCode !== 'L') entry.total++;
    });

    const body: string[][] = [];
    Array.from(datesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, counts]) => {
        const isComplete = counts.m >= 2 && counts.t >= 2 && counts.n >= 2;
        body.push([
          date,
          getDayNameEs(date),
          `${counts.m} / 2`,
          `${counts.t} / 2`,
          `${counts.n} / 2`,
          counts.total.toString(),
          isComplete ? 'Completa 24/7' : 'Déficit de cobertura',
        ]);
      });

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 79, 95],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  } else if (params.reportType === 'incidencias') {
    drawHeader(
      'REPORTE DE INCIDENCIAS, CORRECCIONES MANUALES Y AUDITORÍA',
      `Período: ${params.startDate} al ${params.endDate}`
    );

    const incidents = dataStore.listIncidents(params.orgId);
    const head = [
      ['Fecha', 'Funcionario', 'Tipo Incidencia', 'Descripción', 'Estado', 'Resolución / Motivo', 'Auditado por'],
    ];

    const body = incidents.map((inc) => [
      inc.date,
      inc.userName || 'Funcionario',
      inc.type,
      inc.description,
      inc.status === 'APPROVED' ? 'Aprobada' : inc.status === 'REJECTED' ? 'Rechazada' : 'Pendiente',
      inc.resolutionNotes || 'En revisión',
      inc.resolvedByName ? `${inc.resolvedByName} (${inc.resolvedAt?.slice(0, 10)})` : 'Pendiente',
    ]);

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 79, 95],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  } else {
    // Cierre
    drawHeader(
      'REPORTE DE CIERRE DE PERÍODO Y LIQUIDACIÓN',
      `Período: ${params.startDate} al ${params.endDate}`
    );

    const closures = dataStore.listPeriodClosures(params.orgId);
    const activeClosure = closures[0];

    const head = [
      ['Período', 'Rango', 'Estado', 'Días Totales', 'Horas Diurnas', 'Horas Nocturnas', 'Total Horas', 'Aprobado por'],
    ];

    const body = [
      [
        activeClosure?.name || '1ª Quincena Noviembre',
        `${activeClosure?.startDate} al ${activeClosure?.endDate}`,
        activeClosure?.status || 'BORRADOR',
        activeClosure?.summaryData.totalDaysWorked.toString() || '0',
        activeClosure?.summaryData.totalDayHours.toString() || '0',
        activeClosure?.summaryData.totalNightHours.toString() || '0',
        activeClosure?.summaryData.totalHours.toString() || '0',
        activeClosure?.approvedByName || 'Pendiente de aprobación',
      ],
    ];

    autoTable(doc, {
      startY: 40,
      head,
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 79, 95],
        textColor: 255,
        fontSize: 8,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Numeración de páginas al pie en todas las páginas
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Página ${i} de ${pageCount} | Control de Turnos 24/7 - Sistema para Aldo Samudio`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
