// src/app/api/export/excel/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generatePlanningExcel, generateAttendanceHistoryExcel } from '@/lib/export/excel-generator';
import { getDatesInRange } from '@/lib/time/timezone';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden exportar planillas Excel.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'history'; // 'planning' o 'history'
    const startDate = searchParams.get('startDate') || '2026-11-01';
    const endDate = searchParams.get('endDate') || '2026-11-15';
    const includeDeactivated = searchParams.get('includeDeactivated') === 'true';
    const userId = searchParams.get('userId') || undefined;

    let buffer: Buffer;
    let filename: string;

    if (type === 'planning') {
      const dates = getDatesInRange(startDate, endDate);
      buffer = await generatePlanningExcel({
        orgId: session.organizationId,
        startDate,
        endDate,
        dates,
      });
      filename = `Planificacion_Turnos_${startDate}_al_${endDate}.xlsx`;
    } else {
      buffer = await generateAttendanceHistoryExcel({
        orgId: session.organizationId,
        startDate,
        endDate,
        userIds: userId ? [userId] : undefined,
        includeDeactivated,
      });
      filename = `Historial_Horas_Asistencia_${startDate}_al_${endDate}.xlsx`;
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generando Excel:', error);
    return NextResponse.json({ error: 'Error al exportar archivo Excel.' }, { status: 500 });
  }
}
