'use strict';
/**
 * pg-issuer.js — Issues 15-min ephemeral PostgreSQL roles for Neon nodes.
 * Creates ananta_tmp_{uuid} role, grants schema access, schedules DROP.
 */
const { Client } = require('pg');
const crypto     = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getCredential } = require('./credentials');
const pino = require('pino');
const logger = pino({ name: 'kavacha-pg', level: process.env.LOG_LEVEL || 'info' });

const TTL_MS      = 15 * 60 * 1000;   // 15 minutes
const CLEANUP_MS  = TTL_MS + 30_000;   // drop 30s after expiry

const parseHost = (adminUri) => {
  try {
    const u = new URL(adminUri);
    return { host: u.hostname, port: u.port || '5432', dbName: u.pathname.replace(/^\//, '') };
  } catch {
    return { host: 'localhost', port: '5432', dbName: 'postgres' };
  }
};

const scheduleCleanup = (adminUri, roleName) => {
  setTimeout(async () => {
    const c = new Client({ connectionString: adminUri, statement_timeout: 10_000 });
    try {
      await c.connect();
      await c.query('DROP ROLE IF EXISTS "' + roleName + '"');
      logger.info({ roleName }, 'Temp PG role cleaned up');
    } catch (err) {
      logger.warn({ roleName }, 'Temp PG role cleanup failed (may already be gone)');
    } finally { await c.end().catch(() => {}); }
  }, CLEANUP_MS).unref();
};

const issueNeonCredential = async (nodeCode, tenantId, operation = 'readwrite') => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'pg-neon') throw new Error('Invalid pg node: ' + nodeCode);
  if (tenantId && !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) throw new Error('Invalid tenantId');

  const uid        = uuidv4().replace(/-/g, '').slice(0, 16);
  const roleName   = 'ananta_tmp_' + uid;
  const password   = crypto.randomBytes(48).toString('base64url');
  const schemaName = tenantId ? ('ananta_proj_' + tenantId) : null;
  const expiresAt  = new Date(Date.now() + TTL_MS).toISOString();
  const { host, port, dbName } = parseHost(creds.adminUri);

  const c = new Client({ connectionString: creds.adminUri, statement_timeout: 15_000, connect_timeout: 10 });
  try {
    await c.connect();
    await c.query(
      'CREATE ROLE "' + roleName + '" WITH LOGIN PASSWORD $1 VALID UNTIL $2',
      [password, expiresAt]
    );

    if (schemaName) {
      // Ensure schema exists (idempotent)
      await c.query('CREATE SCHEMA IF NOT EXISTS "' + schemaName + '"');
      await c.query('GRANT USAGE ON SCHEMA "' + schemaName + '" TO "' + roleName + '"');

      if (operation === 'readwrite' || operation === 'write') {
        await c.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "' + schemaName + '" TO "' + roleName + '"');
        await c.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "' + schemaName + '" TO "' + roleName + '"');
        // Future tables
        await c.query('ALTER DEFAULT PRIVILEGES IN SCHEMA "' + schemaName + '" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "' + roleName + '"');
      } else {
        await c.query('GRANT SELECT ON ALL TABLES IN SCHEMA "' + schemaName + '" TO "' + roleName + '"');
      }
    }

    logger.info({ nodeCode, operation, roleName, expiresAt }, 'Issued pg-neon credential');

    const connectionString = 'postgresql://' + roleName + ':' + encodeURIComponent(password) + '@' + host + ':' + port + '/' + dbName + '?sslmode=require&search_path=' + (schemaName || 'public');
    scheduleCleanup(creds.adminUri, roleName);
    return { connectionString, roleName, expiresAt };
  } catch (err) {
    try { await c.query('DROP ROLE IF EXISTS "' + roleName + '"'); } catch {}
    logger.error({ nodeCode, err: err.message }, 'Failed to issue pg-neon credential');
    throw err;
  } finally { await c.end().catch(() => {}); }
};

module.exports = { issueNeonCredential };
