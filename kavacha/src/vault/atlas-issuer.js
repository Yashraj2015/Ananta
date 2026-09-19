const { getCredential } = require('./credentials');
const pino = require('pino');
const logger = pino({ name: 'kavacha-atlas' });

const atlasCache = new Map();

const issueAtlasCredential = (nodeCode) => {
  const now = Date.now();
  const cached = atlasCache.get(nodeCode);

  if (cached && cached.expiresAtMs > now) {
    return { uri: cached.uri, expiresAt: new Date(cached.expiresAtMs).toISOString() };
  }

  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'atlas') throw new Error('Invalid nodeCode or type');

  const ttl = 60 * 60 * 1000; // 1 hour
  const expiresAtMs = now + ttl;

  atlasCache.set(nodeCode, {
    uri: creds.uri,
    expiresAtMs
  });

  logger.info(`[KAVACHA] Issued atlas-cred for ${nodeCode}`);
  return { uri: creds.uri, expiresAt: new Date(expiresAtMs).toISOString() };
};

const clearAtlasCache = (nodeCode) => {
  if (nodeCode) {
    atlasCache.delete(nodeCode);
  } else {
    atlasCache.clear();
  }
};

module.exports = { issueAtlasCredential, clearAtlasCache };
