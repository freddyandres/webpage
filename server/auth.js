'use strict';
/**
 * Autenticación de administradores.
 * - Contraseñas con scrypt + sal aleatoria (nunca en texto plano).
 * - Sesiones con token aleatorio; en la base solo se guarda su hash SHA-256.
 * - Bloqueo temporal tras varios intentos fallidos.
 */
const crypto = require('node:crypto');
const db = require('./db');
const config = require('./config');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const MIN_PASSWORD_LENGTH = 10;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p),
    });
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
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function createAdmin({ username, fullName, password, role = 'admin' }) {
  const problem = validatePasswordStrength(password);
  if (problem) throw new Error(problem);
  if (!/^[a-z0-9._-]{3,40}$/i.test(username)) throw new Error('Usuario inválido (3-40 letras, números, punto o guion).');
  if (!['admin', 'lector'].includes(role)) throw new Error('Rol inválido.');
  const d = db.get();
  const existing = d.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    d.prepare('UPDATE admins SET full_name = ?, role = ?, password_hash = ?, active = 1 WHERE id = ?')
      .run(fullName, role, hashPassword(password), existing.id);
    d.prepare('DELETE FROM sessions WHERE admin_id = ?').run(existing.id);
    return { id: existing.id, updated: true };
  }
  const r = d.prepare('INSERT INTO admins (username, full_name, role, password_hash) VALUES (?, ?, ?, ?)')
    .run(username, fullName, role, hashPassword(password));
  return { id: Number(r.lastInsertRowid), updated: false };
}

function changePassword(adminId, currentPassword, newPassword) {
  const d = db.get();
  const admin = d.prepare('SELECT password_hash FROM admins WHERE id = ?').get(adminId);
  if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
    return 'La contraseña actual no es correcta.';
  }
  const problem = validatePasswordStrength(newPassword);
  if (problem) return problem;
  d.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), adminId);
  return null;
}

/* ---------- Bloqueo por intentos fallidos ---------- */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map(); // clave -> { count, first, lockedUntil }

function attemptKey(username, ip) {
  return `${String(username).toLowerCase()}|${ip}`;
}

function isLocked(key) {
  const a = attempts.get(key);
  return a && a.lockedUntil && a.lockedUntil > Date.now() ? a.lockedUntil : 0;
}

function registerFailure(key) {
  const now = Date.now();
  const a = attempts.get(key) || { count: 0, first: now, lockedUntil: 0 };
  if (now - a.first > LOCK_MS) { a.count = 0; a.first = now; }
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) { a.lockedUntil = now + LOCK_MS; a.count = 0; a.first = now; }
  attempts.set(key, a);
}

/** Devuelve { admin, token } si las credenciales son correctas, o { error, status }. */
function login(username, password, ip) {
  const key = attemptKey(username, ip);
  const lockedUntil = isLocked(key);
  if (lockedUntil) {
    const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return { status: 429, error: `Demasiados intentos. Intenta de nuevo en ${minutes} minuto(s).` };
  }
  const d = db.get();
  const admin = d.prepare('SELECT * FROM admins WHERE username = ? AND active = 1').get(String(username || ''));
  const ok = verifyPassword(String(password || ''), admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !ok) {
    registerFailure(key);
    return { status: 401, error: 'Usuario o contraseña incorrectos.' };
  }
  attempts.delete(key);
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + config.sessionHours * 3600 * 1000;
  d.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  d.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), admin.id, expires);
  d.prepare("UPDATE admins SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(admin.id);
  return { admin: publicAdmin(admin), token, expires };
}

function logout(token) {
  if (token) db.get().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function sessionAdmin(token) {
  if (!token) return null;
  const row = db.get().prepare(`
    SELECT a.* , s.expires_at FROM sessions s JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND a.active = 1`).get(sha256(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    logout(token);
    return null;
  }
  return publicAdmin(row);
}

function publicAdmin(a) {
  return { id: a.id, username: a.username, fullName: a.full_name, role: a.role };
}

function sha256(v) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

/**
 * Permite crear las cuentas iniciales desde variables de entorno
 * (útil en servicios de hosting sin consola). Solo crea la cuenta si no existe;
 * nunca sobrescribe una contraseña ya establecida.
 */
function bootstrapFromEnv() {
  const seeds = [
    { env: 'ADMIN_SAMANTHA_PASSWORD', username: process.env.ADMIN_SAMANTHA_USER || 'samantha', fullName: 'Samantha Castillo Cano' },
    { env: 'ADMIN_ANGEL_PASSWORD', username: process.env.ADMIN_ANGEL_USER || 'angel', fullName: 'Ángel Esteban Cano Narváez' },
  ];
  const d = db.get();
  for (const s of seeds) {
    const pwd = process.env[s.env];
    if (!pwd) continue;
    if (d.prepare('SELECT 1 FROM admins WHERE username = ?').get(s.username)) continue;
    try {
      createAdmin({ username: s.username, fullName: s.fullName, password: pwd, role: 'admin' });
      console.log(`[admin] Cuenta "${s.username}" creada a partir de ${s.env}.`);
    } catch (err) {
      console.error(`[admin] No se pudo crear "${s.username}": ${err.message}`);
    }
  }
}

module.exports = {
  hashPassword, verifyPassword, validatePasswordStrength, createAdmin, changePassword,
  login, logout, sessionAdmin, bootstrapFromEnv, MIN_PASSWORD_LENGTH,
  _resetAttempts: () => attempts.clear(),
};
