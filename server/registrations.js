'use strict';
/** Operaciones sobre las inscripciones. */
const db = require('./db');
const config = require('./config');
const settings = require('./settings');
const { CATEGORIES, LEGACY_CATEGORIES, SPACE_OPTIONS, STATUSES, labelOf } = require('./catalog');

const ALL_CATEGORIES = [...CATEGORIES, ...LEGACY_CATEGORIES];

const formatCode = (id) => `UPP-${String(id).padStart(3, '0')}`;
const iso = (d) => (d ? new Date(d).toISOString() : null);
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Guarda una inscripción y le asigna un número consecutivo único (UPP-001, UPP-002...).
 * Si llega dos veces la misma solicitud (doble clic, recarga), devuelve el número ya asignado.
 */
async function create(data, photo) {
  if (data.idempotencyKey) {
    const prev = await db.one('SELECT code, status FROM patita.registrations WHERE idempotency_key = $1', [data.idempotencyKey]);
    if (prev) return { code: prev.code, status: prev.status, duplicate: true };
  }
  try {
    return await db.tx(async (q) => {
      const [r] = await q.query(`INSERT INTO patita.registrations (
          idempotency_key, full_name, document_number, phone, email, neighborhood,
          business_name, manager_name, category, products_description, social_media, photo_data, photo_type,
          products_to_bring, space_needed, needs_table, brings_own_table, needs_power, special_request,
          accepted_terms, accepted_data, accepted_truth, accepted_fee, fee_cop
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`, [
        data.idempotencyKey, data.fullName, data.documentNumber, data.phone, data.email, data.neighborhood,
        data.businessName, data.managerName, data.category, data.productsDescription, data.socialMedia,
        photo ? photo.buf : null, photo ? MIME[photo.ext] : null,
        data.productsToBring, data.spaceNeeded, !!data.needsTable, !!data.bringsOwnTable, !!data.needsPower, data.specialRequest,
        !!data.acceptTerms, !!data.acceptData, !!data.acceptTruth, !!data.acceptFee, config.feeCop,
      ]);
      const code = formatCode(r.id);
      await q.query('UPDATE patita.registrations SET code = $1 WHERE id = $2', [code, r.id]);
      await q.query("INSERT INTO patita.registration_history (registration_id, action, detail) VALUES ($1, 'creada', 'Solicitud recibida desde el formulario público')", [r.id]);
      return { code, status: 'pendiente', duplicate: false };
    });
  } catch (err) {
    // Dos envíos simultáneos con la misma clave: devolvemos el que quedó guardado
    if (err.code === '23505' && data.idempotencyKey) {
      const prev = await db.one('SELECT code, status FROM patita.registrations WHERE idempotency_key = $1', [data.idempotencyKey]);
      if (prev) return { code: prev.code, status: prev.status, duplicate: true };
    }
    throw err;
  }
}

/** Consulta pública: requiere número + celular para no revelar datos de otras personas. */
async function publicLookup(code, phone) {
  const row = await db.one('SELECT code, business_name, status, created_at FROM patita.registrations WHERE code = $1 AND phone = $2',
    [String(code).toUpperCase(), phone]);
  if (!row) return null;
  return { code: row.code, businessName: row.business_name, status: row.status, statusLabel: labelOf(STATUSES, row.status), createdAt: iso(row.created_at) };
}

function toDto(r) {
  return {
    id: Number(r.id),
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
    categoryLabel: labelOf(ALL_CATEGORIES, r.category),
    productsDescription: r.products_description,
    socialMedia: r.social_media,
    hasPhoto: !!r.has_photo,
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
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    reviewedBy: r.reviewer_name || null,
    reviewedAt: iso(r.reviewed_at),
  };
}

// No se incluye la fotografía (bytea) en los listados: solo si existe.
const BASE_SELECT = `SELECT r.id, r.code, r.status, r.payment_received, r.full_name, r.document_number, r.phone, r.email, r.neighborhood,
  r.business_name, r.manager_name, r.category, r.products_description, r.social_media, (r.photo_data IS NOT NULL) AS has_photo,
  r.products_to_bring, r.space_needed, r.needs_table, r.brings_own_table, r.needs_power, r.special_request,
  r.accepted_terms, r.accepted_data, r.accepted_truth, r.accepted_fee, r.fee_cop, r.admin_notes, r.created_at, r.updated_at,
  r.reviewed_at, a.full_name AS reviewer_name
  FROM patita.registrations r LEFT JOIN patita.admins a ON a.id = r.reviewed_by`;

async function list({ q, category, status } = {}) {
  const where = [];
  const params = [];
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const p = `$${params.length}`;
    where.push(`(r.full_name ILIKE ${p} OR r.business_name ILIKE ${p} OR r.code ILIKE ${p} OR r.manager_name ILIKE ${p})`);
  }
  if (category && CATEGORIES.some((c) => c.value === category)) { params.push(category); where.push(`r.category = $${params.length}`); }
  if (status && STATUSES.some((s) => s.value === status)) { params.push(status); where.push(`r.status = $${params.length}`); }
  const rows = await db.query(`${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.id DESC`, params);
  return rows.map(toDto);
}

async function getById(id) {
  const row = await db.one(`${BASE_SELECT} WHERE r.id = $1`, [Number(id)]);
  if (!row) return null;
  const dto = toDto(row);
  dto.history = (await db.query(`SELECT h.action, h.detail, h.created_at, a.full_name AS admin_name
    FROM patita.registration_history h LEFT JOIN patita.admins a ON a.id = h.admin_id
    WHERE h.registration_id = $1 ORDER BY h.id DESC`, [row.id]))
    .map((h) => ({ action: h.action, detail: h.detail, createdAt: iso(h.created_at), adminName: h.admin_name }));
  return dto;
}

