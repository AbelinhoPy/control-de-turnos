// src/app/api/attendance/clock/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';
import { validateGeofence } from '@/lib/geo/geofence';
import { formatDateAsuncion, getNowInAsuncion } from '@/lib/time/timezone';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.isActive) {
      return NextResponse.json({ error: 'No autorizado o sesión expirada.' }, { status: 401 });
    }

    const body = await request.json();
    const { lat, lng, accuracy, type, idempotencyToken, manualReason } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Las coordenadas GPS son requeridas para registrar la asistencia.' },
        { status: 400 }
      );
    }

    const org = dataStore.getOrganization(session.organizationId);

    // 1. Validar Geofencing y Precisión del GPS en el servidor
    const geoValidation = validateGeofence(
      { latitude: lat, longitude: lng },
      accuracy || 15,
      {
        center: { latitude: org.workplaceLat, longitude: org.workplaceLng },
        radiusMeters: org.geofenceRadiusMeters,
      }
    );

    if (!geoValidation.isValid) {
      return NextResponse.json(
        {
          error: geoValidation.message,
          errorCode: geoValidation.errorCode,
          distanceMeters: geoValidation.distanceMeters,
          accuracy: geoValidation.accuracy,
          canRequestReview: true,
        },
        { status: 400 }
      );
    }

    // 2. Usar HORA DEL SERVIDOR (instante exacto)
    const serverTimestamp = getNowInAsuncion();
    const todayStr = formatDateAsuncion(serverTimestamp);

    // 3. Manejo de Turno Nocturno (cruza medianoche)
    // Si es una salida ('OUT') en horario de madrugada/mañana (04:00 a 10:00),
    // buscar si el funcionario tiene una marcación 'EN_CURSO' iniciada ayer a la noche (Turno N).
    if (type === 'OUT') {
      const yesterdayDate = new Date(serverTimestamp.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = formatDateAsuncion(yesterdayDate);

      // Buscar si hay asistencia abierta de ayer
      const attYesterday = dataStore.getAttendanceByDate(session.userId, yesterdayStr);
      let targetAtt = attYesterday && attYesterday.status === 'EN_CURSO' ? attYesterday : undefined;

      // Si no hay de ayer, buscar la de hoy
      if (!targetAtt) {
        targetAtt = dataStore.getAttendanceByDate(session.userId, todayStr);
      }

      if (!targetAtt || !targetAtt.clockInTime) {
        return NextResponse.json(
          {
            error:
              'No se encontró una marcación de entrada previa activa. Si olvidaste marcar entrada, podés solicitar una revisión administrativa.',
          },
          { status: 400 }
        );
      }

      const updated = dataStore.recordClockOut({
        attendanceId: targetAtt.id,
        timestamp: serverTimestamp,
        lat,
        lng,
        accuracy: accuracy || 10,
        distanceMeters: geoValidation.distanceMeters,
        status: 'VALID',
        idempotencyToken,
      });

      return NextResponse.json({
        success: true,
        message: 'Marcación de salida registrada exitosamente.',
        attendance: updated,
      });
    }

    // 4. Marcación de Entrada ('IN')
    // Verificar si ya tiene entrada hoy
    const existingToday = dataStore.getAttendanceByDate(session.userId, todayStr);
    if (existingToday && existingToday.clockInTime) {
      return NextResponse.json(
        {
          error: 'Ya registraste tu entrada para la jornada de hoy.',
          attendance: existingToday,
        },
        { status: 400 }
      );
    }

    // Buscar turno programado de hoy
    const userShifts = dataStore.listShifts(session.organizationId, {
      userId: session.userId,
      startDate: todayStr,
      endDate: todayStr,
    });
    const currentShift = userShifts[0];

    const att = dataStore.recordClockIn({
      userId: session.userId,
      organizationId: session.organizationId,
      date: todayStr,
      timestamp: serverTimestamp,
      lat,
      lng,
      accuracy: accuracy || 10,
      distanceMeters: geoValidation.distanceMeters,
      status: 'VALID',
      shiftId: currentShift?.id || null,
      idempotencyToken,
    });

    return NextResponse.json({
      success: true,
      message: 'Marcación de entrada registrada exitosamente.',
      attendance: att,
    });
  } catch (error) {
    console.error('Error en marcación:', error);
    return NextResponse.json(
      { error: 'Error inesperado al procesar la marcación de asistencia.' },
      { status: 500 }
    );
  }
}
