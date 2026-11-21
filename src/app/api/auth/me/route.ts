// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = dataStore.getUserById(session.userId);
  if (!user || !user.isActive) {
    return NextResponse.json({ authenticated: false, error: 'Usuario inactivo' }, { status: 403 });
  }

  const org = dataStore.getOrganization(session.organizationId);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      crewId: user.crewId,
      baseDailyWage: user.baseDailyWage,
    },
    organization: {
      id: org.id,
      name: org.name,
      workplaceName: org.workplaceName,
      workplaceLat: org.workplaceLat,
      workplaceLng: org.workplaceLng,
      geofenceRadiusMeters: org.geofenceRadiusMeters,
      nightHourStart: org.nightHourStart,
      nightHourEnd: org.nightHourEnd,
      nightSurchargePercent: org.nightSurchargePercent,
    },
  });
}
