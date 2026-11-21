// src/app/api/shifts/publish/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo administradores pueden publicar turnos.' }, { status: 403 });
  }

  const { startDate, endDate } = await request.json();
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Rango de fechas requerido para publicar.' }, { status: 400 });
  }

  const result = dataStore.publishShifts(session.organizationId, startDate, endDate, session.userId);

  dataStore.createAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    userName: session.name,
    action: 'SHIFTS_PUBLISHED',
    entity: 'shifts',
    entityId: `${startDate}_${endDate}`,
    details: { count: result.count, startDate, endDate },
  });

  return NextResponse.json({
    success: true,
    message: `Se han publicado ${result.count} turnos correctamente. Ahora son visibles para los funcionarios.`,
    publishedCount: result.count,
  });
}
