'use strict';
const { log } = require('../utils/logger');

const VENDOR_PATTERNS = [
  /neon\.tech/gi, /supabase\.co/gi, /mongodb\.net/gi,
  /atlas\.mongodb/gi, /cloudflare\.com/gi, /upstash\.io/gi,
  /ferretdb/gi, /postgrest/gi, /pgcat/gi, /railway\.app/gi,
  /fly\.io/gi, /render\.com/gi
];

function sanitizeError(err, req, res, next) {
  let message = err.message || 'Internal Server Error';
  for (const p of VENDOR_PATTERNS) message = message.replace(p, 'ananta-internal');
  const status = err.status || 500;
  log.error('[api] error', { url: req.url, code: err.code || status });
  res.status(status).json({ error: { code: err.code || 'ANANTA_5001', message } });
}

module.exports = sanitizeError;
