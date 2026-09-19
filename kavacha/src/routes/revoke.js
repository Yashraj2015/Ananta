const express = require('express');
const router = express.Router();
const { clearAtlasCache } = require('../vault/atlas-issuer');
const { clearSimpleCache } = require('../vault/cache-issuer');
const { sendAlert } = require('../alerts/webhook');
const { appendAuditLog } = require('../audit/logger');
// In a full implementation, you would also drop specific PG roles

router.post('/', async (req, res) => {
  const { nodeCode, tenantId, all } = req.body;
  
  if (all) {
    clearAtlasCache();
    clearSimpleCache();
  } else if (nodeCode) {
    clearAtlasCache(nodeCode);
    clearSimpleCache(nodeCode);
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  appendAuditLog({
    event: 'EMERGENCY_REVOKE',
    nodeCode,
    tenantId,
    all,
    ip: clientIp
  });

  await sendAlert({
    event: 'EMERGENCY_REVOKE',
    ip: clientIp,
    details: `Revocation requested for ${all ? 'ALL' : nodeCode}`
  });

  res.json({ status: 'revoked' });
});

module.exports = router;
