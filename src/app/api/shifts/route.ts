// src/app/api/shifts/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const crewId = searchParams.get('crewId') || undefined;
  const userId = session.role === 'ADMIN' ? searchParams.get('userId') || undefined : session.userId;

  const shifts = dataStore.listShifts(session.organizationId, {
    startDate,
    endDate,
    crewId,
    userId,
  });

  return NextResponse.json({ shifts });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo administradores pueden modificar turnos.' }, { status: 403 });
  }

  const body = await request.json();
  const { userId, date, shiftCode, notes } = body;

  if (!userId || !date || !shiftCode) {
    return NextResponse.json({ error: 'Datos incompletos para asignar el turno.' }, { status: 400 });
  }

  const templates = dataStore.listShiftTemplates(session.organizationId);
  const template = templates.find((t) => t.code === shiftCode) || templates[0];
  const user = dataStore.getUserById(userId);

  const saved = dataStore.saveShift({
    organizationId: session.organizationId,
    userId,
    crewId: user?.crewId || null,
    shiftTemplateId: template.id,
    shiftCode,
    date,
    isPublished: false,
    notes,
  });

  return NextResponse.json({ success: true, shift: saved });
}
