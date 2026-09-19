'use strict';
/**
 * token.js — POST /token
 *
 * Request body:
 *   { nodeCode: string, operation: string, tenantId?: string, key?: string, options?: object }
 *
 * Response:
 *   { credential: object, expiresAt: string, nodeCode: string }
 *
 * nodeCode → credential type routing:
 *   node-a{n}   → atlas        → issueAtlasCredential
 *   node-n{n}   → pg-neon      → issueNeonCredential   (requires tenantId)
 *   node-r2{x}  → r2           → issueR2Credential     (requires key + operation)
 *   node-s{n}   → ctrl-plane   → issueCtrlPlaneCredential
 *   node-vk{n}  → redis        → issueRedisCredential
 *   node-v{n}   → redis (alias)→ issueRedisCredential
 */
const express = require('express');
const router  = express.Router();

const { getCredential }              = require('../vault/credentials');
const { issueNeonCredential }        = require('../vault/pg-issuer');
const { issueAtlasCredential }       = require('../vault/atlas-issuer');
const { issueR2Credential }          = require('../vault/r2-issuer');
const { issueCtrlPlaneCredential,
        issueRedisCredential }        = require('../vault/cache-issuer');
const { appendAuditLog }             = require('../audit/logger');
const pino = require('pino');

const logger = pino({ name: 'kavacha-token', level: process.env.LOG_LEVEL || 'info' });

/** Extracts real client IP, honouring the X-Forwarded-For header */
const getClientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket.remoteAddress;

router.post('/', async (req, res) => {
  const { nodeCode, tenantId, operation, key, options } = req.body || {};
  const clientIp = getClientIp(req);

  // ── Input validation ────────────────────────────────────────────────────────
  if (!nodeCode || typeof nodeCode !== 'string') {
    return res.status(400).json({ error: 'nodeCode is required' });
  }
  // Only allow alphanumeric + hyphens to prevent injection
  if (!/^[a-z0-9-]+$/.test(nodeCode)) {
    return res.status(400).json({ error: 'Invalid nodeCode format' });
  }

  const creds = getCredential(nodeCode);
  if (!creds) {
    logger.warn({ nodeCode, clientIp }, 'Token request for unknown nodeCode');
    return res.status(404).json({ error: Node not found:  });
  }

  let credential;
  let expiresAt;

  try {
    switch (creds.type) {
      // ── Atlas ──────────────────────────────────────────────────────────────
      case 'atlas': {
        const result = issueAtlasCredential(nodeCode);
        credential   = { uri: result.uri };
        expiresAt    = result.expiresAt;
        break;
      }

      // ── Neon PostgreSQL ────────────────────────────────────────────────────
      case 'pg-neon': {
        if (!tenantId) {
          return res.status(400).json({ error: 'tenantId is required for pg-neon nodes' });
        }
        const op = ['read', 'readwrite'].includes(operation) ? operation : 'read';
        const result = await issueNeonCredential(nodeCode, tenantId, op);
        credential   = { connectionString: result.connectionString, roleName: result.roleName };
        expiresAt    = result.expiresAt;
        break;
      }

      // ── R2 Object Storage ─────────────────────────────────────────────────
      case 'r2': {
        if (!key) {
          return res.status(400).json({ error: 'key is required for r2 nodes' });
        }
        const validOps = ['put', 'get', 'delete', 'head'];
        if (!validOps.includes(operation)) {
          return res.status(400).json({ error: operation must be one of:  });
        }
        const result = await issueR2Credential(nodeCode, key, operation, options || {});
        credential   = { presignedUrl: result.presignedUrl, bucket: result.bucket, key: result.key };
        expiresAt    = result.expiresAt;
        break;
      }

      // ── ctrl-plane (Supabase) ─────────────────────────────────────────────
      case 'ctrl-plane': {
        const result = issueCtrlPlaneCredential(nodeCode);
        credential   = { url: result.url, key: result.key };
        expiresAt    = result.expiresAt;
        break;
      }

      // ── Redis / Valkey ────────────────────────────────────────────────────
      case 'redis': {
        const result = issueRedisCredential(nodeCode);
        credential   = { url: result.url };
        expiresAt    = result.expiresAt;
        break;
      }

      default:
        return res.status(400).json({ error: Unsupported node type:  });
    }
  } catch (err) {
    logger.error({ nodeCode, err: err.message }, 'Failed to issue credential');

    appendAuditLog({
      event:     'ISSUE_TOKEN_ERROR',
      nodeCode,
      tenantId,
      operation,
      ip:        clientIp,
      error:     err.message,
    });

    return res.status(500).json({ error: 'Failed to issue credential', detail: err.message });
  }

  appendAuditLog({
    event:     'ISSUE_TOKEN',
    nodeCode,
    tenantId:  tenantId || null,
    operation: operation || null,
    ip:        clientIp,
    expiresAt,
  });

  logger.info({ nodeCode, expiresAt }, 'Token issued successfully');

  return res.json({
    credential,
    expiresAt,
    nodeCode,
  });
});

module.exports = router;
