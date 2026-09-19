'use strict';
/**
 * atlas-rotator.js — Rotates Atlas database user passwords every 7 days
 * via the Atlas Admin API. After rotation, updates the vault in-memory
 * and invalidates the credential cache.
 */
const crypto = require('crypto');
const { getCredential, updateCredential } = require('../vault/credentials');
const { invalidateCache } = require('../vault/atlas-issuer');
const { audit } = require('../audit/logger');
const pino   = require('pino');
const logger = pino({ name: 'kavacha-rotator', level: process.env.LOG_LEVEL || 'info' });

const ATLAS_API_BASE = 'https://cloud.mongodb.com/api/atlas/v2';

async function rotateAtlasPassword(nodeCode) {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'atlas') {
    logger.warn({ nodeCode }, 'Rotation skipped: not an atlas node');
    return;
  }
  if (!creds.publicKey || !creds.privateKey || !creds.groupId || !creds.username) {
    logger.warn({ nodeCode }, 'Rotation skipped: missing Atlas Admin API credentials');
    return;
  }

  const newPassword = crypto.randomBytes(32).toString('base64url');

  // Atlas Admin API uses Digest auth
  const url = ATLAS_API_BASE + '/groups/' + creds.groupId + '/databaseUsers/admin/' + creds.username;
  try {
    const res = await fetch(url, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/vnd.atlas.2023-01-01+json' },
      body:    JSON.stringify({ password: newPassword }),
      // Note: real impl needs HTTP Digest auth — for prod deploy use Atlas API keys
    });

    if (!res.ok) {
      logger.error({ nodeCode, status: res.status }, 'Atlas password rotation failed');
      audit('ROTATION_FAILED', { nodeCode, reason: 'Atlas API error ' + res.status });
      return;
    }

    // Build new URI with updated password
    const oldUri    = creds.uri;
    const newUri    = oldUri.replace(/:([^:@]+)@/, ':' + encodeURIComponent(newPassword) + '@');
    updateCredential(nodeCode, { uri: newUri });
    invalidateCache(nodeCode);

    logger.info({ nodeCode }, 'Atlas password rotated successfully');
    audit('ROTATION_SUCCESS', { nodeCode });
  } catch (err) {
    logger.error({ nodeCode, err: err.message }, 'Atlas rotation request failed');
    audit('ROTATION_ERROR', { nodeCode });
  }
}

module.exports = { rotateAtlasPassword };
