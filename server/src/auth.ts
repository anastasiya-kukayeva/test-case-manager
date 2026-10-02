import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { nanoid } from 'nanoid';
import { pool } from './db.js';
import { hashPassword, verifyPassword } from './password.js';

export type SessionUser = {
  id: string;
  login: string;
  role: 'admin' | 'editor';
};

const COOKIE = 'tcm_session';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readCookie(req: IncomingMessage): string | null {
  const raw = req.headers.cookie ?? '';
  const part = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`));
  if (!part) {
    return null;
  }
  return decodeURIComponent(part.slice(COOKIE.length + 1));
}

export function setSessionCookie(res: ServerResponse, token: string): void {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${WEEK_MS / 1000}${secure}`,
  );
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export async function ensureAdmin(): Promise<void> {
  const existing = await pool.query('SELECT id FROM users LIMIT 1');
  if (existing.rowCount) {
    return;
  }
  const login = process.env.ADMIN_LOGIN ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';
  await pool.query(
    'INSERT INTO users (id, login, password_hash, role) VALUES ($1, $2, $3, $4)',
    [nanoid(), login, hashPassword(password), 'admin'],
  );
  console.log(`[auth] создан администратор «${login}»`);
}

export async function login(loginName: string, password: string): Promise<string | null> {
  const result = await pool.query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE login = $1',
    [loginName],
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) {
    return null;
  }
  const token = randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [nanoid(), row.id, tokenHash(token), new Date(Date.now() + WEEK_MS)],
  );
  return token;
}

export async function logout(token: string | null): Promise<void> {
  if (!token) {
    return;
  }
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}

export async function userFromRequest(req: IncomingMessage): Promise<SessionUser | null> {
  const token = readCookie(req);
  if (!token) {
    return null;
  }
  const result = await pool.query<SessionUser>(
    `SELECT u.id, u.login, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)],
  );
  return result.rows[0] ?? null;
}

export async function changePassword(userId: string, current: string, next: string): Promise<boolean> {
  const result = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId],
  );
  const row = result.rows[0];
  if (!row || !verifyPassword(current, row.password_hash)) {
    return false;
  }
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(next), userId]);
  return true;
}
