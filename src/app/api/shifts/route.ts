// src/app/api/shifts/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';
import { getCurrentDateAsuncion, getMonthStartEnd } from '@/lib/time/timezone';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const currentDate = getCurrentDateAsuncion();
    const defaultRange = getMonthStartEnd(currentDate);

    const startDate = searchParams.get('startDate') || defaultRange.startDate;
    const endDate = searchParams.get('endDate') || defaultRange.endDate;
    const crewId = searchParams.get('crewId') || undefined;

    // Los funcionarios SOLO pueden consultar sus propios turnos y deben estar publicados
    const isAdmin = session.role === 'ADMIN';
    const userId = isAdmin ? searchParams.get('userId') || undefined : session.userId;
    const onlyPublished = !isAdmin;

    const shifts = await dbService.listShifts(
      session.organizationId,
      startDate,
      endDate,
      crewId,
      userId,
      onlyPublished
    );

    return NextResponse.json({ shifts });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error listando turnos:', error);
    return NextResponse.json({ error: 'Error al consultar turnos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden modificar turnos.' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, date, shiftCode, notes } = body;

    if (!userId || !date || !shiftCode) {
      return NextResponse.json({ error: 'Datos incompletos para asignar el turno.' }, { status: 400 });
    }

    const templates = await dbService.listShiftTemplates(session.organizationId);
    const template = templates.find((t) => t.code === shiftCode) || templates[0];
    const user = await dbService.getUser(userId);

    const saved = await dbService.assignShift({
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
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error guardando turno:', error);
    return NextResponse.json({ error: 'Error al asignar el turno.' }, { status: 500 });
  }
}
