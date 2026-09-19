const { sendAlert } = require('../alerts/webhook');
const pino = require('pino');
const logger = pino({ name: 'kavacha-mtls' });

const verifyMtls = async (req, res, next) => {
  if (!req.client.authorized) {
    logger.warn('[KAVACHA] mTLS authorization failed.');
    await sendAlert({
      event: 'MTLS_FAILED',
      ip: req.socket.remoteAddress,
      details: 'mTLS authorization failed or missing client certificate.'
    });
    return res.status(401).json({ error: 'Unauthorized: invalid client certificate' });
  }

  const cert = req.socket.getPeerCertificate();
  if (!cert || !cert.subject) {
    return res.status(401).json({ error: 'Unauthorized: Missing certificate subject' });
  }

  // Optional: verify subject matches expected Ananta client cert
  // e.g. if (cert.subject.CN !== 'ananta-client') { ... }

  next();
};

module.exports = { verifyMtls };
