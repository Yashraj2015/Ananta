'use strict';
const express = require('express');
const router  = express.Router();
const { log } = require('../../utils/logger');

// Internal broker — used by ananta-shim.js to get MONGO_URI for LibreChat
// Only callable with the correct INTERNAL_BROKER_KEY header
router.get('/broker', async (req, res) => {
  const key = req.headers['x-ananta-internal-key'];
  if (!key || key !== process.env.INTERNAL_BROKER_KEY) {
    return res.status(401).json({ error: { code: 'ANANTA_4010', message: 'Unauthorized' } });
  }
  try {
    const kavacha  = require('../../kavacha-client');
    const registry = require('../../directory/registry');
    const node = registry.getActiveAtlasNode();
    if (!node) throw new Error('No active node available');
    const { credential } = await kavacha.requestToken(node.code, 'write', 'smars-internal');
    const r2node = registry.getActiveR2Bucket();
    let s3Creds = {};
    if (r2node) {
      const r2 = await kavacha.requestToken(r2node.code, 'write');
      s3Creds = {
        s3Endpoint: r2.credential.endpoint,
        s3Bucket:   r2.credential.bucket,
        s3Key:      r2.credential.accessKey,
        s3Secret:   r2.credential.secretKey
      };
    }
    res.json({
      mongoUri: credential.uri,
      ...s3Creds
    });
  } catch (err) {
    log.error('[broker] failed to issue internal credentials');
    res.status(503).json({ error: { code: 'ANANTA_5031', message: 'Internal broker unavailable' } });
  }
});

module.exports = router;
