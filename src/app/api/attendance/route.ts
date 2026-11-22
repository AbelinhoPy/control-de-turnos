// src/app/api/attendance/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const startDate = searchParams.get('startDate') || (date ? date : undefined);
  const endDate = searchParams.get('endDate') || (date ? date : undefined);
  const userId = session.role === 'ADMIN' ? searchParams.get('userId') || undefined : session.userId;
  const status = searchParams.get('status') || undefined;

  const attendances = dataStore.listAttendances(session.organizationId, {
    startDate,
    endDate,
    userId,
    status,
  });

  const users = dataStore.listUsers(session.organizationId, true);
  const shifts = dataStore.listShifts(session.organizationId, {
    startDate,
    endDate,
    userId,
  });

  // Enriquecer registros con nombres de usuarios y turnos asignados
  const enriched = attendances.map((att) => {
    const user = users.find((u) => u.id === att.userId);
    const shift = shifts.find((s) => s.userId === att.userId && s.date === att.date);

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
}
