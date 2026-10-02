import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://tcm:tcm@localhost:5432/tcm',
});

export async function migrate(): Promise<void> {
  const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}
