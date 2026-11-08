'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patita-test-'));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = 'test';
process.env.PATITA_MEMORY_DB = 'true';
delete process.env.DATABASE_URL;

const { createServer, ready } = require('../server/index');
const auth = require('../server/auth');
const db = require('../server/db');

let server;
let base;

const valid = (over = {}) => ({
  fullName: 'María Fernanda López', documentNumber: '', phone: '300 123 4567', email: 'maria@example.com', neighborhood: 'Brisas de los Álamos',
  businessName: 'Patitas Felices', managerName: 'María Fernanda López', category: 'comida', productsDescription: 'Galletas y tortas caseras',
  socialMedia: '@patitasfelices', productsToBring: 'Galletas y tortas', spaceNeeded: 'una_mesa', needsTable: 'si', bringsOwnTable: 'no',
  needsPower: 'no', specialRequest: '', acceptTerms: true, acceptData: true, acceptTruth: true, acceptFee: true, ...over,
});

const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  await ready();
  await auth.createAdmin({ username: 'samantha', fullName: 'Samantha Castillo Cano', password: 'ClaveSegura123' });
  await auth.createAdmin({ username: auth.SHARED_USERNAME, fullName: auth.SHARED_FULL_NAME, password: 'ClaveCompartida2026' });
  await auth.createAdmin({ username: 'lector', fullName: 'Solo Lectura', password: 'ClaveLectura123', role: 'lector' });
});

after(async () => {
  server.close();
  await db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function login(username = 'samantha', password = 'ClaveSegura123') {
  const r = await post('/api/admin/login', { username, password });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('la página pública y la configuración cargan', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Unidos por amor, movidos por la esperanza/);
  assert.ok(home.headers.get('content-security-policy'));
  const cfg = await (await fetch(base + '/api/public/config')).json();
  assert.equal(cfg.categories.length, 9);
  assert.equal(cfg.feeCop, 10000);
});

test('valida campos obligatorios con mensajes claros', async () => {
  const r = await post('/api/registrations', valid({ fullName: '', phone: '123', acceptFee: false, category: 'xx' }));
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.ok(body.fields.fullName);
  assert.ok(body.fields.phone);
  assert.ok(body.fields.acceptFee);
  assert.ok(body.fields.category);
});

test('numeración consecutiva, única y sin duplicados por reenvío', async () => {
  const a = await (await post('/api/registrations', valid({ idempotencyKey: 'aaaaaaaaaaaaaaaaaaaa' }))).json();
  const again = await (await post('/api/registrations', valid({ idempotencyKey: 'aaaaaaaaaaaaaaaaaaaa' }))).json();
  const b = await (await post('/api/registrations', valid({ businessName: 'Otro', phone: '3109876543' }))).json();
  assert.equal(a.code, 'UPP-001');
  assert.equal(again.code, 'UPP-001');
  assert.equal(b.code, 'UPP-002');
  assert.equal(a.status, 'pendiente');
});

test('consulta pública exige número y celular correctos', async () => {
  const ok = await post('/api/registrations/lookup', { code: 'upp-001', phone: '3001234567' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).status, 'pendiente');
  const bad = await post('/api/registrations/lookup', { code: 'UPP-001', phone: '3000000000' });
  assert.equal(bad.status, 404);
});

test('el panel exige inicio de sesión', async () => {
  assert.equal((await fetch(base + '/api/admin/registrations')).status, 401);
  assert.equal((await post('/api/admin/login', { username: 'samantha', password: 'incorrecta1' })).status, 401);
});

test('administración: listar, buscar, aprobar, pagar, estadísticas y exportar', async () => {
  const cookie = await login();
  const h = { cookie };
  const list = await (await fetch(base + '/api/admin/registrations?q=UPP-002', { headers: h })).json();
  assert.equal(list.items.length, 1);
  const id = list.items[0].id;

  const patch = await fetch(`${base}/api/admin/registrations/${id}`, {
    method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'aprobada', paymentReceived: true }),
  });
  assert.equal(patch.status, 200);
  const updated = await patch.json();
  assert.equal(updated.status, 'aprobada');
  assert.equal(updated.reviewedBy, 'Samantha Castillo Cano');
  assert.ok(updated.history.length >= 2);

  const stats = await (await fetch(base + '/api/admin/stats', { headers: h })).json();
  assert.equal(stats.total, 2);
  assert.equal(stats.approved, 1);
  assert.equal(stats.collectedCop, 10000);

  const csv = await fetch(base + '/api/admin/export.csv', { headers: h });
  assert.match(await csv.text(), /UPP-002/);
  const xlsx = await fetch(base + '/api/admin/export.xlsx', { headers: h });
  const buf = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), 'PK');
});

test('el límite de puestos impide aprobar de más', async () => {
  const cookie = await login();
  const h = { cookie, 'Content-Type': 'application/json' };
  await fetch(base + '/api/admin/settings', { method: 'PUT', headers: h, body: JSON.stringify({ maxStalls: '1' }) });
  const list = await (await fetch(base + '/api/admin/registrations?status=pendiente', { headers: h })).json();
  const r = await fetch(`${base}/api/admin/registrations/${list.items[0].id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'aprobada' }) });
  assert.equal(r.status, 409);
  await fetch(base + '/api/admin/settings', { method: 'PUT', headers: h, body: JSON.stringify({ maxStalls: '' }) });
});

test('el rol lector no puede modificar', async () => {
  const cookie = await login('lector', 'ClaveLectura123');
  const r = await fetch(`${base}/api/admin/registrations/1`, {
    method: 'PATCH', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rechazada' }),
  });
  assert.equal(r.status, 403);
});

test('bloquea peticiones desde otro origen', async () => {
  const r = await post('/api/registrations', valid(), { Origin: 'https://sitio-malicioso.example' });
  assert.equal(r.status, 403);
});

test('la fotografía se guarda y solo la ve un administrador', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const r = await (await post('/api/registrations', valid({ phone: '3201112233', photo: png }))).json();
  const cookie = await login();
  const list = await (await fetch(`${base}/api/admin/registrations?q=${r.code}`, { headers: { cookie } })).json();
  const url = `${base}/api/admin/registrations/${list.items[0].id}/photo`;
  assert.equal((await fetch(url)).status, 401);
  const img = await fetch(url, { headers: { cookie } });
  assert.equal(img.headers.get('content-type'), 'image/png');
});

test('bloqueo tras 5 intentos fallidos', async () => {
  for (let i = 0; i < 5; i++) await post('/api/admin/login', { username: 'lector', password: 'malmalmal1' });
  const r = await post('/api/admin/login', { username: 'lector', password: 'ClaveLectura123' });
  assert.equal(r.status, 429);
});

test('se ingresa al panel solo con la clave compartida', async () => {
  assert.equal((await post('/api/admin/login', { password: 'otra-clave-1' })).status, 401);
  const r = await post('/api/admin/login', { password: 'ClaveCompartida2026' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).admin.fullName, 'Organizadores (Samantha y Ángel)');
});

test('las contraseñas se guardan cifradas', async () => {
  const row = await db.one("SELECT password_hash FROM patita.admins WHERE username = 'samantha'");
  assert.match(row.password_hash, /^scrypt\$/);
  assert.ok(!row.password_hash.includes('ClaveSegura123'));
});
