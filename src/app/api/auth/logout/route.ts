// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function POST() {
  const session = await getSession();
  if (session) {
    dataStore.createAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      userName: session.name,
      action: 'LOGOUT',
      entity: 'users',
      entityId: session.userId,
    });
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
