'use strict';
const { MongoClient } = require('mongodb');
const { Client: PgClient } = require('pg');
const Redis = require('ioredis');
const registry = require('../directory/registry');
const kavacha = require('../kavacha-client');
const { log } = require('../utils/logger');
const retry = require('../utils/retry');

// Ping intervals per node type
const INTERVALS = {
  mongo: 14 * 24 * 60 * 60 * 1000,  // 14 days (Atlas M0 deactivates after 30d)
  pg_neon: 12 * 60 * 60 * 1000,      // 12 hours (Neon scales to zero)
  pg_ctrl: 3 * 24 * 60 * 60 * 1000,  // 3 days (ctrl-plane pauses after 7d)
  redis: 7 * 24 * 60 * 60 * 1000,    // 7 days
};

function getInterval(node) {
  if (node.type === 'mongo') return INTERVALS.mongo;
  if (node.type === 'redis') return INTERVALS.redis;
  if (node.code.startsWith('node-s')) return INTERVALS.pg_ctrl;
  return INTERVALS.pg_neon;
}

async function pingMongo(credential) {
  const client = new MongoClient(credential.uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  await client.close();
}

async function pingPg(credential) {
  const client = new PgClient({ connectionString: credential.connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
}

async function pingRedis(credential) {
  const client = new Redis(credential.url, { lazyConnect: true, connectTimeout: 5000 });
  await client.connect();
  await client.ping();
  client.disconnect();
}

async function pingNode(node) {
  const start = Date.now();
  try {
    const { credential } = await kavacha.requestToken(node.code, 'ping');

    if (node.type === 'mongo') await pingMongo(credential);
    else if (node.type === 'redis') await pingRedis(credential);
    else await pingPg(credential);

    const ms = Date.now() - start;
    // RULE: log only codename — never log URIs, vendor names, or hostnames
    log.info(`[HB] ${node.code} ok (${ms}ms)`);
  } catch (err) {
    log.warn(`[HB] ${node.code} unreachable — retrying`);
    await retry(async () => {
      const { credential } = await kavacha.requestToken(node.code, 'ping');
      if (node.type === 'mongo') await pingMongo(credential);
      else if (node.type === 'redis') await pingRedis(credential);
      else await pingPg(credential);
    }, { maxAttempts: 3, initialDelayMs: 5000, backoffFactor: 2 });
    log.warn(`[HB] ${node.code} recovered after retry`);
  }
}

const timers = new Map();

function schedulePing(node) {
  if (timers.has(node.code)) clearInterval(timers.get(node.code));
  const interval = getInterval(node);
  // Ping immediately on start, then on interval
  pingNode(node).catch(() => {});
  const t = setInterval(() => pingNode(node).catch(() => {}), interval);
  timers.set(node.code, t);
}

function start() {
  // Wait 10s for registry to load before first pings
  setTimeout(() => {
    const nodes = registry.getAllNodes();
    for (const node of nodes) {
      schedulePing(node);
    }
    // Re-schedule when new nodes are added
    registry.on('statusChange', (code, from, to) => {
      const node = registry.getNode(code);
      if (node && to === 'ACTIVE' && !timers.has(code)) {
        schedulePing(node);
      }
    });
    log.info(`[HB] silent pinger started for ${nodes.length} nodes`);
  }, 10000);
}

function stop() {
  for (const [code, t] of timers) {
    clearInterval(t);
  }
  timers.clear();
}

module.exports = { start, stop };
