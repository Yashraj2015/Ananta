'use strict';
/**
 * atlas-issuer.js — Issues Atlas (MongoDB) credentials.
 *
 * Atlas connection strings are long-lived and managed via password rotation.
 * This issuer returns the current URI from the vault with a 1-hour in-memory
 * cache to avoid redundant credential lookups, and respects cache invalidation
 * from the rotator.
 *
 * The URI is never logged — only nodeCode and expiry timestamps appear in logs.
 */
const { getCredential } = require('./credentials');
const pino = require('pino');

const logger = pino({ name: 'kavacha-atlas', level: process.env.LOG_LEVEL || 'info' });

/** @type {Map<string, { uri: string, expiresAtMs: number }>} */
const atlasCache = new Map();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns the Atlas connection URI for the given nodeCode.
 * Uses a 1-hour in-memory cache; invalidated when the rotator calls clearAtlasCache().
 *
 * @param {string} nodeCode - e.g. 'node-a1'
 * @returns {{ uri: string, expiresAt: string }}
 */
const issueAtlasCredential = (nodeCode) => {
  const now = Date.now();
  const cached = atlasCache.get(nodeCode);

  if (cached && cached.expiresAtMs > now) {
    logger.debug({ nodeCode, cached: true }, 'Atlas credential served from cache');
    return {
      uri:       cached.uri,
      expiresAt: new Date(cached.expiresAtMs).toISOString(),
    };
  }

  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'atlas') {
    throw new Error(Invalid nodeCode or credential type for Atlas: );
  }
  if (!creds.uri) {
    throw new Error(Atlas URI not configured for );
  }

  const expiresAtMs = now + CACHE_TTL_MS;

  atlasCache.set(nodeCode, {
    uri: creds.uri,
    expiresAtMs,
  });

  logger.info({ nodeCode, expiresAt: new Date(expiresAtMs).toISOString() }, 'Issued atlas credential');

  return {
    uri:       creds.uri,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
};

/**
 * Clears the atlas cache for one node or all nodes.
 * Called by the rotator after a password change so the next request
 * picks up the fresh URI.
 *
 * @param {string|undefined} nodeCode - if omitted, clears entire cache
 */
const clearAtlasCache = (nodeCode) => {
  if (nodeCode) {
    atlasCache.delete(nodeCode);
    logger.info({ nodeCode }, 'Atlas cache cleared for node');
  } else {
    atlasCache.clear();
    logger.info('Atlas cache cleared for all nodes');
  }
};

/**
 * Returns cache status for all atlas nodes (no secrets exposed).
 */
const getAtlasCacheStatus = () => {
  const now = Date.now();
  const status = [];
  for (const [code, entry] of atlasCache.entries()) {
    status.push({
      nodeCode:  code,
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
      expired:   entry.expiresAtMs <= now,
    });
  }
  return status;
};

module.exports = { issueAtlasCredential, clearAtlasCache, getAtlasCacheStatus };
