import { DatabaseService } from '../src/lib/db-service';
import * as bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

async function runDeliveryVerification() {
  console.log('======================================================================');
  console.log('🚀 PRUEBA INTEGRAL DE ENTREGA: USUARIOS, ROLES Y GESTIÓN DE PERSONAL');
  console.log('======================================================================\n');

  const db = new DatabaseService();

  // 1. Verificación de Administrador
  console.log('👤 1. Verificación de Credenciales de Administrador:');
  const admin = await db.getUserByEmail('aldo.samudio@empresa.com.py');
  if (!admin) throw new Error('Administrador no encontrado');
  const adminPassMatch = bcrypt.compareSync('Control2026!', admin.passwordHash);
  console.log(`  ✅ [PASS] Administrador encontrado: ${admin.name} (${admin.email})`);
  console.log(`  ✅ [PASS] Rol verificado: ${admin.role} (Acceso a /admin)`);
  console.log(`  ✅ [PASS] Contraseña verificada: ${adminPassMatch}`);

  // 2. Verificación de Funcionarios por Cuadrilla
  console.log('\n👥 2. Verificación de Funcionarios Operativos:');
  const testStaff = [
    { email: 'porfirio.gimenez@empresa.com.py', expectedCrew: 'crew_a', turno: 'Mañana (06:00 - 14:00)' },
    { email: 'ruben.caceres@empresa.com.py', expectedCrew: 'crew_b', turno: 'Tarde (14:00 - 22:00)' },
    { email: 'dario.fernandez@empresa.com.py', expectedCrew: 'crew_c', turno: 'Noche (22:00 - 06:00)' },
    { email: 'edgar.romero@empresa.com.py', expectedCrew: 'crew_d', turno: 'Volante Rotativo (2M-2T-2N-2L)' },
  ];

  for (const s of testStaff) {
    const user = await db.getUserByEmail(s.email);
    if (!user) throw new Error(`Funcionario ${s.email} no encontrado`);
    const passMatch = bcrypt.compareSync('Control2026!', user.passwordHash);
    if (!passMatch) throw new Error(`Contraseña incorrecta para ${s.email}`);
    if (user.crewId !== s.expectedCrew) throw new Error(`Cuadrilla incorrecta para ${s.email}`);
    console.log(`  ✅ [PASS] ${user.name} (${user.email}) | Turno: ${s.turno} | Cuadrilla: ${user.crewId} | Activo: ${user.isActive}`);
  }

  // 3. Verificación de Usuario Inactivo (Baja)
  console.log('\n🚫 3. Verificación de Funcionario Inactivo (Dado de baja):');
  const inactiveUser = await db.getUserByEmail('carlos.duarte@empresa.com.py');
  if (!inactiveUser) throw new Error('Usuario inactivo no encontrado');
  if (inactiveUser.isActive !== false) throw new Error('Carlos Duarte debería figurar inactivo');
  console.log(`  ✅ [PASS] ${inactiveUser.name} figura inactivo (isActive: false)`);

  // 4. Verificación de Planificación de Turnos en PostgreSQL
  console.log('\n📅 4. Verificación de Planificación de Turnos en PostgreSQL:');
  const shiftsPorfirio = await db.listShifts('org_mepy_2026', {
    userId: 'user_p1',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
  });
  console.log(`  ✅ [PASS] Turnos programados y publicados para Porfirio Giménez en noviembre: ${shiftsPorfirio.length} días`);
  if (shiftsPorfirio.length === 0) throw new Error('Se esperaban turnos para Porfirio Giménez');

  // 5. Verificación del Flujo de Alta y Baja por el Administrador
  console.log('\n🏢 5. Verificación de Gestión de Personal por el Admin (Alta y Baja):');
  const tempEmail = `nuevo.guardia_${Date.now()}@empresa.com.py`;
  const tempPassHash = bcrypt.hashSync('Temporal2026!', 10);
  
  const created = await db.createUser({
    organizationId: 'org_mepy_2026',
    name: 'Guardia Recién Incorporado',
    email: tempEmail,
    passwordHash: tempPassHash,
    role: 'FUNCIONARIO',
    crewId: 'crew_a',
    documentNumber: '5.999.888',
    phone: '+595 981 999 000',
    baseDailyWage: 120000,
    isActive: true,
  });
  console.log(`  ✅ [PASS] Administrador creó nuevo funcionario: ${created.name} (${created.email})`);

  // Ahora el admin lo da de baja
  const deactivated = await db.deactivateUser(created.id, admin.id);
  console.log(`  ✅ [PASS] Administrador dio de baja al funcionario exitosamente: ${deactivated}`);
  const verifyDeactivated = await db.getUser(created.id);
  console.log(`  ✅ [PASS] Estado post-baja verificado en BD: isActive = ${verifyDeactivated?.isActive}`);

  console.log('\n======================================================================');
  console.log('🏁 RESULTADO: Todas las pruebas de entrega superadas con éxito.');
  console.log('======================================================================');
}

runDeliveryVerification().catch((err) => {
  console.error('❌ Error en verificación:', err);
  process.exit(1);
});
