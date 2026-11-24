// src/app/api/export/excel/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  generateDailyAttendanceExcel,
  generateAttendanceHistoryExcel,
  generateHoursAndWagesExcel,
  generateShiftCoverageExcel,
  generateIncidentsExcel,
  generateClosureExcel,
  generatePlanningExcel,
} from '@/lib/export/excel-generator';
import { getDatesInRange } from '@/lib/time/timezone';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden exportar planillas Excel.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType') || searchParams.get('type') || 'horas-jornales';
    const startDate = searchParams.get('startDate') || '2026-11-01';
    const endDate = searchParams.get('endDate') || '2026-11-15';
    const date = searchParams.get('date') || startDate;
    const includeDeactivated = searchParams.get('includeDeactivated') === 'true';
    const userId = searchParams.get('userId') || undefined;
    const crewId = searchParams.get('crewId') || undefined;
    const closureId = searchParams.get('closureId') || undefined;

    let buffer: Buffer;
    let filename: string;

    switch (reportType) {
      case 'asistencia-diaria':
        buffer = await generateDailyAttendanceExcel({
          orgId: session.organizationId,
          date,
          crewId,
          userId,
        });
        filename = `Asistencia_Diaria_${date}.xlsx`;
        break;

      case 'historial-individual':
      case 'history':
        buffer = await generateAttendanceHistoryExcel({
          orgId: session.organizationId,
          startDate,
          endDate,
          userIds: userId && userId !== 'ALL' ? [userId] : undefined,
          crewId: crewId && crewId !== 'ALL' ? crewId : undefined,
          includeDeactivated,
        });
        filename = `Historial_Horas_Asistencia_${startDate}_al_${endDate}.xlsx`;
        break;

      case 'horas-jornales':
        buffer = await generateHoursAndWagesExcel({
          orgId: session.organizationId,
          startDate,
          endDate,
          crewId: crewId && crewId !== 'ALL' ? crewId : undefined,
          userId: userId && userId !== 'ALL' ? userId : undefined,
          includeDeactivated,
        });
        filename = `Horas_y_Jornales_${startDate}_al_${endDate}.xlsx`;
        break;

      case 'cobertura':
        buffer = await generateShiftCoverageExcel({
          orgId: session.organizationId,
          startDate,
          endDate,
          crewId: crewId && crewId !== 'ALL' ? crewId : undefined,
        });
        filename = `Cobertura_Turnos_${startDate}_al_${endDate}.xlsx`;
        break;

      case 'incidencias':
        buffer = await generateIncidentsExcel({
          orgId: session.organizationId,
        });
        filename = `Incidencias_y_Correcciones_${startDate}_al_${endDate}.xlsx`;
        break;

      case 'cierre':
        buffer = await generateClosureExcel({
          orgId: session.organizationId,
          closureId,
          startDate,
          endDate,
        });
        filename = closureId
          ? `Cierre_Periodo_${closureId}.xlsx`
          : `Borrador_Cierre_${startDate}_al_${endDate}.xlsx`;
        break;

      case 'planning':
      default:
        const dates = getDatesInRange(startDate, endDate);
        buffer = await generatePlanningExcel({
          orgId: session.organizationId,
          startDate,
          endDate,
          dates,
        });
        filename = `Planificacion_Turnos_${startDate}_al_${endDate}.xlsx`;
        break;
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error generando Excel:', error);
    return NextResponse.json({ error: 'Error al exportar archivo Excel.' }, { status: 500 });
  }
}
