'use strict';
/**
 * Acceso a la base de datos PostgreSQL.
 * - En producción (Vercel) se conecta a Supabase usando DATABASE_URL.
 * - Sin DATABASE_URL (desarrollo local o pruebas) usa PGlite, un PostgreSQL embebido
 *   que guarda los datos en DATA_DIR/pgdata.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');

let impl; // { query(text, params) -> rows, tx(fn), close() }
let opening;

const SCHEMA_SQL = () => fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

async function openPg() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: Number(process.env.PG_POOL_MAX) || 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });
  return {
    async query(text, params = []) { return (await pool.query(text, params)).rows; },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: async (t, p = []) => (await client.query(t, p)).rows });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function openPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = config.memoryDb ? undefined : path.join(config.dataDir, 'pgdata');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.exec(SCHEMA_SQL());
  let chain = Promise.resolve(); // PGlite es de una sola conexión: serializamos las transacciones
  const query = async (t, p = []) => (await pg.query(t, p)).rows;
  return {
    query,
    tx(fn) {
      const run = chain.then(() => pg.transaction((trx) => fn({ query: async (t, p = []) => (await trx.query(t, p)).rows })));
      chain = run.catch(() => {});
      return run;
    },
    close: () => pg.close(),
  };
}

async function open() {
  if (impl) return impl;
  if (!opening) {
    opening = (config.databaseUrl ? openPg() : openPglite()).then((i) => { impl = i; return i; });
  }
  return opening;
}

async function query(text, params) { return (await open()).query(text, params); }
async function one(text, params) { return (await query(text, params))[0] || null; }
async function tx(fn) { return (await open()).tx(fn); }
async function close() { if (impl) { await impl.close(); impl = undefined; opening = undefined; } }

module.exports = { open, query, one, tx, close, SCHEMA_SQL };
