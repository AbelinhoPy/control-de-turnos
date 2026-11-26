// src/app/api/config/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dbService } from '@/lib/db-service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const org = await dbService.getOrganization(session.organizationId);
    return NextResponse.json({ organization: org });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error al consultar configuración' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden cambiar la configuración.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      workplaceName,
      workplaceLat,
      workplaceLng,
      geofenceRadiusMeters,
      nightHourStart,
      nightHourEnd,
      nightSurchargePercent,
      halfDayRuleConfirmed,
      hourlyRateRuleConfirmed,
      requirePhotoOnClock,
    } = body;

    const updated = await dbService.updateOrganization(session.organizationId, {
      workplaceName,
      workplaceLat: workplaceLat !== undefined ? Number(workplaceLat) : undefined,
      workplaceLng: workplaceLng !== undefined ? Number(workplaceLng) : undefined,
      geofenceRadiusMeters: geofenceRadiusMeters !== undefined ? Number(geofenceRadiusMeters) : undefined,
      nightHourStart,
      nightHourEnd,
      nightSurchargePercent: nightSurchargePercent !== undefined ? Number(nightSurchargePercent) : undefined,
      halfDayRuleConfirmed: halfDayRuleConfirmed !== undefined ? Boolean(halfDayRuleConfirmed) : undefined,
      hourlyRateRuleConfirmed: hourlyRateRuleConfirmed !== undefined ? Boolean(hourlyRateRuleConfirmed) : undefined,
      requirePhotoOnClock: requirePhotoOnClock !== undefined ? Boolean(requirePhotoOnClock) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración de la empresa y sede actualizada correctamente.',
      organization: updated,
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error actualizando configuración:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración.' }, { status: 500 });
  }
}
