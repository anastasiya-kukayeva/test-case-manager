import { nanoid } from 'nanoid';
import { pool } from './db.js';

export type DirectoryPayload = {
  people: { id: string; role: string; name: string; isDefault?: boolean }[];
  applications: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  environments: { id: string; name: string; isDefault?: boolean }[];
};

export async function loadDirectory(): Promise<DirectoryPayload> {
  const [people, applications, modules, environments] = await Promise.all([
    pool.query<{ id: string; role: string; name: string; is_default: boolean }>(
      'SELECT id, role, name, is_default FROM directory_people ORDER BY name',
    ),
    pool.query<{ id: string; name: string }>('SELECT id, name FROM directory_applications ORDER BY name'),
    pool.query<{ id: string; name: string }>('SELECT id, name FROM directory_modules ORDER BY name'),
    pool.query<{ id: string; name: string; is_default: boolean }>(
      'SELECT id, name, is_default FROM directory_environments ORDER BY name',
    ),
  ]);
  return {
    people: people.rows.map((row) => ({
      id: row.id,
      role: row.role,
      name: row.name,
      isDefault: row.is_default || undefined,
    })),
    applications: applications.rows,
    modules: modules.rows,
    environments: environments.rows.map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: row.is_default || undefined,
    })),
  };
}

export async function saveDirectory(payload: DirectoryPayload): Promise<DirectoryPayload> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM directory_people');
    await client.query('DELETE FROM directory_applications');
    await client.query('DELETE FROM directory_modules');
    await client.query('DELETE FROM directory_environments');
    for (const person of payload.people) {
      await client.query(
        'INSERT INTO directory_people (id, role, name, is_default) VALUES ($1,$2,$3,$4)',
        [person.id || nanoid(), person.role, person.name, Boolean(person.isDefault)],
      );
    }
    for (const item of payload.applications) {
      await client.query('INSERT INTO directory_applications (id, name) VALUES ($1,$2)', [
        item.id || nanoid(),
        item.name,
      ]);
    }
    for (const item of payload.modules) {
      await client.query('INSERT INTO directory_modules (id, name) VALUES ($1,$2)', [
        item.id || nanoid(),
        item.name,
      ]);
    }
    for (const item of payload.environments) {
      await client.query(
        'INSERT INTO directory_environments (id, name, is_default) VALUES ($1,$2,$3)',
        [item.id || nanoid(), item.name, Boolean(item.isDefault)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return loadDirectory();
}
