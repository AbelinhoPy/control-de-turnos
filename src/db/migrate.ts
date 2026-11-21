// src/db/migrate.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno si existen archivos locales
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

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes('YOUR_SECRET_PASSWORD')) {
    console.error('❌ Error: DATABASE_URL no está configurada o contiene valores de ejemplo en .env');
    process.exit(1);
  }

  console.log('⚡ Conectando a Neon Postgres para aplicar migraciones versionadas...');
  const sql = neon(connectionString);
  const db = drizzle(sql);

  console.log('📦 Aplicando migraciones desde ./drizzle ...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migraciones aplicadas exitosamente en Neon Postgres.');
}

runMigrations().catch((err) => {
  console.error('❌ Error ejecutando migraciones:', err);
  process.exit(1);
});
