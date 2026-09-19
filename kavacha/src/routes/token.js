const express = require('express');
const router = express.Router();
const { getCredential } = require('../vault/credentials');
const { issueNeonCredential } = require('../vault/pg-issuer');
const { issueAtlasCredential } = require('../vault/atlas-issuer');
const { issueR2Credential } = require('../vault/r2-issuer');
const { issueCtrlPlaneCredential, issueRedisCredential } = require('../vault/cache-issuer');
const { appendAuditLog } = require('../audit/logger');

router.post('/', async (req, res) => {
  try {
    const { nodeCode, tenantId, operation, key } = req.body;
    if (!nodeCode) return res.status(400).json({ error: 'nodeCode required' });

    const creds = getCredential(nodeCode);
    if (!creds) return res.status(404).json({ error: 'Node not found' });

    let result;
    if (creds.type === 'pg-neon') {
      if (!tenantId) return res.status(400).json({ error: 'tenantId required for pg-neon' });
      result = await issueNeonCredential(nodeCode, tenantId, operation || 'read');
    } else if (creds.type === 'atlas') {
      result = issueAtlasCredential(nodeCode);
    } else if (creds.type === 'r2') {
      if (!key || !operation) return res.status(400).json({ error: 'key and operation required for r2' });
      result = await issueR2Credential(nodeCode, key, operation);
    } else if (creds.type === 'ctrl-plane') {
      result = issueCtrlPlaneCredential(nodeCode);
    } else if (creds.type === 'redis') {
      result = issueRedisCredential(nodeCode);
    } else {
      return res.status(400).json({ error: 'Unsupported type' });
    }

    appendAuditLog({
      event: 'ISSUE_TOKEN',
      nodeCode,
      tenantId,
      operation,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
