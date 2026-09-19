'use strict';
/**
 * cache-issuer.js — Issues cached credentials for long-lived service tokens
 * (ctrl-plane nodes and Valkey/Redis nodes).
 *
 * These credential types do not support per-request ephemeral issuance, so
 * we return the static service key with a 1-hour TTL refresh from vault.
 * The cache is purely for latency (avoiding repeated vault lookups) and
 * allows instant invalidation via clearSimpleCache().
 *
 * Keys and service tokens are never logged — only nodeCode and expiry.
 */
const { getCredential } = require('./credentials');
const pino = require('pino');

const logger = pino({ name: 'kavacha-cache', level: process.env.LOG_LEVEL || 'info' });

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * @typedef {{ data: object, expiresAtMs: number }} CacheEntry
 * @type {Map<string, CacheEntry>}
 */
const simpleCache = new Map();

/**
 * Generic cache fetch with configurable TTL.
 * Builds the data object from the vault entry on cache miss.
 *
 * @param {string} nodeCode
 * @param {number} ttlMs
 * @returns {object} - the cached data object (no secrets in log)
 */
const getCachedCredential = (nodeCode, ttlMs = DEFAULT_TTL_MS) => {
  const now    = Date.now();
  const cached = simpleCache.get(nodeCode);

  if (cached && cached.expiresAtMs > now) {
    logger.debug({ nodeCode }, 'Served credential from cache');
    return cached.data;
  }

  const creds = getCredential(nodeCode);
  if (!creds) throw new Error(No credential found for node: );

  const expiresAtMs = now + ttlMs;
  const expiresAt   = new Date(expiresAtMs).toISOString();

  let data;
  switch (creds.type) {
    case 'ctrl-plane':
      if (!creds.url || !creds.serviceKey) {
        throw new Error(Incomplete ctrl-plane config for );
      }
      data = {
        url:       creds.url,
        key:       creds.serviceKey,
        expiresAt,
      };
      break;

    case 'redis':
      if (!creds.url) {
        throw new Error(Incomplete redis/valkey config for );
      }
      data = {
        url:       creds.url,
        expiresAt,
      };
      break;

    default:
      throw new Error(Unsupported credential type for cache issuer: );
  }

  simpleCache.set(nodeCode, { data, expiresAtMs });
  logger.info({ nodeCode, type: creds.type, expiresAt }, 'Issued cached credential');

  return data;
};

/**
 * Issues a ctrl-plane (Supabase) credential with 1-hour cache.
 * Returns { url, key, expiresAt }.
 *
 * @param {string} nodeCode - e.g. 'node-s1'
 */
const issueCtrlPlaneCredential = (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'ctrl-plane') {
    throw new Error(Not a ctrl-plane node: );
  }
  return getCachedCredential(nodeCode, DEFAULT_TTL_MS);
};

/**
 * Issues a Redis/Valkey credential with 1-hour cache.
 * Returns { url, expiresAt }.
 *
 * @param {string} nodeCode - e.g. 'node-vk1'
 */
const issueRedisCredential = (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'redis') {
    throw new Error(Not a redis/valkey node: );
  }
  return getCachedCredential(nodeCode, DEFAULT_TTL_MS);
};

/**
 * Invalidates the cache for one node or all nodes.
 * Next call will re-fetch fresh from the vault.
 *
 * @param {string|undefined} nodeCode - if omitted, clears all entries
 */
const clearSimpleCache = (nodeCode) => {
  if (nodeCode) {
    simpleCache.delete(nodeCode);
    logger.info({ nodeCode }, 'Cache cleared for node');
  } else {
    simpleCache.clear();
    logger.info('Cache cleared for all nodes');
  }
};

/**
 * Returns cache status (no secret values exposed).
 */
const getCacheStatus = () => {
  const now    = Date.now();
  const result = [];
  for (const [code, entry] of simpleCache.entries()) {
    result.push({
      nodeCode:  code,
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
      expired:   entry.expiresAtMs <= now,
    });
  }
  return result;
};

module.exports = {
  issueCtrlPlaneCredential,
  issueRedisCredential,
  clearSimpleCache,
  getCacheStatus,
};
