// src/app/api/attendance/correct/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      attendanceId,
      userId,
      date,
      clockInTime,
      clockOutTime,
      workedDays,
      status,
      correctionReason,
    } = body;

    if (!correctionReason || correctionReason.trim().length < 5) {
      return NextResponse.json(
        { error: 'Debe ingresar un motivo descriptivo y obligatorio para la corrección (mínimo 5 caracteres).' },
        { status: 400 }
      );
    }

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'El usuario y la fecha de la jornada son obligatorios.' },
        { status: 400 }
      );
    }

    const corrected = await dbService.correctAttendance({
      attendanceId,
      userId,
      organizationId: session.organizationId,
      date,
      clockInTime: clockInTime || undefined,
      clockOutTime: clockOutTime || undefined,
      workedDays: workedDays !== undefined ? Number(workedDays) : undefined,
      status: status || 'COMPLETA',
      reason: correctionReason.trim(),
      adminUserId: session.userId,
      adminName: session.name,
    });

    return NextResponse.json({
      success: true,
      message: 'Jornada corregida y registrada en la bitácora inmutable de auditoría con éxito.',
      attendance: corrected,
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error en corrección manual:', error);
    return NextResponse.json({ error: 'Error al procesar la corrección manual.' }, { status: 500 });
  }
}
