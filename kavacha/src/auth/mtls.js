'use strict';
const pino   = require('pino');
const logger = pino({ name: 'kavacha-mtls', level: 'info' });

// In dev: skip mTLS cert check (no certs configured)
// In prod: Express https.createServer with requestCert:true, rejectUnauthorized:true
function verifyMtls(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();

  const cert = req.socket?.getPeerCertificate?.();
  if (!cert || !cert.subject) {
    logger.warn('[mtls] client cert missing');
    return res.status(401).json({ error: 'Client certificate required' });
  }

  const allowedCN = process.env.KAVACHA_ALLOWED_CN || 'ananta-server';
  if (cert.subject.CN !== allowedCN) {
    logger.warn({ cn: cert.subject.CN }, '[mtls] cert CN mismatch');
    return res.status(403).json({ error: 'Invalid client certificate' });
  }
  next();
}

module.exports = { verifyMtls };
