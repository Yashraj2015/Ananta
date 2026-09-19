'use strict';
const https   = require('https');
const fs      = require('fs');
const { log } = require('../utils/logger');

class AnantaError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AnantaError';
    this.code = code || 'KAVACHA_ERR';
  }
}

const tokenCache = new Map();
let _certBuf = null, _keyBuf = null;

function loadCerts() {
  if (_certBuf && _keyBuf) return;
  const certPath = process.env.KAVACHA_MTLS_CERT_PATH;
  const keyPath  = process.env.KAVACHA_MTLS_KEY_PATH;
  if (!certPath || !keyPath) return; // dev mode without certs is allowed
  try {
    _certBuf = fs.readFileSync(certPath);
    _keyBuf  = fs.readFileSync(keyPath);
  } catch (_) {}
}

function httpsRequest(url, body, sharedSecret) {
  return new Promise((resolve, reject) => {
    loadCerts();
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);
    const reqOpts = {
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Content-Length':  Buffer.byteLength(payload),
        'X-Kavacha-Secret': sharedSecret
      },
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    };
    if (_certBuf) { reqOpts.cert = _certBuf; reqOpts.key = _keyBuf; }

    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
        } else {
          reject(new AnantaError('Credential vault request failed', 'KAVACHA_HTTP_ERR'));
        }
      });
    });
    req.on('error', () => reject(new AnantaError('Credential vault unreachable', 'KAVACHA_UNREACHABLE')));
    req.setTimeout(8000, () => { req.destroy(); reject(new AnantaError('Credential vault timed out', 'KAVACHA_TIMEOUT')); });
    req.write(payload);
    req.end();
  });
}

async function requestToken(nodeCode, operation, tenantId) {
  const cacheKey = tenantId ? (nodeCode + ':' + operation + ':' + tenantId) : (nodeCode + ':' + operation);
  const cached   = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached;

  const kavachaUrl    = process.env.KAVACHA_URL;
  const sharedSecret  = process.env.KAVACHA_SHARED_SECRET;

  // Dev mode: no Kavacha configured — return env vars directly so server starts without Kavacha
  if (!kavachaUrl || !sharedSecret) {
    log.warn('[kavacha] not configured — returning dev stub credential');
    return { credential: { uri: process.env['DEV_' + nodeCode.toUpperCase().replace(/-/g,'_') + '_URI'] || '' }, expiresAt: Date.now() + 3600000 };
  }

  const payload = { nodeCode, operation };
  if (tenantId) payload.tenantId = tenantId;

  let result;
  try {
    result = await httpsRequest(kavachaUrl + '/token', payload, sharedSecret);
  } catch (err) {
    log.error('[kavacha] token request failed', { code: err.code });
    throw new AnantaError('Credential vault unavailable', err.code || 'KAVACHA_ERR');
  }

  if (!result || !result.credential) {
    throw new AnantaError('Invalid credential vault response', 'KAVACHA_INVALID');
  }

  const token = {
    credential: result.credential,
    expiresAt:  typeof result.expiresAt === 'number' ? result.expiresAt : new Date(result.expiresAt).getTime()
  };
  tokenCache.set(cacheKey, token);
  return token;
}

function clearCache(nodeCode) {
  for (const key of tokenCache.keys()) {
    if (key.startsWith(nodeCode + ':')) tokenCache.delete(key);
  }
}

module.exports = { requestToken, clearCache, AnantaError };
