#!/usr/bin/env node
/**
 * ananta-shim.js — Pre-start integration bridge for LibreChat
 *
 * Run this BEFORE LibreChat starts. It fetches configuration from the
 * Ananta broker endpoint and injects the correct environment variables,
 * so LibreChat sees a standard MongoDB URI without knowing about Ananta.
 *
 * Usage (in LibreChat's start script):
 *   node path/to/ananta-shim.js && npm start
 *
 * Or as a wrapper:
 *   node ananta-shim.js node api/server.js
 */
'use strict';
const https  = require('https');
const http   = require('http');
const { execFileSync, spawn } = require('child_process');

const BROKER_URL     = process.env.ANANTA_BROKER_URL;
const BROKER_KEY     = process.env.ANANTA_INTERNAL_KEY;
const RETRY_MAX      = parseInt(process.env.ANANTA_SHIM_RETRIES  || '5');
const RETRY_DELAY_MS = parseInt(process.env.ANANTA_SHIM_DELAY_MS || '3000');

if (!BROKER_URL || !BROKER_KEY) {
  console.error('[ananta-shim] ANANTA_BROKER_URL and ANANTA_INTERNAL_KEY must be set');
  process.exit(1);
}

function fetchBroker(attempt = 1) {
  return new Promise((resolve, reject) => {
    const url    = new URL(BROKER_URL);
    const lib    = url.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'GET',
      headers:  { 'X-Ananta-Internal-Key': BROKER_KEY, 'Accept': 'application/json' },
      timeout:  8000
    };
    const req = lib.request(reqOpts, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('Broker returned invalid JSON')); }
        } else {
          reject(new Error('Broker returned HTTP ' + res.statusCode));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Broker request timed out')); });
    req.end();
  });
}

async function fetchWithRetry() {
  for (let i = 1; i <= RETRY_MAX; i++) {
    try {
      const config = await fetchBroker(i);
      console.log('[ananta-shim] broker config received');
      return config;
    } catch (err) {
      console.warn('[ananta-shim] attempt ' + i + '/' + RETRY_MAX + ' failed: ' + err.message);
      if (i < RETRY_MAX) await new Promise(r => setTimeout(r, RETRY_DELAY_MS * i));
    }
  }
  throw new Error('[ananta-shim] broker unreachable after ' + RETRY_MAX + ' attempts');
}

async function main() {
  let config;
  try {
    config = await fetchWithRetry();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Inject config into environment
  if (config.mongoUri)    process.env.MONGO_URI            = config.mongoUri;
  if (config.s3Endpoint)  process.env.S3_ENDPOINT_URL      = config.s3Endpoint;
  if (config.s3Bucket)    process.env.S3_BUCKET_NAME        = config.s3Bucket;
  if (config.s3Key)       process.env.AWS_ACCESS_KEY_ID     = config.s3Key;
  if (config.s3Secret)    process.env.AWS_SECRET_ACCESS_KEY  = config.s3Secret;

  console.log('[ananta-shim] environment configured');

  // If called as a wrapper (node shim.js <cmd> <args...>), exec the command
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const child = spawn(args[0], args.slice(1), { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => process.exit(code ?? 0));
    child.on('error', (err) => { console.error('[ananta-shim] child error:', err.message); process.exit(1); });
  }
  // Otherwise just return — caller will use the env
}

main();
