// src/app/api/config/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const org = dataStore.getOrganization(session.organizationId);
  return NextResponse.json({ organization: org });
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
    } = body;

    const updated = dataStore.updateOrganization(session.organizationId, {
      workplaceName,
      workplaceLat: workplaceLat !== undefined ? Number(workplaceLat) : undefined,
      workplaceLng: workplaceLng !== undefined ? Number(workplaceLng) : undefined,
      geofenceRadiusMeters: geofenceRadiusMeters !== undefined ? Number(geofenceRadiusMeters) : undefined,
      nightHourStart,
      nightHourEnd,
      nightSurchargePercent: nightSurchargePercent !== undefined ? Number(nightSurchargePercent) : undefined,
      halfDayRuleConfirmed: halfDayRuleConfirmed !== undefined ? Boolean(halfDayRuleConfirmed) : undefined,
      hourlyRateRuleConfirmed: hourlyRateRuleConfirmed !== undefined ? Boolean(hourlyRateRuleConfirmed) : undefined,
    });

    dataStore.createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userName: session.name,
      action: 'ORGANIZATION_CONFIG_UPDATED',
      entity: 'organizations',
      entityId: session.organizationId,
      details: { updatedFields: Object.keys(body) },
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración de la empresa y sede actualizada correctamente.',
      organization: updated,
    });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración.' }, { status: 500 });
  }
}