async function getPhoto(id) {
  const row = await db.one('SELECT photo_data, photo_type FROM patita.registrations WHERE id = $1 AND photo_data IS NOT NULL', [Number(id)]);
  return row ? { data: Buffer.from(row.photo_data), mime: row.photo_type } : null;
}

/** Cambia estado, pago o notas; deja constancia en el historial con el nombre del administrador. */
async function update(id, changes, admin) {
  return db.tx(async (q) => {
    // Bloqueo para que dos administradores no superen a la vez el límite de puestos
    await q.query('SELECT pg_advisory_xact_lock(424242)');
    const [row] = await q.query('SELECT id, status, payment_received, admin_notes FROM patita.registrations WHERE id = $1 FOR UPDATE', [Number(id)]);
    if (!row) return { notFound: true };
    const log = (action, detail) => q.query('INSERT INTO patita.registration_history (registration_id, admin_id, action, detail) VALUES ($1,$2,$3,$4)',
      [row.id, admin.id, action, detail]);

    if (changes.status !== undefined) {
      if (!STATUSES.some((s) => s.value === changes.status)) return { error: 'Estado inválido.' };
      if (changes.status !== row.status) {
        if (changes.status === 'aprobada') {
          const max = await settings.maxStalls(q);
          if (max) {
            const [{ n }] = await q.query("SELECT count(*)::int AS n FROM patita.registrations WHERE status = 'aprobada'");
            if (n >= max) return { error: `Ya se aprobaron los ${max} puestos disponibles. Aumenta el límite en Configuración si deseas aprobar más.` };
          }
        }
        await q.query('UPDATE patita.registrations SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3', [changes.status, admin.id, row.id]);
        await log('estado', `${labelOf(STATUSES, row.status)} → ${labelOf(STATUSES, changes.status)}`);
      }
    }
    if (changes.paymentReceived !== undefined) {
      const v = !!changes.paymentReceived;
      if (v !== row.payment_received) {
        await q.query('UPDATE patita.registrations SET payment_received = $1 WHERE id = $2', [v, row.id]);
        await log('pago', v ? 'Pago marcado como recibido' : 'Pago marcado como no recibido');
      }
    }
    if (changes.adminNotes !== undefined) {
      const notes = String(changes.adminNotes || '').trim().slice(0, 2000) || null;
      if (notes !== row.admin_notes) {
        await q.query('UPDATE patita.registrations SET admin_notes = $1 WHERE id = $2', [notes, row.id]);
        await log('nota', 'Nota interna actualizada');
      }
    }
    await q.query('UPDATE patita.registrations SET updated_at = now() WHERE id = $1', [row.id]);
    return { ok: true };
  });
}

async function stats() {
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, 0]));
  for (const r of await db.query('SELECT status, count(*)::int AS n FROM patita.registrations GROUP BY status')) counts[r.status] = r.n;
  const total = counts.pendiente + counts.aprobada + counts.rechazada;
  const paid = await db.one("SELECT count(*)::int AS n, COALESCE(sum(fee_cop),0)::int AS s FROM patita.registrations WHERE status = 'aprobada' AND payment_received");
  const expected = await db.one("SELECT COALESCE(sum(fee_cop),0)::int AS s FROM patita.registrations WHERE status = 'aprobada'");
  const byCategory = (await db.query('SELECT category, count(*)::int AS n FROM patita.registrations GROUP BY category'))
    .map((r) => ({ category: r.category, label: labelOf(ALL_CATEGORIES, r.category), count: r.n }));
  const max = await settings.maxStalls();
  return {
    total,
    pending: counts.pendiente,
    approved: counts.aprobada,
    rejected: counts.rechazada,
    maxStalls: max,
    availableStalls: max ? Math.max(0, max - counts.aprobada) : null,
    feeCop: config.feeCop,
    collectedCop: paid.s,
    paidCount: paid.n,
    expectedCop: expected.s,
    byCategory,
  };
}

const EXPORT_HEADERS = [
  'Número', 'Estado', 'Pago recibido', 'Fecha de inscripción', 'Nombre completo', 'Documento', 'Celular', 'Correo', 'Barrio',
  'Emprendimiento', 'Encargado(a)', 'Categoría', 'Descripción de productos', 'Redes sociales', 'Tiene fotografía',
  'Productos que llevará', 'Espacio', 'Necesita mesa', 'Lleva mesa propia', 'Necesita electricidad', 'Solicitud especial',
  'Valor inscripción (COP)', 'Notas internas', 'Revisado por', 'Fecha de revisión',
];

async function exportRows() {
  const yn = (b) => (b ? 'Sí' : 'No');
  const date = (v) => (v ? new Date(v).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '');
  return (await list()).reverse().map((r) => [
    r.code, r.statusLabel, yn(r.paymentReceived), date(r.createdAt), r.fullName, r.documentNumber || '', r.phone, r.email, r.neighborhood,
    r.businessName, r.managerName, r.categoryLabel, r.productsDescription, r.socialMedia || '', yn(r.hasPhoto),
    r.productsToBring, r.spaceLabel, yn(r.needsTable), yn(r.bringsOwnTable), yn(r.needsPower), r.specialRequest || '',
    r.feeCop, r.adminNotes || '', r.reviewedBy || '', date(r.reviewedAt),
  ]);
}

module.exports = { create, publicLookup, list, getById, getPhoto, update, stats, exportRows, EXPORT_HEADERS, formatCode };
