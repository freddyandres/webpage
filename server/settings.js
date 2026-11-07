'use strict';
/**
 * Configuraciones editables desde el panel (espacios preparados para el futuro):
 * enlace de Instagram, dirección exacta, historia y fotografía de Luna, límite de puestos.
 */
const db = require('./db');

const DEFAULTS = {
  instagram_url: '',
  event_address: '',
  luna_story: '',
  luna_photo: '',
  max_stalls: '',
};

async function getAll() {
  const out = { ...DEFAULTS };
  for (const r of await db.query('SELECT key, value FROM patita.settings')) {
    if (r.key in out) out[r.key] = r.value ?? '';
  }
  return out;
}

async function set(key, value, q = db) {
  if (!(key in DEFAULTS)) throw new Error(`Configuración desconocida: ${key}`);
  await q.query('INSERT INTO patita.settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value == null ? '' : String(value)]);
}

function parseMax(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function maxStalls(q = db) {
  const rows = await q.query("SELECT value FROM patita.settings WHERE key = 'max_stalls'");
  return parseMax(rows[0] && rows[0].value);
}

/** Valida y guarda los campos de texto. Devuelve un mensaje de error o null. */
async function updateFromAdmin(body) {
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  const changes = [];
  if (body.instagramUrl !== undefined) {
    const url = s(body.instagramUrl);
    if (url && !/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._\-/?=&]+$/.test(url)) {
      return 'El enlace de Instagram debe empezar por https://instagram.com/ o https://www.instagram.com/';
    }
    changes.push(['instagram_url', url]);
  }
  if (body.eventAddress !== undefined) {
    const v = s(body.eventAddress);
    if (v.length > 200) return 'La dirección es demasiado larga.';
    changes.push(['event_address', v]);
  }
  if (body.lunaStory !== undefined) {
    const v = s(body.lunaStory);
    if (v.length > 3000) return 'La historia de Luna no puede superar 3000 caracteres.';
    changes.push(['luna_story', v]);
  }
  if (body.maxStalls !== undefined) {
    const raw = String(body.maxStalls ?? '').trim();
    if (raw && !/^\d{1,4}$/.test(raw)) return 'El límite de puestos debe ser un número entero (o vacío para no tener límite).';
    changes.push(['max_stalls', raw && Number(raw) > 0 ? String(Number(raw)) : '']);
  }
  for (const [k, v] of changes) await set(k, v);
  return null;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

async function setLunaPhoto(buf, ext) {
  const name = `luna-${Date.now()}.${ext}`;
  await db.tx(async (q) => {
    await q.query("DELETE FROM patita.media WHERE name LIKE 'luna-%'");
    await q.query('INSERT INTO patita.media (name, mime, data) VALUES ($1, $2, $3)', [name, MIME[ext], buf]);
    await set('luna_photo', name, q);
  });
  return name;
}

async function removeLunaPhoto() {
  await db.tx(async (q) => {
    await q.query("DELETE FROM patita.media WHERE name LIKE 'luna-%'");
    await set('luna_photo', '', q);
  });
}

async function getMedia(name) {
  return db.one('SELECT mime, data FROM patita.media WHERE name = $1', [name]);
}

/** Configuración que la página pública puede ver (sin nada privado). */
async function publicView() {
  const a = await getAll();
  return {
    instagramUrl: a.instagram_url || null,
    eventAddress: a.event_address || null,
    lunaStory: a.luna_story || null,
    lunaPhotoUrl: a.luna_photo ? `/media/${encodeURIComponent(a.luna_photo)}` : null,
    maxStalls: parseMax(a.max_stalls),
  };
}

async function adminView() {
  const a = await getAll();
  return {
    instagramUrl: a.instagram_url,
    eventAddress: a.event_address,
    lunaStory: a.luna_story,
    lunaPhotoUrl: a.luna_photo ? `/media/${encodeURIComponent(a.luna_photo)}` : null,
    maxStalls: a.max_stalls,
  };
}

module.exports = { getAll, set, maxStalls, updateFromAdmin, setLunaPhoto, removeLunaPhoto, getMedia, publicView, adminView };
