'use strict';
/**
 * atlas-issuer.js — Returns Atlas credentials with 7-day rotation cache.
 * Atlas has no VALID UNTIL support, so we cache the credential and rotate
 * the password every 7 days via Atlas Admin API.
 */
const { getCredential } = require('./credentials');
const pino   = require('pino');
const logger = pino({ name: 'kavacha-atlas', level: process.env.LOG_LEVEL || 'info' });

// Cache: nodeCode -> { uri, cachedAt }
const cache = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const issueAtlasCredential = async (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'atlas') throw new Error('Invalid atlas node: ' + nodeCode);

  const cached = cache.get(nodeCode);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
    return { uri: cached.uri, expiresAt: new Date(cached.cachedAt + CACHE_TTL_MS).toISOString() };
  }

  // Return current URI from vault (rotation is handled by atlas-rotator.js separately)
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  cache.set(nodeCode, { uri: creds.uri, cachedAt: Date.now() });
  logger.info({ nodeCode }, 'Atlas credential issued (7-day cache)');
  return { uri: creds.uri, expiresAt };
};

// Called by atlas-rotator after password is changed on Atlas side
const invalidateCache = (nodeCode) => {
  cache.delete(nodeCode);
  logger.info({ nodeCode }, 'Atlas credential cache invalidated');
};

module.exports = { issueAtlasCredential, invalidateCache };
