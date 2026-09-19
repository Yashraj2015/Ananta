const express = require('express');
const { getRecentAuditLogs } = require('../audit/logger');

const healthz = express.Router();
healthz.get('/', (req, res) => res.json({ status: 'ok' }));

const audit = express.Router();
audit.get('/', (req, res) => {
  if (req.headers['x-kavacha-admin'] !== 'true') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(getRecentAuditLogs(20));
});

module.exports = { healthz, audit };
