'use strict';
const express = require('express');
const router  = express.Router();
const { listNodes } = require('../vault/credentials');

const healthz = (req, res) => {
  res.json({ status: 'ok', ts: Date.now(), nodes: listNodes().length });
};

const auditRecent = (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const logPath = process.env.KAVACHA_AUDIT_LOG || path.join(__dirname, '../../audit.log');
  try {
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').slice(-20);
    res.json({ recent: lines.map(l => { try { return JSON.parse(l); } catch { return l; } }) });
  } catch {
    res.json({ recent: [] });
  }
};

module.exports = { healthz, audit: auditRecent };
