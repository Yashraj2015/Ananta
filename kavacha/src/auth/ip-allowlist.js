const { sendAlert } = require('../alerts/webhook');
const pino = require('pino');
const logger = pino({ name: 'kavacha-ip' });

const ipAllowlist = async (req, res, next) => {
  const allowedIps = (process.env.ALLOWED_IPS || '127.0.0.1').split(',').map(ip => ip.trim());
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!allowedIps.includes(clientIp)) {
    logger.warn(`[KAVACHA] Rejected unknown IP: ${clientIp}`);
    await sendAlert({
      event: 'UNKNOWN_IP',
      ip: clientIp,
      details: 'Rejected unknown IP address attempting to connect.'
    });
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

module.exports = { ipAllowlist };
