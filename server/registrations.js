'use strict';
/** Operaciones sobre las inscripciones. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const config = require('./config');
const settings = require('./settings');
const { CATEGORIES, SPACE_OPTIONS, STATUSES, labelOf } = require('./catalog');

const formatCode = (id) => `UPP-${String(id).padStart(3, '0')}`;

/**
 * Guarda una inscripción y le asigna un número consecutivo único (UPP-001, UPP-002...).
 * Si llega dos veces la misma solicitud (doble clic, recarga), devuelve el número ya asignado.
 */
function create(data, photo) {
  return db.transaction((d) => {
    if (data.idempotencyKey) {
      const prev = d.prepare('SELECT code, status FROM registrations WHERE idempotency_key = ?').get(data.idempotencyKey);
      if (prev) return { code: prev.code, status: prev.status, duplicate: true };
    }
    let photoFile = null;
    if (photo && photo.buf) {
      photoFile = `${crypto.randomBytes(16).toString('hex')}.${photo.ext}`;
      fs.writeFileSync(path.join(config.uploadsDir, photoFile), photo.buf, { mode: 0o600 });
    }
    const r = d.prepare(`INSERT INTO registrations (
        idempotency_key, full_name, document_number, phone, email, neighborhood,
        business_name, manager_name, category, products_description, social_media, photo_file,
        products_to_bring, space_needed, needs_table, brings_own_table, needs_power, special_request,
        accepted_terms, accepted_data, accepted_truth, accepted_fee, fee_cop
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      data.idempotencyKey, data.fullName, data.documentNumber, data.phone, data.email, data.neighborhood,
      data.businessName, data.managerName, data.category, data.productsDescription, data.socialMedia, photoFile,
      data.productsToBring, data.spaceNeeded, data.needsTable, data.bringsOwnTable, data.needsPower, data.specialRequest,
      data.acceptTerms, data.acceptData, data.acceptTruth, data.acceptFee, config.feeCop,
    );
    const id = Number(r.lastInsertRowid);
    const code = formatCode(id);
    d.prepare('UPDATE registrations SET code = ? WHERE id = ?').run(code, id);
    d.prepare("INSERT INTO registration_history (registration_id, action, detail) VALUES (?, 'creada', 'Solicitud recibida desde el formulario público')").run(id);
    return { code, status: 'pendiente', duplicate: false };
  });
}

/** Consulta pública: requiere número + celular para no revelar datos de otras personas. */
function publicLookup(code, phone) {
  const row = db.get().prepare('SELECT code, business_name, status, created_at FROM registrations WHERE code = ? AND phone = ?')
    .get(String(code).toUpperCase(), phone);
  if (!row) return null;
  return { code: row.code, businessName: row.business_name, status: row.status, statusLabel: labelOf(STATUSES, row.status), createdAt: row.created_at };
}

function toDto(r) {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    statusLabel: labelOf(STATUSES, r.status),
    paymentReceived: !!r.payment_received,
    fullName: r.full_name,
    documentNumber: r.document_number,
    phone: r.phone,
    email: r.email,
    neighborhood: r.neighborhood,
    businessName: r.business_name,
    managerName: r.manager_name,
    category: r.category,
    categoryLabel: labelOf(CATEGORIES, r.category),
    productsDescription: r.products_description,
    socialMedia: r.social_media,
    hasPhoto: !!r.photo_file,
    productsToBring: r.products_to_bring,
    spaceNeeded: r.space_needed,
    spaceLabel: labelOf(SPACE_OPTIONS, r.space_needed),
    needsTable: !!r.needs_table,
    bringsOwnTable: !!r.brings_own_table,
    needsPower: !!r.needs_power,
    specialRequest: r.special_request,
    acceptedTerms: !!r.accepted_terms,
    acceptedData: !!r.accepted_data,
    acceptedTruth: !!r.accepted_truth,
    acceptedFee: !!r.accepted_fee,
    feeCop: r.fee_cop,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    reviewedBy: r.reviewer_name || null,
    reviewedAt: r.reviewed_at,
  };
}

const BASE_SELECT = `SELECT r.*, a.full_name AS reviewer_name FROM registrations r LEFT JOIN admins a ON a.id = r.reviewed_by`;

function list({ q, category, status } = {}) {
  const where = [];
  const params = [];
  if (q) {
    const like = `%${String(q).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(r.full_name LIKE ? ESCAPE '\\' OR r.business_name LIKE ? ESCAPE '\\' OR r.code LIKE ? ESCAPE '\\' OR r.manager_name LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like);
  }
  if (category && CATEGORIES.some((c) => c.value === category)) { where.push('r.category = ?'); params.push(category); }
  if (status && STATUSES.some((s) => s.value === status)) { where.push('r.status = ?'); params.push(status); }
  const sql = `${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.id DESC`;
  return db.get().prepare(sql).all(...params).map(toDto);
}

function getById(id) {
  const row = db.get().prepare(`${BASE_SELECT} WHERE r.id = ?`).get(Number(id));
  if (!row) return null;
  const dto = toDto(row);
  dto.history = db.get().prepare(`SELECT h.action, h.detail, h.created_at AS createdAt, a.full_name AS adminName
    FROM registration_history h LEFT JOIN admins a ON a.id = h.admin_id
    WHERE h.registration_id = ? ORDER BY h.id DESC`).all(row.id);
  return dto;
}

function photoPath(id) {
  const row = db.get().prepare('SELECT photo_file FROM registrations WHERE id = ?').get(Number(id));
  if (!row || !row.photo_file || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(row.photo_file)) return null;
  const p = path.join(config.uploadsDir, row.photo_file);
  return fs.existsSync(p) ? p : null;
}

/** Cambia estado, pago o notas; deja constancia en el historial con el nombre del administrador. */
function update(id, changes, admin) {
  return db.transaction((d) => {
    const row = d.prepare('SELECT * FROM registrations WHERE id = ?').get(Number(id));
    if (!row) return { notFound: true };
    const log = (action, detail) => d.prepare('INSERT INTO registration_history (registration_id, admin_id, action, detail) VALUES (?,?,?,?)')
      .run(row.id, admin.id, action, detail);

    if (changes.status !== undefined) {
      if (!STATUSES.some((s) => s.value === changes.status)) return { error: 'Estado inválido.' };
      if (changes.status !== row.status) {
        if (changes.status === 'aprobada') {
          const max = settings.maxStalls();
          if (max) {
            const approved = d.prepare("SELECT COUNT(*) AS n FROM registrations WHERE status = 'aprobada'").get().n;
            if (approved >= max) return { error: `Ya se aprobaron los ${max} puestos disponibles. Aumenta el límite en Configuración si deseas aprobar más.` };
          }
        }
        d.prepare("UPDATE registrations SET status = ?, reviewed_by = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
          .run(changes.status, admin.id, row.id);
        log('estado', `${labelOf(STATUSES, row.status)} → ${labelOf(STATUSES, changes.status)}`);
      }
    }
    if (changes.paymentReceived !== undefined) {
      const v = changes.paymentReceived ? 1 : 0;
      if (v !== row.payment_received) {
        d.prepare('UPDATE registrations SET payment_received = ? WHERE id = ?').run(v, row.id);
        log('pago', v ? 'Pago marcado como recibido' : 'Pago marcado como no recibido');
      }
    }
    if (changes.adminNotes !== undefined) {
      const notes = String(changes.adminNotes || '').trim().slice(0, 2000) || null;
      if (notes !== row.admin_notes) {
        d.prepare('UPDATE registrations SET admin_notes = ? WHERE id = ?').run(notes, row.id);
        log('nota', 'Nota interna actualizada');
      }
    }
    d.prepare("UPDATE registrations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(row.id);
    return { ok: true };
  });
}

function stats() {
  const d = db.get();
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, 0]));
  for (const r of d.prepare('SELECT status, COUNT(*) AS n FROM registrations GROUP BY status').all()) counts[r.status] = r.n;
  const total = counts.pendiente + counts.aprobada + counts.rechazada;
  const paid = d.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(fee_cop),0) AS s FROM registrations WHERE status = 'aprobada' AND payment_received = 1").get();
  const expected = d.prepare("SELECT COALESCE(SUM(fee_cop),0) AS s FROM registrations WHERE status = 'aprobada'").get().s;
  const byCategory = d.prepare('SELECT category, COUNT(*) AS n FROM registrations GROUP BY category').all()
    .map((r) => ({ category: r.category, label: labelOf(CATEGORIES, r.category), count: r.n }));
  const max = settings.maxStalls();
  return {
    total,
    pending: counts.pendiente,
    approved: counts.aprobada,
    rejected: counts.rechazada,
    maxStalls: max,
    availableStalls: max ? Math.max(0, max - counts.aprobada) : null,
    feeCop: config.feeCop,
    collectedCop: Number(paid.s),
    paidCount: paid.n,
    expectedCop: Number(expected),
    byCategory,
  };
}

const EXPORT_HEADERS = [
  'Número', 'Estado', 'Pago recibido', 'Fecha de inscripción', 'Nombre completo', 'Documento', 'Celular', 'Correo', 'Barrio',
  'Emprendimiento', 'Encargado(a)', 'Categoría', 'Descripción de productos', 'Redes sociales', 'Tiene fotografía',
  'Productos que llevará', 'Espacio', 'Necesita mesa', 'Lleva mesa propia', 'Necesita electricidad', 'Solicitud especial',
  'Valor inscripción (COP)', 'Notas internas', 'Revisado por', 'Fecha de revisión',
];

function exportRows() {
  const yn = (b) => (b ? 'Sí' : 'No');
  const date = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '');
  return list().reverse().map((r) => [
    r.code, r.statusLabel, yn(r.paymentReceived), date(r.createdAt), r.fullName, r.documentNumber || '', r.phone, r.email, r.neighborhood,
    r.businessName, r.managerName, r.categoryLabel, r.productsDescription, r.socialMedia || '', yn(r.hasPhoto),
    r.productsToBring, r.spaceLabel, yn(r.needsTable), yn(r.bringsOwnTable), yn(r.needsPower), r.specialRequest || '',
    r.feeCop, r.adminNotes || '', r.reviewedBy || '', date(r.reviewedAt),
  ]);
}

module.exports = { create, publicLookup, list, getById, photoPath, update, stats, exportRows, EXPORT_HEADERS, formatCode };
