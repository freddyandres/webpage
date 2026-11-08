'use strict';
/**
 * Autenticación de administradores.
 * - Contraseñas con scrypt + sal aleatoria (nunca en texto plano).
 * - Sesiones con token aleatorio; en la base solo se guarda su hash SHA-256.
 * - Bloqueo temporal tras varios intentos fallidos (guardado en la base de datos).
 */
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const db = require('./db');
const config = require('./config');

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MIN_PASSWORD_LENGTH = 10;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) return 'La contraseña es demasiado larga.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe combinar letras y números.';
  }
  return null;
}

// Hash ficticio para que un usuario inexistente tarde lo mismo que uno real.
let dummyHash;
const getDummyHash = async () => (dummyHash ||= await hashPassword(crypto.randomBytes(16).toString('hex')));

async function createAdmin({ username, fullName, password, role = 'admin' }) {
  const problem = validatePasswordStrength(password);
  if (problem) throw new Error(problem);
  if (!/^[a-z0-9._-]{3,40}$/i.test(username)) throw new Error('Usuario inválido (3-40 letras, números, punto o guion).');
  if (!['admin', 'lector'].includes(role)) throw new Error('Rol inválido.');
  const hash = await hashPassword(password);
  const existing = await db.one('SELECT id FROM patita.admins WHERE lower(username) = lower($1)', [username]);
  if (existing) {
    await db.query('UPDATE patita.admins SET full_name = $1, role = $2, password_hash = $3, active = true WHERE id = $4', [fullName, role, hash, existing.id]);
    await db.query('DELETE FROM patita.sessions WHERE admin_id = $1', [existing.id]);
    return { id: Number(existing.id), updated: true };
  }
  const r = await db.one('INSERT INTO patita.admins (username, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
    [username, fullName, role, hash]);
  return { id: Number(r.id), updated: false };
}

async function changePassword(adminId, currentPassword, newPassword) {
  const admin = await db.one('SELECT password_hash FROM patita.admins WHERE id = $1', [adminId]);
  if (!admin || !(await verifyPassword(currentPassword, admin.password_hash))) return 'La clave actual no es correcta.';
  const problem = validatePasswordStrength(newPassword);
  if (problem) return problem;
  await db.query('UPDATE patita.admins SET password_hash = $1 WHERE id = $2', [await hashPassword(newPassword), adminId]);
  return null;
}

/* ---------- Bloqueo por intentos fallidos ---------- */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const bucketFor = (username, ip) => `login|${crypto.createHash('sha256').update(`${String(username).toLowerCase()}|${ip}`).digest('hex')}`;

/** Cuenta compartida de los organizadores: se ingresa solo con la clave. */
const SHARED_USERNAME = 'organizadores';
const SHARED_FULL_NAME = 'Organizadores (Samantha y Ángel)';

/** Devuelve { admin, token } si las credenciales son correctas, o { error, status }. */
async function login(username, password, ip) {
  if (!username) username = SHARED_USERNAME;
  const bucket = bucketFor(username, ip);
  const recent = await db.one(`SELECT count(*)::int AS n, max(at) AS last FROM patita.rate_events
    WHERE bucket = $1 AND at > now() - make_interval(mins => $2)`, [bucket, LOCK_MINUTES]);
  if (recent.n >= MAX_ATTEMPTS) {
    const minutes = Math.max(1, Math.ceil((new Date(recent.last).getTime() + LOCK_MINUTES * 60000 - Date.now()) / 60000));
    return { status: 429, error: `Demasiados intentos. Intenta de nuevo en ${minutes} minuto(s).` };
  }
  const admin = await db.one('SELECT * FROM patita.admins WHERE lower(username) = lower($1) AND active', [String(username || '')]);
  const ok = await verifyPassword(String(password || ''), admin ? admin.password_hash : await getDummyHash());
  if (!admin || !ok) {
    await db.query('INSERT INTO patita.rate_events (bucket) VALUES ($1)', [bucket]);
    return { status: 401, error: 'La clave no es correcta.' };
  }
  await db.query('DELETE FROM patita.rate_events WHERE bucket = $1', [bucket]);
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionHours * 3600 * 1000);
  await db.query('DELETE FROM patita.sessions WHERE expires_at < now()');
  await db.query('INSERT INTO patita.sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), admin.id, expires]);
  await db.query('UPDATE patita.admins SET last_login_at = now() WHERE id = $1', [admin.id]);
  return { admin: publicAdmin(admin), token, expires };
}

async function logout(token) {
  if (token) await db.query('DELETE FROM patita.sessions WHERE token_hash = $1', [sha256(token)]);
}

async function sessionAdmin(token) {
  if (!token) return null;
  const row = await db.one(`SELECT a.* FROM patita.sessions s JOIN patita.admins a ON a.id = s.admin_id
    WHERE s.token_hash = $1 AND a.active AND s.expires_at > now()`, [sha256(token)]);
  return row ? publicAdmin(row) : null;
}

function publicAdmin(a) {
  return { id: Number(a.id), username: a.username, fullName: a.full_name, role: a.role };
}

function sha256(v) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

/**
 * Crea las cuentas iniciales desde variables de entorno (útil en Vercel, que no tiene consola).
 * Solo crea la cuenta si no existe; nunca sobrescribe una contraseña ya establecida.
 */
async function bootstrapFromEnv() {
  const seeds = [
    { env: 'ADMIN_SHARED_PASSWORD', username: SHARED_USERNAME, fullName: SHARED_FULL_NAME },
    { env: 'ADMIN_SAMANTHA_PASSWORD', username: process.env.ADMIN_SAMANTHA_USER || 'samantha', fullName: 'Samantha Castillo Cano' },
    { env: 'ADMIN_ANGEL_PASSWORD', username: process.env.ADMIN_ANGEL_USER || 'angel', fullName: 'Ángel Esteban Cano Narváez' },
  ];
  for (const s of seeds) {
    const pwd = process.env[s.env];
    if (!pwd) continue;
    try {
      if (await db.one('SELECT 1 FROM patita.admins WHERE lower(username) = lower($1)', [s.username])) continue;
      await createAdmin({ username: s.username, fullName: s.fullName, password: pwd, role: 'admin' });
      console.log(`[admin] Cuenta "${s.username}" creada a partir de ${s.env}.`);
    } catch (err) {
      console.error(`[admin] No se pudo crear "${s.username}": ${err.message}`);
    }
  }
}

module.exports = {
  hashPassword, verifyPassword, validatePasswordStrength, createAdmin, changePassword,
  login, logout, sessionAdmin, bootstrapFromEnv, MIN_PASSWORD_LENGTH, SHARED_USERNAME, SHARED_FULL_NAME,
};
