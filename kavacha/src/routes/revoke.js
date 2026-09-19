'use strict';
const express = require('express');
const router  = express.Router();
const { audit } = require('../audit/logger');
const { sendAlert } = require('../alerts/webhook');
const pino   = require('pino');
const logger = pino({ name: 'kavacha-revoke', level: 'info' });

// POST /revoke { nodeCode, reason }
router.post('/', async (req, res) => {
  const { nodeCode, reason } = req.body || {};
  if (!nodeCode) return res.status(400).json({ error: 'nodeCode required' });

  logger.warn({ nodeCode, reason }, 'Emergency revocation triggered');
  audit('REVOKE_TRIGGERED', { nodeCode, reason: reason || 'manual' });
  await sendAlert('Emergency revoke for ' + nodeCode + ' — reason: ' + (reason || 'manual'));

  // For now: invalidate atlas cache if applicable
  try {
    const { invalidateCache } = require('../vault/atlas-issuer');
    invalidateCache(nodeCode);
  } catch (_) {}

  res.json({ success: true, message: 'Revocation recorded. Manual credential rotation required.' });
});

module.exports = router;
