'use strict';
const https = require('https');
const fs = require('fs');
const { log } = require('../utils/logger');

class AnantaError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AnantaError';
    this.code = code || 'KAVACHA_ERR';
  }
}

const tokenCache = new Map();

let _certBuf = null;
let _keyBuf = null;

function loadCerts() {
  if (_certBuf && _keyBuf) return;
  const certPath = process.env.KAVACHA_MTLS_CERT_PATH;
  const keyPath  = process.env.KAVACHA_MTLS_KEY_PATH;
  if (!certPath || !keyPath) {
    throw new AnantaError('mTLS cert/key paths not configured', 'KAVACHA_NOCERT');
  }
  _certBuf = fs.readFileSync(certPath);
  _keyBuf  = fs.readFileSync(keyPath);
}

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + (parsed.search || ''),
      method: options.method || 'POST',
      headers: options.headers || {},
      cert: _certBuf,
      key: _keyBuf,
      rejectUnauthorized: true,
    };

    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve(data); }
        } else {
          reject(new AnantaError(
            Credential vault returned status ,
            'KAVACHA_HTTP_ERR'
          ));
        }
      });
    });

    req.on('error', (err) => {
      reject(new AnantaError(
        'Credential vault unreachable',
        'KAVACHA_UNREACHABLE'
      ));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new AnantaError('Credential vault request timed out', 'KAVACHA_TIMEOUT'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * requestToken(nodeCode, operation, tenantId?)
 * Returns { credential, expiresAt }
 * Caches tokens until (expiresAt - 30 seconds).
 */
async function requestToken(nodeCode, operation, tenantId) {
  const cacheKey = tenantId
    ? ${nodeCode}::
    : ${nodeCode}:;

  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30000) {
    return cached;
  }

  const kavachaUrl = process.env.KAVACHA_URL;
  const sharedSecret = process.env.KAVACHA_SHARED_SECRET;

  if (!kavachaUrl || !sharedSecret) {
    throw new AnantaError('Credential vault URL or shared secret not configured', 'KAVACHA_NOCONFIG');
  }

  try {
    loadCerts();
  } catch (err) {
    throw err;
  }

  const payload = { nodeCode, operation };
  if (tenantId) payload.tenantId = tenantId;

  let result;
  try {
    result = await httpsRequest(
      ${kavachaUrl}/v1/tokens,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kavacha-Secret': sharedSecret,
        },
      },
      payload
    );
  } catch (err) {
    // Sanitize any vendor names from the error message
    const safeMsg = err.message.replace(/kavacha/gi, 'credential-vault');
    log.error('[kavacha] token request failed', { code: err.code, msg: safeMsg });
    throw new AnantaError(safeMsg, err.code || 'KAVACHA_ERR');
  }

  if (!result || !result.credential || !result.expiresAt) {
    throw new AnantaError('Invalid response from credential vault', 'KAVACHA_INVALID_RESP');
  }

  const token = {
    credential: result.credential,
    expiresAt: typeof result.expiresAt === 'number'
      ? result.expiresAt
      : new Date(result.expiresAt).getTime(),
  };

  tokenCache.set(cacheKey, token);
  log.debug('[kavacha] token cached', { nodeCode, operation, cacheKey });
  return token;
}

function clearCache(nodeCode) {
  for (const key of tokenCache.keys()) {
    if (key.startsWith(nodeCode + ':')) {
      tokenCache.delete(key);
    }
  }
}

module.exports = { requestToken, clearCache, AnantaError };
