'use strict';
/** Validación de la inscripción en el servidor (el navegador valida también, pero aquí es definitivo). */
const { CATEGORIES, SPACE_OPTIONS } = require('./catalog');

const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function yesNo(v) {
  if (v === true || v === 'si' || v === 'sí' || v === 'true') return 1;
  if (v === false || v === 'no' || v === 'false') return 0;
  return null;
}

/**
 * @returns {{ data?: object, errors?: Record<string,string> }}
 */
function validateRegistration(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const data = {};

  const text = (field, label, { required = true, min = 2, max = 200 } = {}) => {
    const v = clean(b[field]);
    if (!v) {
      if (required) errors[field] = `Por favor escribe ${label}.`;
      data[field] = null;
      return;
    }
    if (v.length < min) errors[field] = `${cap(label)} es demasiado corto.`;
    else if (v.length > max) errors[field] = `${cap(label)} no puede superar ${max} caracteres.`;
    data[field] = v;
  };

  // A. Datos personales
  text('fullName', 'tu nombre completo', { min: 5, max: 120 });
  text('documentNumber', 'tu número de documento', { required: false, min: 4, max: 20 });
  if (data.documentNumber && !/^[0-9A-Za-z.\- ]{4,20}$/.test(data.documentNumber)) {
    errors.documentNumber = 'El documento solo puede contener números y letras.';
  }
  const phoneDigits = clean(b.phone).replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  if (!phoneDigits) errors.phone = 'Por favor escribe tu número de celular.';
  else if (!/^3\d{9}$/.test(phoneDigits)) errors.phone = 'Escribe un celular colombiano válido de 10 dígitos (por ejemplo 3001234567).';
  data.phone = phoneDigits;

  const email = clean(b.email).toLowerCase();
  if (!email) errors.email = 'Por favor escribe tu correo electrónico.';
  else if (email.length > 160 || !EMAIL_RE.test(email)) errors.email = 'El correo electrónico no parece válido.';
  data.email = email;
  text('neighborhood', 'tu barrio de residencia', { min: 2, max: 100 });

  // B. Emprendimiento
  text('businessName', 'el nombre del emprendimiento', { min: 2, max: 100 });
  text('managerName', 'el nombre de la persona encargada', { min: 3, max: 120 });
  const category = clean(b.category);
  if (!category) errors.category = 'Por favor elige una categoría.';
  else if (!CATEGORIES.some((c) => c.value === category)) errors.category = 'La categoría elegida no es válida.';
  data.category = category;
  text('productsDescription', 'la descripción de tus productos', { min: 10, max: 1000 });
  text('socialMedia', 'tus redes sociales', { required: false, min: 2, max: 200 });

  // C. Puesto
  text('productsToBring', 'qué productos llevarás', { min: 3, max: 1000 });
  const space = clean(b.spaceNeeded);
  if (!space) errors.spaceNeeded = 'Cuéntanos cuánto espacio necesitas.';
  else if (!SPACE_OPTIONS.some((s) => s.value === space)) errors.spaceNeeded = 'La opción de espacio no es válida.';
  data.spaceNeeded = space;
  for (const [field, msg] of [
    ['needsTable', 'Indica si necesitas que la organización te proporcione una mesa.'],
    ['bringsOwnTable', 'Indica si llevarás tu propia mesa.'],
    ['needsPower', 'Indica si necesitas conexión eléctrica.'],
  ]) {
    const v = yesNo(b[field]);
    if (v === null) errors[field] = msg;
    data[field] = v;
  }
  text('specialRequest', 'tu solicitud especial', { required: false, min: 2, max: 1000 });
  if (space === 'otro' && !data.specialRequest) {
    errors.specialRequest = 'Elegiste «Otro» en el espacio: explícanos aquí lo que necesitas.';
  }

  // D. Confirmación
  for (const [field, msg] of [
    ['acceptTerms', 'Debes aceptar las condiciones de participación.'],
    ['acceptData', 'Debes autorizar el uso de tus datos para organizar el evento.'],
    ['acceptTruth', 'Debes confirmar que la información es verdadera.'],
    ['acceptFee', 'Debes aceptar el valor de inscripción de $10.000 COP por puesto.'],
  ]) {
    if (b[field] !== true) errors[field] = msg;
    data[field] = b[field] === true ? 1 : 0;
  }

  const key = clean(b.idempotencyKey);
  data.idempotencyKey = /^[A-Za-z0-9-]{16,64}$/.test(key) ? key : null;

  return Object.keys(errors).length ? { errors } : { data };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Decodifica una imagen data:URL y comprueba que realmente sea JPEG, PNG o WebP. */
function decodeImage(dataUrl, maxBytes) {
  if (typeof dataUrl !== 'string' || !dataUrl) return { none: true };
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { error: 'La fotografía debe ser una imagen JPG, PNG o WebP.' };
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) return { error: `La fotografía es demasiado pesada (máximo ${Math.round(maxBytes / 1024 / 1024)} MB).` };
  let ext = null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = 'jpg';
  else if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png';
  else if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') ext = 'webp';
  if (!ext) return { error: 'El archivo no es una imagen válida.' };
  return { buf, ext };
}

module.exports = { validateRegistration, decodeImage, clean };
