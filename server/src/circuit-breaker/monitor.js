'use strict';
const { MongoClient } = require('mongodb');
const registry = require('../directory/registry');
const kavacha = require('../kavacha-client');
const { log } = require('../utils/logger');

// Trip threshold: mark READ_ONLY when storage exceeds 90%
const TRIP_PCT = 0.90;
const OFFLINE_PCT = 0.98;
const POLL_MS = 5 * 60 * 1000; // 5 minutes

async function checkAtlasNode(node) {
  try {
    const { credential } = await kavacha.requestToken(node.code, 'stats');
    const client = new MongoClient(credential.uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const stats = await client.db().stats();
    await client.close();
    const used = stats.storageSize || 0;
    const max  = node.storage_bytes_max || 536870912; // 512MB default
    registry.updateUsage(node.code, used);
    const pct = used / max;

    if (pct >= OFFLINE_PCT && node.status !== 'OFFLINE') {
      log.warn(`[CB] ${node.code}: ${(pct*100).toFixed(1)}% → OFFLINE`);
      registry.updateStatus(node.code, 'OFFLINE');
      await writeStatusToCtrl(node.code, 'OFFLINE', used);
    } else if (pct >= TRIP_PCT && node.status === 'ACTIVE') {
      log.warn(`[CB] ${node.code}: ${(pct*100).toFixed(1)}% → READ_ONLY`);
      registry.updateStatus(node.code, 'READ_ONLY');
      await writeStatusToCtrl(node.code, 'READ_ONLY', used);
      // Promote next STANDBY node to ACTIVE
      const standby = registry.getAllNodes().find(n => n.type === 'mongo' && n.status === 'STANDBY');
      if (standby) {
        log.info(`[CB] promoting ${standby.code} STANDBY → ACTIVE`);
        registry.updateStatus(standby.code, 'ACTIVE');
        await writeStatusToCtrl(standby.code, 'ACTIVE', 0);
      }
    } else if (pct < TRIP_PCT && node.status === 'READ_ONLY') {
      // Recovered (e.g. manual cleanup)
      log.info(`[CB] ${node.code}: recovered → ACTIVE`);
      registry.updateStatus(node.code, 'ACTIVE');
      await writeStatusToCtrl(node.code, 'ACTIVE', used);
    }
  } catch (err) {
    log.warn(`[CB] ${node.code}: check failed`);
  }
}

async function writeStatusToCtrl(code, status, storageBytes) {
  const url = process.env.CTRL_PLANE_URL;
  const key = process.env.CTRL_PLANE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/node_registry?code=eq.${code}`, {
      method: 'PATCH',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, storage_bytes_used: storageBytes, updated_at: new Date().toISOString() })
    });
    await fetch(`${url}/rest/v1/node_status_history`, {
      method: 'POST',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_code: code, status, storage_bytes: storageBytes })
    });
  } catch (_) {}
}

async function poll() {
  const atlasNodes = registry.getAllNodes().filter(n => n.type === 'mongo' && n.status !== 'STANDBY');
  for (const node of atlasNodes) {
    await checkAtlasNode(node);
  }
}

function start() {
  setTimeout(() => {
    poll();
    setInterval(poll, POLL_MS);
    log.info('[CB] circuit breaker monitor started');
  }, 15000); // wait for registry to populate
}

module.exports = { start };
