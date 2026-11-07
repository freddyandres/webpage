'use strict';
/**
 * Servidor de «Unidos por una Patita».
 * Sirve la página pública (/), el panel privado (/admin) y la API (/api).
 * Sin dependencias externas: solo módulos integrados de Node.js (>= 22.13).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const settings = require('./settings');
const registrations = require('./registrations');
const { validateRegistration, decodeImage, clean } = require('./validate');
const { CATEGORIES, SPACE_OPTIONS, STATUSES } = require('./catalog');
const { buildXlsx, buildCsv } = require('./xlsx');

const CONTACT = { phoneDisplay: '314 804 8114', phone: '3148048114', whatsapp: '573148048114' };
const SESSION_COOKIE = 'upp_admin';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/* ---------------- utilidades HTTP ---------------- */
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function clientIp(req) {
  if (config.trustProxy) {
    const xf = req.headers['x-forwarded-for'];
    if (xf) return String(xf).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'desconocida';
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(value, maxAgeSeconds) {
  return [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`, config.secureCookies ? 'Secure' : null]
    .filter(Boolean).join('; ');
}

function readJson(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '');
    if (!type.startsWith('application/json')) return reject(new HttpError(415, 'Se esperaba información en formato JSON.'));
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'La información enviada es demasiado grande. Si adjuntaste una fotografía, prueba con una más liviana.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new HttpError(400, 'La información enviada no es válida.')); }
    });
    req.on('error', reject);
  });
}

/** Bloquea peticiones que cambian datos si vienen de otro sitio web (protección CSRF). */
function checkSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  try {
    if (new URL(origin).host !== req.headers.host) throw new Error();
  } catch {
    throw new HttpError(403, 'Origen no permitido.');
  }
}

/* --------- límite de peticiones por IP (formularios públicos) --------- */
const buckets = new Map();
function rateLimit(name, ip, max, windowMs) {
  const key = `${name}|${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) { buckets.set(key, { start: now, count: 1 }); return; }
  b.count += 1;
  if (b.count > max) throw new HttpError(429, 'Has realizado muchas solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.');
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.start > 3600_000) buckets.delete(k);
}, 600_000).unref();

/* ---------------- archivos estáticos ---------------- */
function serveFile(req, res, filePath, { cache = 'public, max-age=300', extraHeaders = {} } = {}) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return notFound(req, res);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache, ...extraHeaders });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

function safeJoin(base, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const p = path.normalize(path.join(base, decoded));
  return p === base || p.startsWith(base + path.sep) ? p : null;
}

function notFound(req, res) {
  if (req.url.startsWith('/api/')) return sendJson(res, 404, { error: 'No encontrado.' });
  const page = path.join(config.publicDir, '404.html');
  fs.readFile(page, (err, html) => {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(err ? 'Página no encontrada' : html);
  });
}

