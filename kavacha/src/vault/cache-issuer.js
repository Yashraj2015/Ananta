const { getCredential } = require('./credentials');
const pino = require('pino');
const logger = pino({ name: 'kavacha-cache' });

const simpleCache = new Map();

const getCachedCredential = (nodeCode, ttlMs) => {
  const now = Date.now();
  const cached = simpleCache.get(nodeCode);
  if (cached && cached.expiresAtMs > now) {
    return cached.data;
  }

  const creds = getCredential(nodeCode);
  if (!creds) throw new Error('Invalid nodeCode');

  const expiresAtMs = now + ttlMs;
  const expiresAt = new Date(expiresAtMs).toISOString();
  
  let data;
  if (creds.type === 'ctrl-plane') {
    data = { url: creds.url, key: creds.serviceKey, expiresAt };
  } else if (creds.type === 'redis') {
    data = { url: creds.url, expiresAt };
  } else {
    throw new Error('Unsupported credential type for cache');
  }

  simpleCache.set(nodeCode, { data, expiresAtMs });
  logger.info(`[KAVACHA] Issued cached-cred for ${nodeCode}`);
  
  return data;
};

const issueCtrlPlaneCredential = (nodeCode) => {
  return getCachedCredential(nodeCode, 60 * 60 * 1000); // 1 hr
};

const issueRedisCredential = (nodeCode) => {
  return getCachedCredential(nodeCode, 60 * 60 * 1000);
};

const clearSimpleCache = (nodeCode) => {
  if (nodeCode) {
    simpleCache.delete(nodeCode);
  } else {
    simpleCache.clear();
  }
};

module.exports = { issueCtrlPlaneCredential, issueRedisCredential, clearSimpleCache };
