#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// Ananta Shim — runs BEFORE LibreChat loads any modules
// Fetches config from Ananta broker endpoint
// Injects MONGO_URI and S3 config into process.env
// LibreChat files: 100% UNTOUCHED
// ═══════════════════════════════════════════════════════════

const https = require('https');

const ANANTA_BROKER_URL = process.env.ANANTA_BROKER_URL || 'https://api.ananta.io/v1/internal/broker';
const ANANTA_INTERNAL_KEY = process.env.ANANTA_INTERNAL_KEY;

async function fetchConfig() {
  if (!ANANTA_INTERNAL_KEY) {
    console.warn('[Ananta] No ANANTA_INTERNAL_KEY set. Using existing env values.');
    return;
  }
  try {
    const res = await fetch(ANANTA_BROKER_URL, {
      headers: { 'X-Ananta-Internal-Key': ANANTA_INTERNAL_KEY }
    });
    if (!res.ok) throw new Error(`Broker returned ${res.status}`);
    const config = await res.json();
    // Inject all values
    if (config.mongoUri) process.env.MONGO_URI = config.mongoUri;
    if (config.s3Endpoint) process.env.S3_ENDPOINT_URL = config.s3Endpoint;
    if (config.s3Bucket) process.env.S3_BUCKET_NAME = config.s3Bucket;
    if (config.s3Key) process.env.AWS_ACCESS_KEY_ID = config.s3Key;
    if (config.s3Secret) process.env.AWS_SECRET_ACCESS_KEY = config.s3Secret;
    console.log('[Ananta] Config loaded. Starting application...');
  } catch (err) {
    console.warn(`[Ananta] Could not load remote config: ${err.message}. Using local .env values.`);
    // Fallback: use whatever is already in .env
  }
}

// Run and then exec the next process
fetchConfig().finally(() => {
  // The caller's npm script runs LibreChat after this resolves
});

module.exports = { fetchConfig };
