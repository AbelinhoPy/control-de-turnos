// src/app/api/closures/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataStore } from '@/lib/data-store';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const closures = dataStore.listPeriodClosures(session.organizationId);
  return NextResponse.json({ closures });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden gestionar cierres.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, name, startDate, endDate, closureId } = body;

    // 1. Aprobar cierre existente
    if (action === 'APPROVE') {
      if (!closureId) {
        return NextResponse.json({ error: 'ID de cierre requerido' }, { status: 400 });
      }

      const approved = dataStore.approvePeriodClosure(closureId, session.userId, session.name);
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

    const org = dataStore.getOrganization(session.organizationId);
    const users = dataStore.listUsers(session.organizationId, true).filter((u) => u.role !== 'ADMIN');
    const attendances = dataStore.listAttendances(session.organizationId, { startDate, endDate });

    let totalDaysWorked = 0;
    let totalHalfDays = 0;
    let totalDayHours = 0;
    let totalNightHours = 0;
    let totalHours = 0;

    attendances.forEach((a) => {
      const wd = Number(a.workedDays);
      if (wd === 0.5) totalHalfDays++;
      totalDaysWorked += wd;
      totalDayHours += Number(a.dayHours);
      totalNightHours += Number(a.nightHours);
      totalHours += Number(a.totalHours);
    });

    const closure = dataStore.createPeriodClosure({
      organizationId: session.organizationId,
      name,
      startDate,
      endDate,
      status: 'BORRADOR',
      nightHourStart: org.nightHourStart,
      nightHourEnd: org.nightHourEnd,
      nightSurchargePercent: org.nightSurchargePercent,
      rulesSnapshot: {
        halfDayRuleConfirmed: org.halfDayRuleConfirmed,
        hourlyRateRuleConfirmed: org.hourlyRateRuleConfirmed,
        nightHourStart: org.nightHourStart,
        nightHourEnd: org.nightHourEnd,
        nightSurchargePercent: org.nightSurchargePercent,
        wageCalculationFormula: org.halfDayRuleConfirmed
          ? 'Jornal base / 8 horas * horas + recargo'
          : 'Pendiente de confirmación de reglas',
      },
      summaryData: {
        totalEmployees: users.length,
        totalDaysWorked,
        totalHalfDays,
        totalDayHours,
        totalNightHours,
        totalHours,
        payrollStatus: org.halfDayRuleConfirmed ? 'APROBADO' : 'PENDIENTE_CONFIGURACION',
      },
    });

    return NextResponse.json({ success: true, closure });
  } catch (error) {
    console.error('Error en cierres:', error);
    return NextResponse.json({ error: 'Error procesando el cierre de período.' }, { status: 500 });
  }
}
