// src/app/api/attendance/incident/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const incidents = dataStore.listIncidents(session.organizationId);
  // Si es funcionario, solo sus incidencias
  const filtered =
    session.role === 'ADMIN'
      ? incidents
      : incidents.filter((i) => i.userId === session.userId);

  return NextResponse.json({ incidents: filtered });
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

      const incident = dataStore.createIncident({
        organizationId: session.organizationId,
        userId: session.userId,
        userName: session.name,
        attendanceId: attendanceId || null,
        date,
        type,
        description,
        status: 'PENDING',
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
          { error: 'ID de incidencia, estado y notas de resolución son requeridos.' },
          { status: 400 }
        );
      }

      const resolved = dataStore.resolveIncident({
        incidentId,
        status,
        resolutionNotes,
        resolvedByUserId: session.userId,
        resolvedByName: session.name,
      });

      return NextResponse.json({ success: true, incident: resolved });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error en incidencias:', error);
    return NextResponse.json({ error: 'Error procesando la solicitud de incidencia.' }, { status: 500 });
  }
}
