import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const env = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
if (!match) {
  console.error('No DATABASE_URL found in .env.local');
  process.exit(1);
}

const sql = neon(match[1]);

import * as bcrypt from 'bcryptjs';

async function check() {
  const users = await sql`SELECT id, name, email, role, is_active, crew_id, base_daily_wage, password_hash FROM users ORDER BY role, name`;
  console.log(`Found ${users.length} users in database:`);
  for (const u of users) {
    const matchesControl = u.password_hash?.startsWith('$2') ? bcrypt.compareSync('Control2026!', u.password_hash) : false;
    console.log(`- ${u.name} | ${u.email} | Role: ${u.role} | Active: ${u.is_active} | Crew: ${u.crew_id} | Matches Control2026!: ${matchesControl}`);
  }
}

check().catch(console.error);
