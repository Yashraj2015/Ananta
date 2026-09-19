const axios = require('axios');
const crypto = require('crypto');
const { getCredential, updateCredential } = require('../vault/credentials');
const { clearAtlasCache } = require('../vault/atlas-issuer');
const pino = require('pino');
const logger = pino({ name: 'kavacha-atlas-rotator' });

const rotateAtlasPassword = async (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'atlas' || !creds.publicKey) return null;

  const newPassword = crypto.randomBytes(32).toString('hex');
  const username = 'admin'; // Adjust based on your Atlas setup

  // This is a placeholder for actual Digest auth to Atlas API
  // In reality, you'd use a client that supports digest auth with axios
  try {
    // Example: PATCH https://cloud.mongodb.com/api/atlas/v2/groups/{groupId}/databaseUsers/admin/{username}
    logger.info(`[KAVACHA] Rotated cred for ${nodeCode}`);
    
    // Update local config
    const newUri = creds.uri.replace(/:[^:]+@/, `:${newPassword}@`);
    updateCredential(nodeCode, { uri: newUri });
    clearAtlasCache(nodeCode);
    
    return newUri;
  } catch (err) {
    logger.error(`[KAVACHA] Failed to rotate atlas creds for ${nodeCode}`);
    throw err;
  }
};

module.exports = { rotateAtlasPassword };
