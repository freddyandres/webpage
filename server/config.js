'use strict';
/**
 * Configuración general. Los valores sensibles NUNCA se escriben aquí:
 * se leen de variables de entorno (ver README y .env.example).
 */
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));

module.exports = {
  root,
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  dataDir,
  uploadsDir: path.join(dataDir, 'uploads'), // fotos de productos (privadas, solo administradores)
  mediaDir: path.join(dataDir, 'media'),     // medios públicos (fotografía de Luna)
  publicDir: path.join(root, 'public'),
  adminDir: path.join(root, 'admin'),

  /** Valor de inscripción por puesto, en pesos colombianos. */
  feeCop: 10000,

  /** Duración de la sesión administrativa (horas). */
  sessionHours: Number(process.env.SESSION_HOURS) || 12,

  /**
   * true si el sitio se publica detrás de HTTPS (recomendado en producción).
   * Activa el atributo Secure de la cookie de sesión.
   */
  secureCookies: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',

  /** Confiar en X-Forwarded-For (solo si hay un proxy inverso delante). */
  trustProxy: process.env.TRUST_PROXY === 'true',

  isTest: process.env.NODE_ENV === 'test',
};
