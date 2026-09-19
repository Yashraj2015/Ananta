'use strict';
/**
 * cache-issuer.js — Issues cached credentials for Supabase ctrl-plane and Redis/Valkey.
 * Ctrl-plane: 1-hour cache (service role key, no rotation needed from our side)
 * Redis/Valkey: 30-day rotation (URL stored in vault, periodic rotation)
 */
const { getCredential } = require('./credentials');
const pino   = require('pino');
const logger = pino({ name: 'kavacha-cache', level: process.env.LOG_LEVEL || 'info' });

const ctrlCache  = new Map(); // nodeCode -> { serviceKey, url, cachedAt }
const CTRL_TTL   = 60 * 60 * 1000; // 1 hour

const issueCtrlCredential = async (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'ctrl-plane') throw new Error('Invalid ctrl-plane node: ' + nodeCode);
  const cached = ctrlCache.get(nodeCode);
  if (cached && (Date.now() - cached.cachedAt) < CTRL_TTL) {
    return { url: cached.url, serviceKey: cached.serviceKey, expiresAt: new Date(cached.cachedAt + CTRL_TTL).toISOString() };
  }
  ctrlCache.set(nodeCode, { url: creds.url, serviceKey: creds.serviceKey, cachedAt: Date.now() });
  logger.info({ nodeCode }, 'Ctrl-plane credential issued (1-hr cache)');
  return { url: creds.url, serviceKey: creds.serviceKey, expiresAt: new Date(Date.now() + CTRL_TTL).toISOString() };
};

const issueRedisCredential = async (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'redis') throw new Error('Invalid redis node: ' + nodeCode);
  logger.info({ nodeCode }, 'Valkey credential issued');
  return { url: creds.url, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
};

module.exports = { issueCtrlCredential, issueRedisCredential };
