// src/app/api/attendance/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';
import { getCurrentDateAsuncion } from '@/lib/time/timezone';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const defaultDate = getCurrentDateAsuncion();
    const startDate = searchParams.get('startDate') || (date ? date : defaultDate);
    const endDate = searchParams.get('endDate') || (date ? date : defaultDate);
    const crewId = searchParams.get('crewId') || undefined;

    // Control de acceso estricto: funcionario solo puede ver sus datos
    const isAdmin = session.role === 'ADMIN';
    const requestedUserId = searchParams.get('userId');
    const userId = isAdmin ? (requestedUserId || undefined) : session.userId;
    const status = searchParams.get('status') || undefined;

    const attendances = await dbService.listAttendances(session.organizationId, {
      startDate,
      endDate,
      userId,
      crewId,
      status,
    });

    const users = await dbService.listUsers(session.organizationId, true);
    const shifts = await dbService.listShifts(session.organizationId, startDate, endDate, crewId, userId);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const shiftMap = new Map(shifts.map((s) => [`${s.userId}_${s.date}`, s]));

    // Enriquecer registros con nombres de usuarios y turnos asignados
    const enriched = attendances.map((att) => {
      const user = userMap.get(att.userId);
      const shift = shiftMap.get(`${att.userId}_${att.date}`);

      return {
        ...att,
        userName: user?.name || 'Funcionario',
        userEmail: user?.email,
        crewId: user?.crewId,
        shiftCode: shift?.shiftCode || (att.status === 'LIBRE' ? 'L' : 'M'),
        baseDailyWage: user?.baseDailyWage,
        isActiveUser: user?.isActive ?? true,
      };
    });

    return NextResponse.json({ attendances: enriched });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error al listar asistencias:', error);
    return NextResponse.json({ error: 'Error al consultar asistencias.' }, { status: 500 });
  }
}
