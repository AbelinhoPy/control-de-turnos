// src/app/api/attendance/correct/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

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
      notes,
    } = body;

    if (!correctionReason || correctionReason.trim().length < 5) {
      return NextResponse.json(
        { error: 'Debe ingresar un motivo descriptivo y obligatorio para la corrección.' },
        { status: 400 }
      );
    }

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'El usuario y la fecha de la jornada son obligatorios.' },
        { status: 400 }
      );
    }

    const corrected = dataStore.correctAttendance({
      attendanceId,
      userId,
      organizationId: session.organizationId,
      date,
      clockInTime: clockInTime || null,
      clockOutTime: clockOutTime || null,
      workedDays: workedDays !== undefined ? Number(workedDays) : undefined,
      status: status || 'COMPLETA',
      correctionReason: correctionReason.trim(),
      correctedByUserId: session.userId,
      correctedByName: session.name,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: 'Jornada corregida y registrada en la auditoría con éxito.',
      attendance: corrected,
    });
  } catch (error) {
    console.error('Error en corrección:', error);
    return NextResponse.json(
      { error: 'Error al procesar la corrección administrativa.' },
      { status: 500 }
    );
  }
}
