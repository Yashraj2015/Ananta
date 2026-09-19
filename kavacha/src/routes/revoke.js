'use strict';
/**
 * revoke.js — POST /revoke
 *
 * Emergency revocation endpoint. Clears in-memory credential caches and
 * optionally drops active pg-neon roles by roleName.
 *
 * Body:
 *   { nodeCode?: string, tenantId?: string, all?: boolean, roleName?: string }
 *
 * If ll is true, clears ALL cached credentials across all nodes.
 * If 
odeCode is set, clears only that node's cache.
 * If oleName is set alongside a 
odeCode of type pg-neon, drops that role immediately.
 *
 * Fires a Telegram/Discord alert and writes an audit entry on every revocation.
 */
const express = require('express');
const router  = express.Router();

const { clearAtlasCache }    = require('../vault/atlas-issuer');
const { clearSimpleCache }   = require('../vault/cache-issuer');
const { getCredential }      = require('../vault/credentials');
const { sendAlert }          = require('../alerts/webhook');
const { appendAuditLog }     = require('../audit/logger');
const { Client }             = require('pg');
const pino = require('pino');

const logger = pino({ name: 'kavacha-revoke', level: process.env.LOG_LEVEL || 'info' });

/** Extracts real client IP */
const getClientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket.remoteAddress;

/**
 * Attempts to DROP a PostgreSQL role from the given Neon node.
 * Errors are logged but do NOT fail the HTTP response — cache invalidation
 * is the primary guarantee; PG cleanup is best-effort.
 */
const dropPgRole = async (nodeCode, roleName) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'pg-neon') return;

  // Sanitize roleName — only allow safe identifier chars
  if (!/^ananta_tmp_[a-z0-9]+$/.test(roleName)) {
    logger.warn({ nodeCode, roleName }, 'Skipping DROP ROLE — roleName failed safety check');
    return;
  }

  const client = new Client({ connectionString: creds.adminUri, statement_timeout: 10_000 });
  try {
    await client.connect();
    await client.query(DROP ROLE IF EXISTS );
    logger.info({ nodeCode, roleName }, 'Role dropped via revoke');
  } catch (err) {
    logger.error({ nodeCode, roleName, err: err.message }, 'Failed to drop role via revoke');
  } finally {
    await client.end().catch(() => {});
  }
};

router.post('/', async (req, res) => {
  const { nodeCode, tenantId, all, roleName } = req.body || {};
  const clientIp = getClientIp(req);
  const actions  = [];

  // ── Clear credential caches ─────────────────────────────────────────────────
  if (all) {
    clearAtlasCache();
    clearSimpleCache();
    actions.push('cleared all caches');
    logger.warn({ clientIp }, 'EMERGENCY: All credential caches cleared');
  } else if (nodeCode) {
    if (typeof nodeCode !== 'string' || !/^[a-z0-9-]+$/.test(nodeCode)) {
      return res.status(400).json({ error: 'Invalid nodeCode format' });
    }
    clearAtlasCache(nodeCode);
    clearSimpleCache(nodeCode);
    actions.push(cleared cache for );
    logger.warn({ nodeCode, clientIp }, 'Cache cleared for node via revoke');
  } else {
    return res.status(400).json({ error: 'Provide nodeCode or all:true' });
  }

  // ── Optional: immediate PG role drop ───────────────────────────────────────
  if (roleName && nodeCode) {
    await dropPgRole(nodeCode, roleName);
    actions.push(dropped role );
  }

  // ── Audit + alert ──────────────────────────────────────────────────────────
  appendAuditLog({
    event:    'EMERGENCY_REVOKE',
    nodeCode: nodeCode || 'ALL',
    tenantId: tenantId || null,
    roleName: roleName || null,
    all:      !!all,
    ip:       clientIp,
    actions,
  });

  await sendAlert({
    event:    'EMERGENCY_REVOKE',
    nodeCode: nodeCode || 'ALL',
    ip:       clientIp,
    details:  Revocation executed: ,
  });

  return res.json({ status: 'revoked', actions });
});

module.exports = router;
