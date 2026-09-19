'use strict';
const pino   = require('pino');
const logger = pino({ name: 'kavacha-ip', level: 'info' });

// Comma-separated list of allowed IPs (CIDR not yet supported — exact match only)
const ALLOWED = (process.env.KAVACHA_ALLOWED_IPS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const BYPASS_IN_DEV = process.env.NODE_ENV !== 'production';

function ipAllowlist(req, res, next) {
  if (BYPASS_IN_DEV || ALLOWED.length === 0) return next(); // open in dev

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
          || req.socket?.remoteAddress
          || '';

  if (!ALLOWED.includes(ip)) {
    logger.warn({ ip }, '[ip-allowlist] rejected');
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = { ipAllowlist };
