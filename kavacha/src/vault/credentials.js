'use strict';
/**
 * credentials.js — maps well-known codenames to environment-sourced credentials.
 * Credentials are loaded once at startup into a sealed in-memory vault Map.
 * Nothing that contains a real URI, key, or password is ever logged.
 */
const pino = require('pino');
const logger = pino({ name: 'kavacha-creds', level: process.env.LOG_LEVEL || 'info' });

/** @type {Map<string, object>} */
const vault = new Map();

/**
 * Validates that a required env var is present; logs an error (without value) if not.
 */
const requireEnv = (name) => {
  const v = process.env[name];
  if (!v) logger.warn({ var: name }, 'Missing env var — node may be partially unavailable');
  return v || null;
};

const loadCredentials = () => {
  let loaded = 0;

  // ── node-a{1..3}: Atlas (MongoDB) ──────────────────────────────────────────
  for (let i = 1; i <= 3; i++) {
    const code = 
ode-a;
    const uri = process.env[NODE_A_URI];
    if (!uri) continue;
    vault.set(code, {
      type:       'atlas',
      uri,
      publicKey:  process.env[NODE_A_ADMIN_PUBLIC_KEY]  || null,
      privateKey: process.env[NODE_A_ADMIN_PRIVATE_KEY] || null,
      groupId:    process.env[NODE_A_GROUP_ID]          || null,
      username:   process.env[NODE_A_ADMIN_USERNAME]    || 'admin',
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded atlas node');
  }

  // ── node-n{1..3}: Neon PostgreSQL ──────────────────────────────────────────
  for (let i = 1; i <= 3; i++) {
    const code = 
ode-n;
    const adminUri = process.env[NODE_N_ADMIN_URI];
    if (!adminUri) continue;
    vault.set(code, {
      type:     'pg-neon',
      adminUri,
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded neon node');
  }

  // ── node-s{1..2}: ctrl-plane (Supabase) ────────────────────────────────────
  for (let i = 1; i <= 2; i++) {
    const code = 
ode-s;
    const url        = process.env[NODE_S_URL];
    const serviceKey = process.env[NODE_S_SERVICE_KEY];
    if (!url || !serviceKey) continue;
    vault.set(code, {
      type:       'ctrl-plane',
      url,
      serviceKey,
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded ctrl-plane node');
  }

  // ── node-r2{a,b}: R2 object storage ────────────────────────────────────────
  for (const letter of ['a', 'b']) {
    const code = 
ode-r2;
    const uc   = letter.toUpperCase();
    const accessKey  = process.env[NODE_R2_ACCESS_KEY];
    const secretKey  = process.env[NODE_R2_SECRET_KEY];
    const endpoint   = process.env[NODE_R2_ENDPOINT];
    const bucket     = process.env[NODE_R2_BUCKET];
    const accountId  = process.env[NODE_R2_ACCOUNT_ID];
    if (!accessKey || !secretKey) continue;
    vault.set(code, {
      type:      'r2',
      accessKey,
      secretKey,
      bucket:    bucket    || null,
      endpoint:  endpoint  || (accountId ? https://.r2.cloudflarestorage.com : null),
      accountId: accountId || null,
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded r2 node');
  }

  // ── node-vk{1,2}: Valkey/Redis ─────────────────────────────────────────────
  for (let i = 1; i <= 2; i++) {
    const code = 
ode-vk;
    // Support both NODE_VK1_URL and legacy NODE_V1_URL
    const url = process.env[NODE_VK_URL] || process.env[NODE_V_URL];
    if (!url) continue;
    vault.set(code, {
      type: 'redis',
      url,
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded valkey node');
    // Legacy alias: node-v{i}
    vault.set(
ode-v, { type: 'redis', url });
  }

  logger.info({ count: loaded }, 'Credential vault loaded');
};

/**
 * Retrieve a credential entry by codename. Never returns secrets directly in logs.
 * @param {string} nodeCode
 * @returns {object|undefined}
 */
const getCredential = (nodeCode) => vault.get(nodeCode);

/**
 * Atomically update fields on an existing credential entry (used by rotators).
 * @param {string} nodeCode
 * @param {object} updates
 */
const updateCredential = (nodeCode, updates) => {
  const existing = vault.get(nodeCode);
  if (!existing) throw new Error(Credential not found: );
  vault.set(nodeCode, Object.assign({}, existing, updates));
};

/**
 * Returns list of loaded node codes and their types (no secrets).
 */
const listNodes = () => {
  const result = [];
  for (const [code, entry] of vault.entries()) {
    result.push({ nodeCode: code, type: entry.type });
  }
  return result;
};

module.exports = { loadCredentials, getCredential, updateCredential, listNodes };