/* ---------------- API ---------------- */
function requireAdmin(req, { write = false } = {}) {
  const admin = auth.sessionAdmin(parseCookies(req)[SESSION_COOKIE]);
  if (!admin) throw new HttpError(401, 'Tu sesión expiró o no has iniciado sesión.');
  if (write && admin.role !== 'admin') throw new HttpError(403, 'Tu cuenta solo tiene permisos de consulta.');
  return admin;
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;
  const ip = clientIp(req);
  if (method !== 'GET' && method !== 'HEAD') checkSameOrigin(req);

  /* ---- Público ---- */
  if (pathname === '/api/public/config' && method === 'GET') {
    return sendJson(res, 200, {
      categories: CATEGORIES, spaceOptions: SPACE_OPTIONS, feeCop: config.feeCop, contact: CONTACT, ...settings.publicView(),
    });
  }

  if (pathname === '/api/registrations' && method === 'POST') {
    rateLimit('registro', ip, 8, 10 * 60_000);
    const body = await readJson(req, 4 * 1024 * 1024);
    if (clean(body.website)) return sendJson(res, 201, { code: 'UPP-000', status: 'pendiente' }); // trampa anti-spam
    const { data, errors } = validateRegistration(body);
    if (errors) return sendJson(res, 422, { error: 'Revisa los campos marcados.', fields: errors });
    const photo = decodeImage(body.photo, 3 * 1024 * 1024);
    if (photo.error) return sendJson(res, 422, { error: photo.error, fields: { photo: photo.error } });
    const result = registrations.create(data, photo.none ? null : photo);
    return sendJson(res, 201, { code: result.code, status: result.status, statusLabel: 'Solicitud recibida, pendiente de revisión' });
  }

  if (pathname === '/api/registrations/lookup' && method === 'POST') {
    rateLimit('consulta', ip, 15, 10 * 60_000);
    const body = await readJson(req, 4096);
    const code = clean(body.code).toUpperCase().replace(/\s/g, '');
    const phone = clean(body.phone).replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    if (!/^UPP-\d{3,}$/.test(code) || !/^3\d{9}$/.test(phone)) {
      return sendJson(res, 422, { error: 'Escribe tu número de inscripción (por ejemplo UPP-001) y el celular con el que te inscribiste.' });
    }
    const found = registrations.publicLookup(code, phone);
    if (!found) return sendJson(res, 404, { error: 'No encontramos una inscripción con ese número y celular. Revisa los datos.' });
    return sendJson(res, 200, found);
  }

  /* ---- Administración ---- */
  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await readJson(req, 4096);
    const result = auth.login(clean(body.username), typeof body.password === 'string' ? body.password : '', ip);
    if (result.error) return sendJson(res, result.status, { error: result.error });
    res.setHeader('Set-Cookie', sessionCookie(result.token, config.sessionHours * 3600));
    return sendJson(res, 200, { admin: result.admin });
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    auth.logout(parseCookies(req)[SESSION_COOKIE]);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return sendJson(res, 200, { ok: true });
  }

  if (!pathname.startsWith('/api/admin/')) throw new HttpError(404, 'No encontrado.');
  const isWrite = !['GET', 'HEAD'].includes(method);
  const admin = requireAdmin(req, { write: isWrite && pathname !== '/api/admin/password' });

  if (pathname === '/api/admin/me' && method === 'GET') {
    return sendJson(res, 200, { admin, catalog: { categories: CATEGORIES, statuses: STATUSES, spaceOptions: SPACE_OPTIONS } });
  }

  if (pathname === '/api/admin/stats' && method === 'GET') return sendJson(res, 200, registrations.stats());

  if (pathname === '/api/admin/registrations' && method === 'GET') {
    const p = url.searchParams;
    return sendJson(res, 200, { items: registrations.list({ q: p.get('q'), category: p.get('category'), status: p.get('status') }) });
  }

  let m = /^\/api\/admin\/registrations\/(\d+)$/.exec(pathname);
  if (m && method === 'GET') {
    const item = registrations.getById(m[1]);
    return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: 'Inscripción no encontrada.' });
  }
  if (m && method === 'PATCH') {
    const body = await readJson(req, 16 * 1024);
    const changes = {};
    if ('status' in body) changes.status = String(body.status);
    if ('paymentReceived' in body) changes.paymentReceived = body.paymentReceived === true;
    if ('adminNotes' in body) changes.adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : '';
    const r = registrations.update(m[1], changes, admin);
    if (r.notFound) return sendJson(res, 404, { error: 'Inscripción no encontrada.' });
    if (r.error) return sendJson(res, 409, { error: r.error });
    return sendJson(res, 200, registrations.getById(m[1]));
  }

  m = /^\/api\/admin\/registrations\/(\d+)\/photo$/.exec(pathname);
  if (m && method === 'GET') {
    const p = registrations.photoPath(m[1]);
    if (!p) return sendJson(res, 404, { error: 'Sin fotografía.' });
    return serveFile(req, res, p, { cache: 'private, no-store' });
  }

  if ((pathname === '/api/admin/export.csv' || pathname === '/api/admin/export.xlsx') && method === 'GET') {
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = registrations.exportRows();
    if (pathname.endsWith('.csv')) {
      const csv = buildCsv(registrations.EXPORT_HEADERS, rows);
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="inscripciones-unidos-por-una-patita-${stamp}.csv"` });
      return res.end(csv);
    }
    const xlsx = buildXlsx('Inscripciones', registrations.EXPORT_HEADERS, rows);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="inscripciones-unidos-por-una-patita-${stamp}.xlsx"`, 'Content-Length': xlsx.length,
    });
    return res.end(xlsx);
  }

  if (pathname === '/api/admin/settings' && method === 'GET') return sendJson(res, 200, settings.adminView());
  if (pathname === '/api/admin/settings' && method === 'PUT') {
    const err = settings.updateFromAdmin(await readJson(req, 16 * 1024));
    if (err) return sendJson(res, 422, { error: err });
    return sendJson(res, 200, settings.adminView());
  }
  if (pathname === '/api/admin/settings/luna-photo' && method === 'POST') {
    const body = await readJson(req, 8 * 1024 * 1024);
    const img = decodeImage(body.photo, 6 * 1024 * 1024);
    if (img.none || img.error) return sendJson(res, 422, { error: img.error || 'Selecciona una fotografía.' });
    settings.setLunaPhoto(img.buf, img.ext);
    return sendJson(res, 200, settings.adminView());
  }
  if (pathname === '/api/admin/settings/luna-photo' && method === 'DELETE') {
    settings.removeLunaPhoto();
    return sendJson(res, 200, settings.adminView());
  }

  if (pathname === '/api/admin/password' && method === 'POST') {
    const body = await readJson(req, 4096);
    const err = auth.changePassword(admin.id, String(body.currentPassword || ''), String(body.newPassword || ''));
    if (err) return sendJson(res, 422, { error: err });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/admin/admins' && method === 'GET') {
    const items = db.get().prepare('SELECT username, full_name AS fullName, role, last_login_at AS lastLoginAt FROM admins WHERE active = 1 ORDER BY id').all();
    return sendJson(res, 200, { items });
  }

  throw new HttpError(404, 'No encontrado.');
}

