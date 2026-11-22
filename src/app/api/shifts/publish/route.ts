// src/app/api/shifts/publish/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden publicar turnos.' }, { status: 403 });
    }

    const { startDate, endDate, shiftIds } = await request.json();

    let targetIds: string[] = [];
    if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 0) {
      targetIds = shiftIds;
    } else if (startDate && endDate) {
      const shifts = await dbService.listShifts(session.organizationId, startDate, endDate);
      targetIds = shifts.map((s) => s.id);
    } else {
      return NextResponse.json({ error: 'Rango de fechas o IDs de turnos requeridos para publicar.' }, { status: 400 });
    }

    const count = await dbService.publishShifts(session.organizationId, targetIds, session.userId);

    return NextResponse.json({
      success: true,
      message: `Se han publicado ${count} turnos correctamente. Ahora son visibles para los funcionarios.`,
      publishedCount: count,
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error publicando turnos:', error);
    return NextResponse.json({ error: 'Error al publicar los turnos.' }, { status: 500 });
  }
}
