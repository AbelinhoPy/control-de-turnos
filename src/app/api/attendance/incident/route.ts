// src/app/api/attendance/incident/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const incidents = await dbService.listAttendanceIncidents(session.organizationId);
    const filtered =
      session.role === 'ADMIN'
        ? incidents
        : incidents.filter((i) => i.userId === session.userId);

    return NextResponse.json({ incidents: filtered });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error consultando incidencias.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    // 1. Crear incidencia (Funcionario o Admin)
    if (body.action === 'CREATE') {
      const { type, description, date, attendanceId } = body;
      if (!description || !type || !date) {
        return NextResponse.json(
          { error: 'Tipo, fecha y descripción de la solicitud son obligatorios.' },
          { status: 400 }
        );
      }

      const incident = await dbService.createAttendanceIncident({
        organizationId: session.organizationId,
        userId: session.userId,
        attendanceId: attendanceId || undefined,
        date,
        type,
        description,
      });

      return NextResponse.json({ success: true, incident });
    }

    // 2. Resolver incidencia (Solo Admin)
    if (body.action === 'RESOLVE') {
      if (session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Solo administradores pueden resolver incidencias.' }, { status: 403 });
      }

      const { incidentId, status, resolutionNotes } = body;
      if (!incidentId || !status || !resolutionNotes) {
        return NextResponse.json(
          { error: 'ID de incidencia, resolución (APPROVED/REJECTED) y notas requeridas.' },
          { status: 400 }
        );
      }

      const updated = await dbService.resolveAttendanceIncident(
        incidentId,
        status,
        resolutionNotes,
        session.userId,
        session.name
      );

      return NextResponse.json({
        success: true,
        message: `Incidencia ${status === 'APPROVED' ? 'aprobada' : 'rechazada'} exitosamente.`,
        incident: updated,
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error procesando incidencia:', error);
    return NextResponse.json({ error: 'Error procesando solicitud de incidencia.' }, { status: 500 });
  }
}
