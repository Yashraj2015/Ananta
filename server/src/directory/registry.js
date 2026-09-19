'use strict';
const { EventEmitter } = require('events');
const { log } = require('../utils/logger');

// Registry is an EventEmitter so circuit-breaker can react to status changes
class NodeRegistry extends EventEmitter {
  constructor() {
    super();
    this.nodes = new Map();        // code → { code, type, status, region, priority, ... }
    this.tenantMap = new Map();    // tenantId → neonNodeCode
    this._pollInterval = null;
  }

  // Load node list from control plane (ctrl-plane) every 60 seconds
  async fetchRegistry() {
    const url  = process.env.CTRL_PLANE_URL;
    const key  = process.env.CTRL_PLANE_KEY;
    if (!url || !key) {
      log.warn('[registry] CTRL_PLANE_URL or CTRL_PLANE_KEY not set – using in-memory nodes only');
      return;
    }
    try {
      const res = await fetch(`${url}/rest/v1/node_registry?select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      if (!res.ok) throw new Error(`ctrl-plane responded ${res.status}`);
      const rows = await res.json();
      for (const row of rows) {
        const prev = this.nodes.get(row.code);
        this.nodes.set(row.code, row);
        if (prev && prev.status !== row.status) {
          this.emit('statusChange', row.code, prev.status, row.status);
        }
      }
      log.debug(`[registry] loaded ${rows.length} nodes from ctrl-plane`);
    } catch (err) {
      log.warn('[registry] ctrl-plane fetch failed, using stale data', { msg: err.message });
    }
  }

  // Also load tenant → neon node mapping
  async fetchTenantMap() {
    const url  = process.env.CTRL_PLANE_URL;
    const key  = process.env.CTRL_PLANE_KEY;
    if (!url || !key) return;
    try {
      const res = await fetch(`${url}/rest/v1/customer_projects?select=tenant_id,neon_node_code`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      if (!res.ok) return;
      const rows = await res.json();
      for (const row of rows) {
        this.tenantMap.set(row.tenant_id, row.neon_node_code);
      }
    } catch (_) { /* stale map is fine */ }
  }

  start() {
    this.fetchRegistry();
    this.fetchTenantMap();
    this._pollInterval = setInterval(() => {
      this.fetchRegistry();
      this.fetchTenantMap();
    }, 60000);
  }

  stop() { clearInterval(this._pollInterval); }

  // Get first ACTIVE Atlas node (by priority asc)
  getActiveAtlasNode() {
    return [...this.nodes.values()]
      .filter(n => n.type === 'mongo' && n.status === 'ACTIVE')
      .sort((a, b) => a.priority - b.priority)[0] || null;
  }

  // Get all Atlas nodes where writes are allowed (ACTIVE only)
  getWritableAtlasNodes() {
    return [...this.nodes.values()]
      .filter(n => n.type === 'mongo' && n.status === 'ACTIVE')
      .sort((a, b) => a.priority - b.priority);
  }

  // Get Neon node for a specific tenant
  getActiveNeonNode(tenantId) {
    if (tenantId && this.tenantMap.has(tenantId)) {
      const code = this.tenantMap.get(tenantId);
      const node = this.nodes.get(code);
      if (node && node.status === 'ACTIVE') return node;
    }
    // Fallback: first ACTIVE Neon node
    return [...this.nodes.values()]
      .filter(n => n.type === 'pg' && n.code.startsWith('node-n') && n.status === 'ACTIVE')
      .sort((a, b) => a.priority - b.priority)[0] || null;
  }

  // Get active R2 bucket node
  getActiveR2Bucket() {
    return [...this.nodes.values()]
      .filter(n => n.type === 'r2' && n.status === 'ACTIVE')
      .sort((a, b) => a.priority - b.priority)[0] || null;
  }

  // Get ctrl-plane (Supabase) node
  getCtrlNode(index = 1) {
    return this.nodes.get(`node-s${index}`) || null;
  }

  // Get Valkey node
  getValkeyNode(index = 1) {
    return this.nodes.get(`node-vk${index}`) || null;
  }

  updateStatus(code, status) {
    const node = this.nodes.get(code);
    if (node) {
      node.status = status;
      this.emit('statusChange', code, node.status, status);
    }
  }

  updateUsage(code, storageBytesUsed) {
    const node = this.nodes.get(code);
    if (node) node.storage_bytes_used = storageBytesUsed;
  }

  getAllNodes() { return [...this.nodes.values()]; }
  getNode(code) { return this.nodes.get(code) || null; }
}

module.exports = new NodeRegistry(); // singleton
