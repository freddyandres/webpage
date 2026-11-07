'use strict';
/**
 * Base de datos SQLite (módulo integrado node:sqlite).
 * Todo queda guardado en DATA_DIR/patita.db y persiste aunque se cierre la página
 * o se reinicie el servidor.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const config = require('./config');

let db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','lector')),
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at INTEGER NOT NULL
);

-- AUTOINCREMENT garantiza que un id (y por tanto un número UPP) nunca se reutiliza.
CREATE TABLE IF NOT EXISTS registrations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT UNIQUE,
  idempotency_key   TEXT UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobada','rechazada')),
  payment_received  INTEGER NOT NULL DEFAULT 0,
  -- A. Datos personales
  full_name         TEXT NOT NULL,
  document_number   TEXT,
  phone             TEXT NOT NULL,
  email             TEXT NOT NULL,
  neighborhood      TEXT NOT NULL,
  -- B. Emprendimiento
  business_name     TEXT NOT NULL,
  manager_name      TEXT NOT NULL,
  category          TEXT NOT NULL,
  products_description TEXT NOT NULL,
  social_media      TEXT,
  photo_file        TEXT,
  -- C. Puesto
  products_to_bring TEXT NOT NULL,
  space_needed      TEXT NOT NULL,
  needs_table       INTEGER NOT NULL,
  brings_own_table  INTEGER NOT NULL,
  needs_power       INTEGER NOT NULL,
  special_request   TEXT,
  -- D. Confirmación
  accepted_terms    INTEGER NOT NULL,
  accepted_data     INTEGER NOT NULL,
  accepted_truth    INTEGER NOT NULL,
  accepted_fee      INTEGER NOT NULL,
  fee_cop           INTEGER NOT NULL,
  -- Administración
  admin_notes       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_by       INTEGER REFERENCES admins(id),
  reviewed_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_reg_status   ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_reg_category ON registrations(category);

CREATE TABLE IF NOT EXISTS registration_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  admin_id        INTEGER REFERENCES admins(id),
  action          TEXT NOT NULL,
  detail          TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hist_reg ON registration_history(registration_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

function open() {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.mkdirSync(config.mediaDir, { recursive: true });
  db = new DatabaseSync(path.join(config.dataDir, 'patita.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

function get() {
  return db || open();
}

function close() {
  if (db) {
    db.close();
    db = undefined;
  }
}

/** Ejecuta fn dentro de una transacción con bloqueo de escritura inmediato. */
function transaction(fn) {
  const d = get();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(d);
    d.exec('COMMIT');
    return result;
  } catch (err) {
    try { d.exec('ROLLBACK'); } catch { /* ignorar */ }
    throw err;
  }
}

module.exports = { open, get, close, transaction };
