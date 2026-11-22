// src/app/api/export/csv/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';
import { getDayNameEs, formatTimeAsuncion } from '@/lib/time/timezone';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden exportar CSV.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '2026-11-01';
    const endDate = searchParams.get('endDate') || '2026-11-15';
    const org = dataStore.getOrganization(session.organizationId);
    const users = dataStore.listUsers(session.organizationId, true).filter((u) => u.role !== 'ADMIN');
    const shifts = dataStore.listShifts(session.organizationId, { startDate, endDate });
    const attendances = dataStore.listAttendances(session.organizationId, { startDate, endDate });
    const crews = dataStore.listCrews(session.organizationId);

    // Encabezados con BOM para que Excel en Windows reconozca tildes y caracteres en español
    const BOM = '\uFEFF';
    const rows: string[] = [];

    // Fila de metadatos
    rows.push(`"EMPRESA";"${org.name}"`);
    rows.push(`"PERÍODO";"${startDate} al ${endDate}"`);
    rows.push(`"FRANJA NOCTURNA (+${org.nightSurchargePercent}%)";"${org.nightHourStart} a ${org.nightHourEnd}"`);
    rows.push('');

    // Encabezados detallados que permiten rastrear cada total hasta la jornada individual
    rows.push(
      [
        '"ID Jornada"',
        '"Funcionario"',
        '"Cédula"',
        '"Cuadrilla"',
        '"Fecha Turno"',
        '"Día"',
        '"Turno Programado"',
        '"Hora Entrada"',
        '"Hora Salida"',
        '"Días Computados"',
        '"Horas Diurnas"',
        '"Horas Nocturnas (+30%)"',
        '"Total Horas"',
        '"Jornal Base (PYG)"',
        '"Estado Jornada"',
        '"Corrección Manual"',
        '"Motivo / Observaciones"',
        '"Auditado Por"',
      ].join(';')
    );

    // Filas detalladas
    shifts.forEach((shift) => {
      const user = users.find((u) => u.id === shift.userId);
      if (!user) return;
      const crew = crews.find((c) => c.id === user.crewId);
      const att = attendances.find((a) => a.userId === user.id && a.date === shift.date);

      const inTime = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '';
      const outTime = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '';
      const workedDays = att ? Number(att.workedDays).toFixed(1) : '0.0';
      const dayHours = att ? Number(att.dayHours).toFixed(1) : '0.0';
      const nightHours = att ? Number(att.nightHours).toFixed(1) : '0.0';
      const totalHours = att ? Number(att.totalHours).toFixed(1) : '0.0';

      const isManual = att?.isManualCorrection ? 'SÍ' : 'NO';
      const obs = (att?.notes || att?.correctionReason || (shift.shiftCode === 'L' ? 'Día Libre' : '')).replace(
        /"/g,
        '""'
      );
      const auditor = (att?.correctedByName || '').replace(/"/g, '""');

      rows.push(
        [
          `"${att?.id || `sin_marca_${shift.id}`}"`,
          `"${user.name}"`,
          `"${user.documentNumber || ''}"`,
          `"${crew?.name || 'General'}"`,
          `"${shift.date}"`,
          `"${getDayNameEs(shift.date)}"`,
          `"${shift.shiftCode === 'L' ? 'Libre' : `Turno ${shift.shiftCode}`}"`,
          `"${inTime}"`,
          `"${outTime}"`,
          `"${workedDays}"`,
          `"${dayHours}"`,
          `"${nightHours}"`,
          `"${totalHours}"`,
          `"${user.baseDailyWage || 0}"`,
          `"${att?.status || (shift.shiftCode === 'L' ? 'LIBRE' : 'SIN_MARCAR')}"`,
          `"${isManual}"`,
          `"${obs}"`,
          `"${auditor}"`,
        ].join(';')
      );
    });

    const csvContent = BOM + rows.join('\r\n');
    const filename = `Cierre_Jornadas_${startDate}_al_${endDate}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generando CSV:', error);
    return NextResponse.json({ error: 'Error generando archivo CSV.' }, { status: 500 });
  }
}
