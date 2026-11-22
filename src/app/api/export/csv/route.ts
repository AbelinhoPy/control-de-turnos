// src/app/api/export/csv/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';
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
    const crewId = searchParams.get('crewId') || undefined;
    const userId = searchParams.get('userId') || undefined;

    const org = await dbService.getOrganization(session.organizationId);
    let users = await dbService.listUsers(session.organizationId, true);
    users = users.filter((u) => u.role !== 'ADMIN');

    if (crewId && crewId !== 'ALL') {
      users = users.filter((u) => u.crewId === crewId);
    }
    if (userId && userId !== 'ALL') {
      users = users.filter((u) => u.id === userId);
    }

    const shifts = await dbService.listShifts(session.organizationId, startDate, endDate, crewId, userId);
    const attendances = await dbService.listAttendances(session.organizationId, { startDate, endDate, crewId, userId });
    const crews = await dbService.listCrews(session.organizationId);

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
        '"Motivo Corrección"',
      ].join(';')
    );

    const crewMap = new Map(crews.map((c) => [c.id, c.name]));

    shifts.forEach((shift) => {
      const user = users.find((u) => u.id === shift.userId);
      if (!user) return;

      const att = attendances.find((a) => a.userId === shift.userId && a.date === shift.date);
      const crewName = user.crewId ? crewMap.get(user.crewId) || 'Sin cuadrilla' : 'Sin cuadrilla';

      const inTime = att?.clockInTime ? formatTimeAsuncion(att.clockInTime) : '--:--';
      const outTime = att?.clockOutTime ? formatTimeAsuncion(att.clockOutTime) : '--:--';
      const workedDays = att ? Number(att.workedDays) : 0;
      const dayHours = att ? Number(att.dayHours) : 0;
      const nightHours = att ? Number(att.nightHours) : 0;
      const totalHours = att ? Number(att.totalHours) : 0;
      const baseDailyWage = user.baseDailyWage || 100000;
      const status = att?.status || (shift.shiftCode === 'L' ? 'LIBRE' : 'SIN_MARCAR');
      const isManual = att?.isManualCorrection ? 'SÍ' : 'NO';
      const reason = (att?.correctionReason || att?.notes || '').replace(/"/g, '""');

      rows.push(
        [
          `"${att?.id || '-'}"`,
          `"${user.name}"`,
          `"${user.documentNumber || '-'}"`,
          `"${crewName}"`,
          `"${shift.date}"`,
          `"${getDayNameEs(shift.date)}"`,
          `"${shift.shiftCode === 'L' ? 'Libre' : `Turno ${shift.shiftCode}`}"`,
          `"${inTime}"`,
          `"${outTime}"`,
          `"${workedDays.toFixed(1).replace('.', ',')}"`,
          `"${dayHours.toFixed(1).replace('.', ',')}"`,
          `"${nightHours.toFixed(1).replace('.', ',')}"`,
          `"${totalHours.toFixed(1).replace('.', ',')}"`,
          `"${baseDailyWage}"`,
          `"${status}"`,
          `"${isManual}"`,
          `"${reason}"`,
        ].join(';')
      );
    });

    const csvContent = BOM + rows.join('\r\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Reporte_Jornadas_${startDate}_al_${endDate}.csv"`,
      },
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error generando CSV:', error);
    return NextResponse.json({ error: 'Error al exportar archivo CSV.' }, { status: 500 });
  }
}
