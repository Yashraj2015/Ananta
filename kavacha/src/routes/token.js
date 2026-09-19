'use strict';
const express  = require('express');
const router   = express.Router();
const { getCredential, listNodes } = require('../vault/credentials');
const { issueNeonCredential }      = require('../vault/pg-issuer');
const { issueAtlasCredential }     = require('../vault/atlas-issuer');
const { issueR2Credential, issuePresignedUpload, issuePresignedDownload } = require('../vault/r2-issuer');
const { issueCtrlCredential, issueRedisCredential } = require('../vault/cache-issuer');
const { audit } = require('../audit/logger');
const pino  = require('pino');
const logger = pino({ name: 'kavacha-token', level: process.env.LOG_LEVEL || 'info' });

// POST /token  { nodeCode, operation, tenantId? }
router.post('/', async (req, res) => {
  const { nodeCode, operation, tenantId, key } = req.body || {};
  if (!nodeCode || !operation) {
    return res.status(400).json({ error: 'nodeCode and operation are required' });
  }

  const creds = getCredential(nodeCode);
  if (!creds) {
    logger.warn({ nodeCode }, 'Token request for unknown node');
    return res.status(404).json({ error: 'Unknown node' });
  }

  try {
    let credential, expiresAt;

    if (creds.type === 'atlas') {
      const result = await issueAtlasCredential(nodeCode);
      credential = { uri: result.uri };
      expiresAt  = result.expiresAt;
    }
    else if (creds.type === 'pg-neon') {
      const op  = (operation === 'read') ? 'read' : 'readwrite';
      const result = await issueNeonCredential(nodeCode, tenantId || 'shared', op);
      credential = { connectionString: result.connectionString };
      expiresAt  = result.expiresAt;
    }
    else if (creds.type === 'r2') {
      if (key && operation === 'upload') {
        const ct = req.body.contentType || 'application/octet-stream';
        const result = await issuePresignedUpload(nodeCode, key, ct);
        credential = { uploadUrl: result.uploadUrl };
        expiresAt  = result.expiresAt;
      } else if (key && operation === 'download') {
        const result = await issuePresignedDownload(nodeCode, key);
        credential = { downloadUrl: result.downloadUrl };
        expiresAt  = result.expiresAt;
      } else {
        const result = await issueR2Credential(nodeCode);
        credential = result;
        expiresAt  = result.expiresAt;
        delete credential.expiresAt;
      }
    }
    else if (creds.type === 'ctrl-plane') {
      const result = await issueCtrlCredential(nodeCode);
      credential = { url: result.url, serviceKey: result.serviceKey };
      expiresAt  = result.expiresAt;
    }
    else if (creds.type === 'redis') {
      const result = await issueRedisCredential(nodeCode);
      credential = { url: result.url };
      expiresAt  = result.expiresAt;
    }
    else {
      return res.status(400).json({ error: 'Unsupported node type' });
    }

    audit('TOKEN_ISSUED', { nodeCode, operation, tenantId: tenantId || null });
    return res.json({ credential, expiresAt, nodeCode });

  } catch (err) {
    logger.error({ nodeCode, operation, err: err.message }, 'Token issuance failed');
    audit('TOKEN_FAILED', { nodeCode, operation, reason: err.message });
    return res.status(500).json({ error: 'Token issuance failed' });
  }
});

module.exports = router;
