'use strict';
const fs   = require('fs');
const path = require('path');
const pino = require('pino');
const logger = pino({ name: 'kavacha-audit', level: 'info' });

const LOG_PATH = process.env.KAVACHA_AUDIT_LOG || path.join(__dirname, '../../audit.log');
let stream;

const initAuditLog = () => {
  stream = fs.createWriteStream(LOG_PATH, { flags: 'a', encoding: 'utf8' });
  stream.on('error', (err) => logger.error({ err: err.message }, 'Audit log write error'));
  logger.info({ path: LOG_PATH }, 'Audit log initialized');
};

// Append-only audit entry. Codenames only — never real URIs.
const audit = (event, context = {}) => {
  const entry = JSON.stringify({ ts: new Date().toISOString(), event, ...context }) + '\n';
  if (stream) stream.write(entry);
};

module.exports = { initAuditLog, audit };
