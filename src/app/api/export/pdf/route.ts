// src/app/api/export/pdf/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generateReportPdf } from '@/lib/export/pdf-generator';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden exportar reportes en PDF.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = (searchParams.get('reportType') || 'horas-jornales') as
      | 'asistencia-diaria'
      | 'historial-individual'
      | 'horas-jornales'
      | 'cobertura'
      | 'incidencias'
      | 'cierre';
    const startDate = searchParams.get('startDate') || '2026-11-01';
    const endDate = searchParams.get('endDate') || '2026-11-15';
    const userId = searchParams.get('userId') || undefined;
    const crewId = searchParams.get('crewId') || undefined;
    const closureId = searchParams.get('closureId') || undefined;
    const includeDeactivated = searchParams.get('includeDeactivated') === 'true';

    const pdfBuffer = await generateReportPdf({
      orgId: session.organizationId,
      reportType,
      startDate,
      endDate,
      userId: userId && userId !== 'ALL' ? userId : undefined,
      crewId: crewId && crewId !== 'ALL' ? crewId : undefined,
      closureId,
      includeDeactivated,
    });

    const filename = `Reporte_${reportType}_${startDate}_al_${endDate}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error?.code === 'DB_NOT_CONFIGURED') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('Error generando PDF:', error);
    return NextResponse.json({ error: 'Error al exportar documento PDF.' }, { status: 500 });
  }
}
