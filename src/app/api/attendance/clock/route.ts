// src/app/api/attendance/clock/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';
import { validateGeofence } from '@/lib/geo/geofence';
import { analyzeGpsRisk } from '@/lib/geo/gpsAntiSpoof';
import { formatDateAsuncion, getNowInAsuncion } from '@/lib/time/timezone';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.isActive) {
      return NextResponse.json({ error: 'No autorizado o sesión expirada.' }, { status: 401 });
    }

    const body = await request.json();
    const { lat, lng, accuracy, type, idempotencyToken, photo } = body;

    // 1. Validar tipo de marcación
    if (type !== 'IN' && type !== 'OUT') {
      return NextResponse.json(
        { error: 'Tipo de marcación no válido. Debe ser "IN" (Entrada) o "OUT" (Salida).' },
        { status: 400 }
      );
    }

    // 2. Validar coordenadas
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Las coordenadas GPS son requeridas para registrar la asistencia.' },
        { status: 400 }
      );
    }

    // 3. Validar precisión del GPS sin asumir valores favorables
    if (accuracy === undefined || accuracy === null || typeof accuracy !== 'number' || isNaN(accuracy)) {
      return NextResponse.json(
        {
          error: 'No se pudo obtener la precisión del GPS desde su dispositivo móvil. Active el modo de alta precisión de ubicación y vuelva a intentar.',
          canRequestReview: true,
        },
        { status: 400 }
      );
    }

    const org = await dbService.getOrganization(session.organizationId);

    // 3.1. Validar fotografía si viene en el payload o si es obligatoria por configuración
    const isValidPhotoFormat =
      typeof photo === 'string' &&
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(photo) &&
      photo.length <= 500_000;
    const sanitizedPhoto = isValidPhotoFormat ? photo : null;

    if (photo !== undefined && photo !== null && !isValidPhotoFormat) {
      return NextResponse.json(
        {
          error: 'La fotografía enviada no tiene un formato válido o supera el tamaño permitido.',
          canRequestReview: true,
        },
        { status: 400 }
      );
    }

    // 4. Validar Geofencing con la precisión informada
    const geoValidation = validateGeofence(
      { latitude: lat, longitude: lng },
      accuracy,
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

    // 5. Usar hora exacta del servidor en Asunción
    const serverTimestamp = getNowInAsuncion();
    const todayStr = formatDateAsuncion(serverTimestamp);

    // 5.1. Análisis anti-GPS falso (no bloquea, solo asigna score de riesgo)
    // Buscamos la última marcación del funcionario para detectar velocidad imposible
    const lastAtt = await dbService.findOpenAttendance(session.userId)
      ?? await dbService.getAttendanceForUserAndDate(session.userId, todayStr);

    const antiSpoofResult = analyzeGpsRisk({
      lat,
      lng,
      accuracy,
      workplaceLat: org.workplaceLat,
      workplaceLng: org.workplaceLng,
      lastClockTimestamp: lastAtt?.clockInTime ? new Date(lastAtt.clockInTime) : null,
      lastClockLat:       lastAtt?.clockInLat  ?? null,
      lastClockLng:       lastAtt?.clockInLng  ?? null,
    });

    // Si el riesgo es alto lo logueamos en consola para trazabilidad (el score se guarda en BD)
    if (antiSpoofResult.isHighRisk) {
      console.warn(
        `[AntiSpoof] Alerta GPS usuario ${session.userId} — score ${antiSpoofResult.riskScore}/100: ${antiSpoofResult.summary}`
      );
    }

    // 6. Procesar Salida ('OUT')
    if (type === 'OUT') {
      // 6.1. Verificar idempotencia primero si viene un token
      if (idempotencyToken) {
        const existingTokenAtt = await dbService.getAttendanceByIdempotencyToken(idempotencyToken);
        if (existingTokenAtt && existingTokenAtt.userId === session.userId) {
          return NextResponse.json({
            success: true,
            message: 'La marcación de salida ya había sido registrada exitosamente para esta jornada.',
            attendance: existingTokenAtt,
          });
        }
      }

      // Buscar primero jornada abierta (incluye turnos nocturnos iniciados ayer o jornadas de hoy)
      let targetAtt = await dbService.findOpenAttendance(session.userId);

      // Si no encuentra por estado EN_CURSO, buscar jornada de hoy
      if (!targetAtt) {
        targetAtt = await dbService.getAttendanceForUserAndDate(session.userId, todayStr);
      }

      // Si aún no encuentra, verificar si corresponde a un turno nocturno de ayer que ya fue cerrado hoy en la mañana (reintento por pérdida de señal móvil)
      if (!targetAtt) {
        const yesterdayDate = new Date(serverTimestamp.getTime() - 24 * 3600 * 1000);
        const yesterdayStr = formatDateAsuncion(yesterdayDate);
        const yesterdayAtt = await dbService.getAttendanceForUserAndDate(session.userId, yesterdayStr);
        if (yesterdayAtt && yesterdayAtt.clockInTime && yesterdayAtt.clockOutTime) {
          const diffHours = (serverTimestamp.getTime() - new Date(yesterdayAtt.clockOutTime).getTime()) / (1000 * 3600);
          if (diffHours < 24) {
            return NextResponse.json({
              success: true,
              message: 'La marcación de salida ya había sido registrada exitosamente para esta jornada nocturna.',
              attendance: yesterdayAtt,
            });
          }
        }
      }

      // La salida nunca debe registrarse sin una entrada previa válida; si falta la entrada, derivar a revisión
      if (!targetAtt || !targetAtt.clockInTime) {
        return NextResponse.json(
          {
            error: 'No se puede registrar salida sin una marcación de entrada previa válida. La jornada ha sido derivada a revisión administrativa.',
            canRequestReview: true,
            needsReview: true,
          },
          { status: 400 }
        );
      }

      // Proteger salida ya registrada (evitar sobreescrituras en reintentos)
      if (targetAtt.clockOutTime) {
        return NextResponse.json({
          success: true,
          message: 'La marcación de salida ya había sido registrada exitosamente para esta jornada.',
          attendance: targetAtt,
        });
      }

      if (org.requirePhotoOnClock && !sanitizedPhoto) {
        return NextResponse.json(
          {
            error: 'La empresa exige una fotografía en vivo para registrar la salida. Capturá tu selfie e intentá nuevamente.',
            canRequestReview: true,
            requiresPhoto: true,
          },
          { status: 400 }
        );
      }

      const updated = await dbService.recordClockOut({
        attendanceId: targetAtt.id,
        timestamp: serverTimestamp,
        lat,
        lng,
        accuracy,
        distanceMeters: geoValidation.distanceMeters,
        status: 'VALID',
        photo: sanitizedPhoto,
        idempotencyToken,
        gpsRiskScore: antiSpoofResult.riskScore,
        gpsRiskFlags: antiSpoofResult.flags.length > 0 ? JSON.stringify(antiSpoofResult.flags) : null,
      });

      return NextResponse.json({
        success: true,
        message: 'Marcación de salida registrada exitosamente.',
        attendance: updated,
      });
    }

    // 7. Procesar Entrada ('IN')
    // Verificar si ya tiene entrada hoy (manejo coherente de reintentos y dobles toques)
    const existingToday = await dbService.getAttendanceForUserAndDate(session.userId, todayStr);
    if (existingToday && existingToday.clockInTime) {
      return NextResponse.json({
        success: true,
        message: 'La marcación de entrada ya había sido registrada exitosamente para hoy.',
        attendance: existingToday,
      });
    }

    // Buscar turno programado de hoy publicado
    const userShifts = await dbService.listShifts(
      session.organizationId,
      todayStr,
      todayStr,
      undefined,
      session.userId,
      true // Solo turnos publicados
    );
    const currentShift = userShifts[0];

    // Caso día libre o turno sin publicar
    if (!currentShift) {
      // Verificar si hay turno cargado pero no publicado
      const allShifts = await dbService.listShifts(session.organizationId, todayStr, todayStr, undefined, session.userId, false);
      const isUnpublished = allShifts.length > 0;

      return NextResponse.json(
        {
          error: isUnpublished
            ? 'Tu turno para hoy aún no ha sido publicado por la administración. Si debes cubrir la jornada, solicita una revisión administrativa.'
            : 'No tienes un turno programado para la fecha de hoy. Si fuiste convocado para un reemplazo, solicita una revisión administrativa.',
          canRequestReview: true,
        },
        { status: 400 }
      );
    }

    if (currentShift.shiftCode === 'L') {
      return NextResponse.json(
        {
          error: 'Hoy tienes asignado día libre en el calendario. Si fuiste convocado a cubrir una guardia, solicita una revisión administrativa para registrar tu ingreso.',
          canRequestReview: true,
        },
        { status: 400 }
      );
    }

    if (org.requirePhotoOnClock && !sanitizedPhoto) {
      return NextResponse.json(
        {
          error: 'La empresa exige una fotografía en vivo para registrar la entrada. Capturá tu selfie e intentá nuevamente.',
          canRequestReview: true,
          requiresPhoto: true,
        },
        { status: 400 }
      );
    }

    const att = await dbService.recordClockIn({
      userId: session.userId,
      organizationId: session.organizationId,
      date: todayStr,
      timestamp: serverTimestamp,
      lat,
      lng,
      accuracy,
      distanceMeters: geoValidation.distanceMeters,
      status: 'VALID',
      shiftId: currentShift.id,
      photo: sanitizedPhoto,
      idempotencyToken,
      gpsRiskScore: antiSpoofResult.riskScore,
      gpsRiskFlags: antiSpoofResult.flags.length > 0 ? JSON.stringify(antiSpoofResult.flags) : null,
    });

    return NextResponse.json({
      success: true,
      message: 'Marcación de entrada registrada exitosamente.',
      attendance: att,
      gpsRiskScore: antiSpoofResult.riskScore,
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error registrando marcación:', error);
    return NextResponse.json({ error: 'Error interno al registrar la marcación.' }, { status: 500 });
  }
}
