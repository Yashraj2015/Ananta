'use strict';
const crypto = require('crypto');

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [headerB64, payloadB64, sigB64] = parts;
  const payload = JSON.parse(base64urlDecode(payloadB64));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  if (secret) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (expected !== sigB64) throw new Error('Invalid signature');
  }
  return payload;
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'ANANTA_4010', message: 'Authentication required' } });
  }
  try {
    const token = authHeader.slice(7);
    const payload = verifyJwt(token, process.env.ANANTA_JWT_SECRET);
    req.user   = payload;
    req.tenant = payload.sub || payload.tenant_id || 'default';
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'ANANTA_4011', message: 'Invalid or expired token' } });
  }
}

module.exports = authenticate;
