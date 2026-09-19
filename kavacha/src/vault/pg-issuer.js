'use strict';
/**
 * pg-issuer.js — Issues short-lived (15-minute) PostgreSQL credentials for Neon nodes.
 *
 * Flow:
 *  1. Connect to Neon node using the admin URI
 *  2. CREATE ROLE ananta_tmp_{uuid} WITH LOGIN PASSWORD '...' VALID UNTIL <now+15min>
 *  3. GRANT USAGE ON SCHEMA ananta_proj_{tenantId} TO <role>
 *  4. GRANT SELECT [, INSERT, UPDATE, DELETE] ON ALL TABLES IN SCHEMA ... TO <role>
 *  5. Return connection string built with temp role
 *  6. Schedule async DROP ROLE after TTL + 30s grace period
 *
 * The admin URI is never logged; only the roleNames and node codes appear in logs.
 */
const { Client } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getCredential } = require('./credentials');
const pino = require('pino');

const logger = pino({ name: 'kavacha-pg', level: process.env.LOG_LEVEL || 'info' });

const TTL_MINUTES = 15;
const CLEANUP_GRACE_MS = 30_000; // 30s after expiry before DROP

/**
 * Parses a Postgres URI and extracts host and dbname without logging credentials.
 * Returns { host, dbName } or throws on parse failure.
 */
const parseAdminUri = (adminUri) => {
  try {
    const u = new URL(adminUri);
    return { host: u.host, dbName: u.pathname.replace(/^\//, '') };
  } catch {
    // Fallback manual parse for non-standard URIs
    const atIdx = adminUri.lastIndexOf('@');
    const hostPart = adminUri.slice(atIdx + 1);
    const slashIdx = hostPart.indexOf('/');
    const host   = slashIdx === -1 ? hostPart : hostPart.slice(0, slashIdx);
    const rest   = slashIdx === -1 ? '' : hostPart.slice(slashIdx + 1);
    const dbName = rest.split('?')[0] || 'postgres';
    return { host, dbName };
  }
};

/**
 * Builds a safe connection string for the temporary role.
 * Encodes password to handle special chars.
 */
const buildConnectionString = (host, dbName, roleName, password) => {
  const encodedPass = encodeURIComponent(password);
  return postgres://:@System.Management.Automation.Internal.Host.InternalHost/;
};

/**
 * Schedules an async cleanup (DROP ROLE) after the credential expires.
 * Uses a simple timer — survivable for single-instance deployments.
 * For multi-instance, upgrade to a Redis-backed queue.
 */
const scheduleCleanup = (adminUri, roleName, delayMs) => {
  setTimeout(async () => {
    const client = new Client({ connectionString: adminUri, statement_timeout: 10_000 });
    try {
      await client.connect();
      await client.query(DROP ROLE IF EXISTS );
      logger.info({ roleName }, 'Temp role cleaned up');
    } catch (err) {
      logger.error({ roleName, err: err.message }, 'Failed to clean up temp role');
    } finally {
      await client.end().catch(() => {});
    }
  }, delayMs).unref(); // unref so timer doesn't block process exit
};

/**
 * Issues a short-lived Neon credential for the given tenant.
 *
 * @param {string} nodeCode   - e.g. 'node-n1'
 * @param {string} tenantId   - e.g. 'tenant_abc123'
 * @param {'read'|'readwrite'} operation
 * @returns {{ connectionString: string, roleName: string, expiresAt: string }}
 */
const issueNeonCredential = async (nodeCode, tenantId, operation = 'read') => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'pg-neon') {
    throw new Error(Invalid nodeCode or credential type: );
  }

  // Sanitize tenantId and operation to prevent SQL injection via identifiers
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) {
    throw new Error('Invalid tenantId format');
  }
  if (!['read', 'readwrite'].includes(operation)) {
    throw new Error(Invalid operation: );
  }

  const uid        = uuidv4().replace(/-/g, '').slice(0, 20);
  const roleName   = nanta_tmp_;
  const password   = crypto.randomBytes(48).toString('base64url');
  const schemaName = nanta_proj_;
  const expiresAt  = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

  const { host, dbName } = parseAdminUri(creds.adminUri);
  const client = new Client({
    connectionString: creds.adminUri,
    statement_timeout: 15_000,
    connect_timeout:   10,
  });

  try {
    await client.connect();

    // Create the ephemeral role — use /-style params where possible
    await client.query(
      CREATE ROLE  WITH LOGIN PASSWORD  VALID UNTIL ,
      [password, expiresAt]
    );

    // Grant schema access
    await client.query(GRANT USAGE ON SCHEMA  TO );

    if (operation === 'readwrite') {
      await client.query(
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA  TO 
      );
      await client.query(
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA  TO 
      );
    } else {
      await client.query(
        GRANT SELECT ON ALL TABLES IN SCHEMA  TO 
      );
    }

    logger.info(
      { nodeCode, tenantId, operation, roleName, expiresAt },
      'Issued pg-neon credential'
    );

    const connectionString = buildConnectionString(host, dbName, roleName, password);

    // Schedule cleanup after TTL + grace period
    const cleanupDelayMs = TTL_MINUTES * 60 * 1000 + CLEANUP_GRACE_MS;
    scheduleCleanup(creds.adminUri, roleName, cleanupDelayMs);

    return { connectionString, roleName, expiresAt };
  } catch (err) {
    // Attempt to roll back role creation on failure
    try { await client.query(DROP ROLE IF EXISTS ); } catch {}
    logger.error({ nodeCode, tenantId, err: err.message }, 'Failed to issue pg-neon credential');
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
};

module.exports = { issueNeonCredential };
