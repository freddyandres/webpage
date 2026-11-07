'use strict';
/**
 * Configuraciones editables desde el panel (espacios preparados para el futuro):
 * enlace de Instagram, dirección exacta, historia y fotografía de Luna, límite de puestos.
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const config = require('./config');

const DEFAULTS = {
  instagram_url: '',
  event_address: '',
  luna_story: '',
  luna_photo: '',
  max_stalls: '',
};

function getAll() {
  const out = { ...DEFAULTS };
  for (const r of db.get().prepare('SELECT key, value FROM settings').all()) {
    if (r.key in out) out[r.key] = r.value ?? '';
  }
  return out;
}

function set(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Configuración desconocida: ${key}`);
  db.get().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? '' : String(value));
}

function maxStalls() {
  const n = parseInt(getAll().max_stalls, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Valida y guarda los campos de texto. Devuelve un mensaje de error o null. */
function updateFromAdmin(body) {
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  if (body.instagramUrl !== undefined) {
    const url = s(body.instagramUrl);
    if (url && !/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._\-/?=&]+$/.test(url)) {
      return 'El enlace de Instagram debe empezar por https://instagram.com/ o https://www.instagram.com/';
    }
    set('instagram_url', url);
  }
  if (body.eventAddress !== undefined) {
    const v = s(body.eventAddress);
    if (v.length > 200) return 'La dirección es demasiado larga.';
    set('event_address', v);
  }
  if (body.lunaStory !== undefined) {
    const v = s(body.lunaStory);
    if (v.length > 3000) return 'La historia de Luna no puede superar 3000 caracteres.';
    set('luna_story', v);
  }
  if (body.maxStalls !== undefined) {
    const raw = String(body.maxStalls ?? '').trim();
    if (raw && !/^\d{1,4}$/.test(raw)) return 'El límite de puestos debe ser un número entero (o vacío para no tener límite).';
    set('max_stalls', raw && Number(raw) > 0 ? String(Number(raw)) : '');
  }
  return null;
}

function setLunaPhoto(buf, ext) {
  const prev = getAll().luna_photo;
  const name = `luna-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(config.mediaDir, name), buf);
  set('luna_photo', name);
  if (prev) fs.rm(path.join(config.mediaDir, path.basename(prev)), { force: true }, () => {});
  return name;
}

function removeLunaPhoto() {
  const prev = getAll().luna_photo;
  set('luna_photo', '');
  if (prev) fs.rm(path.join(config.mediaDir, path.basename(prev)), { force: true }, () => {});
}

/** Configuración que la página pública puede ver (sin nada privado). */
function publicView() {
  const a = getAll();
  return {
    instagramUrl: a.instagram_url || null,
    eventAddress: a.event_address || null,
    lunaStory: a.luna_story || null,
    lunaPhotoUrl: a.luna_photo ? `/media/${encodeURIComponent(a.luna_photo)}` : null,
    maxStalls: maxStalls(),
  };
}

function adminView() {
  const a = getAll();
  return {
    instagramUrl: a.instagram_url,
    eventAddress: a.event_address,
    lunaStory: a.luna_story,
    lunaPhotoUrl: a.luna_photo ? `/media/${encodeURIComponent(a.luna_photo)}` : null,
    maxStalls: a.max_stalls,
  };
}

module.exports = { getAll, set, maxStalls, updateFromAdmin, setLunaPhoto, removeLunaPhoto, publicView, adminView };
