'use strict';
/**
 * credentials.js — maps well-known codenames to environment-sourced credentials.
 * Credentials are loaded once at startup into a sealed in-memory vault Map.
 * Nothing that contains a real URI, key, or password is ever logged.
 */
const pino   = require('pino');
const logger = pino({ name: 'kavacha-creds', level: process.env.LOG_LEVEL || 'info' });

const vault = new Map();

const loadCredentials = () => {
  let loaded = 0;

  // ── node-a{1..5}: Atlas (MongoDB) clusters ────────────────────────
  for (let i = 1; i <= 5; i++) {
    const code = 'node-a' + i;
    const uri  = process.env['NODE_A' + i + '_URI'];
    if (!uri) continue;
    vault.set(code, {
      type:       'atlas',
      uri,
      publicKey:  process.env['NODE_A' + i + '_ADMIN_PUBLIC_KEY']  || null,
      privateKey: process.env['NODE_A' + i + '_ADMIN_PRIVATE_KEY'] || null,
      groupId:    process.env['NODE_A' + i + '_GROUP_ID']          || null,
      username:   process.env['NODE_A' + i + '_ADMIN_USERNAME']    || 'admin',
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded atlas node');
  }

  // ── node-n{1..5}: Neon PostgreSQL ────────────────────────────────
  for (let i = 1; i <= 5; i++) {
    const code     = 'node-n' + i;
    const adminUri = process.env['NODE_N' + i + '_ADMIN_URI'];
    if (!adminUri) continue;
    vault.set(code, { type: 'pg-neon', adminUri });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded neon node');
  }

  // ── node-s{1..2}: ctrl-plane (Supabase) ──────────────────────────
  for (let i = 1; i <= 2; i++) {
    const code       = 'node-s' + i;
    const url        = process.env['NODE_S' + i + '_URL'];
    const serviceKey = process.env['NODE_S' + i + '_SERVICE_KEY'];
    if (!url || !serviceKey) continue;
    vault.set(code, { type: 'ctrl-plane', url, serviceKey });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded ctrl-plane node');
  }

  // ── node-r2{a,b,c}: R2 object storage ────────────────────────────
  for (const letter of ['A', 'B', 'C']) {
    const code      = 'node-r2' + letter.toLowerCase();
    const accessKey = process.env['NODE_R2' + letter + '_ACCESS_KEY'];
    const secretKey = process.env['NODE_R2' + letter + '_SECRET_KEY'];
    const endpoint  = process.env['NODE_R2' + letter + '_ENDPOINT'];
    const bucket    = process.env['NODE_R2' + letter + '_BUCKET'];
    const accountId = process.env['NODE_R2' + letter + '_ACCOUNT_ID'];
    if (!accessKey || !secretKey) continue;
    vault.set(code, {
      type: 'r2', accessKey, secretKey,
      bucket:    bucket    || null,
      endpoint:  endpoint  || (accountId ? 'https://' + accountId + '.r2.cloudflarestorage.com' : null),
      accountId: accountId || null,
    });
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded r2 node');
  }

  // ── node-vk{1..2}: Valkey/Redis ──────────────────────────────────
  for (let i = 1; i <= 2; i++) {
    const code = 'node-vk' + i;
    const url  = process.env['NODE_VK' + i + '_URL'];
    if (!url) continue;
    vault.set(code, { type: 'redis', url });
    vault.set('node-v' + i, { type: 'redis', url }); // legacy alias
    loaded++;
    logger.info({ nodeCode: code }, 'Loaded valkey node');
  }

  logger.info({ count: loaded }, 'Credential vault loaded');
};

const getCredential   = (code)           => vault.get(code);
const updateCredential = (code, updates) => {
  const existing = vault.get(code);
  if (!existing) throw new Error('Credential not found: ' + code);
  vault.set(code, Object.assign({}, existing, updates));
};
const listNodes = () => [...vault.entries()].map(([code, e]) => ({ nodeCode: code, type: e.type }));

module.exports = { loadCredentials, getCredential, updateCredential, listNodes };
