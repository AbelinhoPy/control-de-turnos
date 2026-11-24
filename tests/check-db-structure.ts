import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const env = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const sql = neon(match![1]);

async function run() {
  const orgs = await sql`SELECT id, name FROM organizations`;
  console.log('Organizations:', orgs);
  const crews = await sql`SELECT id, name, code, type FROM crews`;
  console.log('Crews:', crews);
  const shifts = await sql`SELECT id, code, name FROM shift_templates`;
  console.log('Shifts:', shifts);
}

run().catch(console.error);