/* ---------------- enrutador principal ---------------- */
async function handler(req, res) {
  securityHeaders(res);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
  const { pathname } = url;

  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, url);

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }

    if (pathname.startsWith('/media/')) {
      const name = path.basename(decodeURIComponent(pathname.slice(7)));
      if (!/^luna-\d+\.(jpg|png|webp)$/.test(name)) return notFound(req, res);
      return serveFile(req, res, path.join(config.mediaDir, name), { cache: 'public, max-age=86400' });
    }

    if (pathname === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
    if (pathname.startsWith('/admin/')) {
      const rel = pathname === '/admin/' ? 'index.html' : pathname.slice(7);
      const file = safeJoin(config.adminDir, rel);
      if (!file) return notFound(req, res);
      return serveFile(req, res, file, { cache: 'no-cache', extraHeaders: { 'X-Robots-Tag': 'noindex, nofollow' } });
    }

    const rel = pathname === '/' ? 'index.html' : pathname;
    const file = safeJoin(config.publicDir, rel);
    if (!file) return notFound(req, res);
    const cache = /\.(html)$/.test(file) ? 'no-cache' : 'public, max-age=3600';
    return serveFile(req, res, file, { cache });
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    return sendJson(res, 500, { error: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.' });
  }
}

function createServer() {
  db.open();
  auth.bootstrapFromEnv();
  return http.createServer(handler);
}

if (require.main === module) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`🐾 Unidos por una Patita escuchando en http://localhost:${config.port}`);
    console.log(`   Panel administrativo: http://localhost:${config.port}/admin/`);
    const count = db.get().prepare('SELECT COUNT(*) AS n FROM admins').get().n;
    if (!count) console.log('   ⚠️  Aún no hay administradores. Crea uno con: npm run admin:create');
  });
  const shutdown = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createServer };
