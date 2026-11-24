// src/app/api/closures/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado. Solo administradores pueden consultar cierres.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const closureId = searchParams.get('id');

    if (closureId) {
      const closure = await dbService.getPeriodClosure(closureId);
      if (!closure || closure.organizationId !== session.organizationId) {
        return NextResponse.json({ error: 'Cierre no encontrado o no pertenece a su organización.' }, { status: 404 });
      }
      return NextResponse.json({ closure });
    }

    const closures = await dbService.listPeriodClosures(session.organizationId);
    return NextResponse.json({ closures });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error consultando cierres.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden gestionar cierres.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, name, startDate, endDate, closureId } = body;

    // 1. Aprobar cierre existente (Snapshot inmutable)
    if (action === 'APPROVE') {
      if (!closureId) {
        return NextResponse.json({ error: 'ID de cierre requerido' }, { status: 400 });
      }

      const existingClosure = await dbService.getPeriodClosure(closureId);
      if (!existingClosure || existingClosure.organizationId !== session.organizationId) {
        return NextResponse.json({ error: 'Cierre no encontrado o no pertenece a su organización.' }, { status: 404 });
      }

      const approved = await dbService.approvePeriodClosure(closureId, session.userId, session.name);
      return NextResponse.json({
        success: true,
        message: 'Cierre de período aprobado. Los registros de este período han quedado congelados inmutablemente.',
        closure: approved,
      });
    }

    // 2. Crear nuevo cierre (Borrador)
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Nombre, fecha inicio y fin son obligatorios.' }, { status: 400 });
    }

    const draft = await dbService.createPeriodClosureDraft({
      organizationId: session.organizationId,
      name,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Borrador de cierre generado exitosamente para revisión.',
      closure: draft,
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error gestionando cierre:', error);
    return NextResponse.json({ error: 'Error procesando solicitud de cierre.' }, { status: 500 });
  }
}
