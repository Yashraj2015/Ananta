'use strict';
const https = require('https');
const http  = require('http');
const crypto = require('crypto');

const CTRL_URL   = process.env.CTRL_PLANE_URL;
const CTRL_KEY   = process.env.CTRL_PLANE_KEY;
const ENC_SECRET = process.env.KAVACHA_SHARED_SECRET || process.env.ANANTA_JWT_SECRET || 'dev-enc-key';

function deriveKey(s) { return crypto.createHash('sha256').update(s).digest(); }

function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c  = crypto.createCipheriv('aes-256-gcm', deriveKey(ENC_SECRET), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), data: enc.toString('hex') };
}

function decrypt(blob) {
  if (!blob || !blob.iv) return null;
  const d = crypto.createDecipheriv('aes-256-gcm', deriveKey(ENC_SECRET), Buffer.from(blob.iv,'hex'));
  d.setAuthTag(Buffer.from(blob.tag,'hex'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(blob.data,'hex')), d.final()]).toString('utf8'));
}

function ctrlReq(method, path, body) {
  if (!CTRL_URL || !CTRL_KEY) return Promise.resolve({ data: null, error: 'ctrl-plane not configured' });
  const url = new URL(CTRL_URL + '/rest/v1' + path);
  const payload = body ? JSON.stringify(body) : undefined;
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const req = lib.request({
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, method,
      headers: { 'apikey': CTRL_KEY, 'Authorization': 'Bearer ' + CTRL_KEY,
        'Content-Type': 'application/json', 'Prefer': 'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve({ data: JSON.parse(d), error: null, status: res.statusCode }); }
        catch { resolve({ data: d, error: null, status: res.statusCode }); }
      });
    });
    req.on('error', e => resolve({ data: null, error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ data: null, error: 'timeout' }); });
    if (payload) req.write(payload);
    req.end();
  });
}

// NODE REGISTRY
async function listNodes(type) {
  const qs = type ? `?node_type=eq.${type}&order=node_code` : '?order=node_code';
  const { data, error } = await ctrlReq('GET', '/node_registry' + qs + '&select=id,node_code,node_type,label,region,status,metadata,last_heartbeat,created_at');
  return { nodes: data || [], error };
}
async function getNodeCredentials(nodeCode) {
  const { data } = await ctrlReq('GET', `/node_registry?node_code=eq.${nodeCode}&select=credentials,node_type&limit=1`);
  if (!data?.[0]?.credentials) return null;
  try { return decrypt(data[0].credentials); } catch { return null; }
}
async function upsertNode({ nodeCode, nodeType, label, region, credentials, metadata, status }) {
  const row = {
    node_code: nodeCode, node_type: nodeType, label: label || nodeCode, region: region || 'auto',
    status: status || 'ACTIVE', metadata: metadata || {},
    ...(credentials ? { credentials: encrypt(credentials) } : {}),
    updated_at: new Date().toISOString(),
  };
  const existing = await ctrlReq('GET', `/node_registry?node_code=eq.${nodeCode}&select=id`);
  if (existing.data?.[0]) {
    return ctrlReq('PATCH', `/node_registry?node_code=eq.${nodeCode}`, row);
  }
  return ctrlReq('POST', '/node_registry', row);
}
async function updateNodeStatus(nodeCode, status) {
  return ctrlReq('PATCH', `/node_registry?node_code=eq.${nodeCode}`, { status, last_heartbeat: new Date().toISOString() });
}
async function deleteNode(nodeCode) { return ctrlReq('DELETE', `/node_registry?node_code=eq.${nodeCode}`); }

// CUSTOMERS
const PLAN_QUOTAS = {
  free:       { storage_quota_mb: 500,    db_row_quota: 50000 },
  starter:    { storage_quota_mb: 10240,  db_row_quota: 500000 },
  pro:        { storage_quota_mb: 51200,  db_row_quota: 5000000 },
  scale:      { storage_quota_mb: 204800, db_row_quota: 50000000 },
  enterprise: { storage_quota_mb: -1,     db_row_quota: -1 },
};
async function listCustomers() {
  const { data, error } = await ctrlReq('GET', '/customers?order=created_at.desc&select=id,name,email,plan,status,storage_quota_mb,db_row_quota,assigned_mongo_node,assigned_pg_node,assigned_r2_node,created_at');
  return { customers: data || [], error };
}
async function createCustomer({ id, name, email, plan, mongoNode, pgNode, r2Node }) {
  return ctrlReq('POST', '/customers', {
    id, name, email, plan, status: 'active', ...PLAN_QUOTAS[plan] || PLAN_QUOTAS.free,
    assigned_mongo_node: mongoNode || null, assigned_pg_node: pgNode || null, assigned_r2_node: r2Node || null,
  });
}
async function updateCustomerPlan(tenantId, plan) {
  return ctrlReq('PATCH', `/customers?id=eq.${tenantId}`, { plan, ...PLAN_QUOTAS[plan] || PLAN_QUOTAS.free, updated_at: new Date().toISOString() });
}
async function suspendCustomer(tenantId, reason) {
  return ctrlReq('PATCH', `/customers?id=eq.${tenantId}`, { status: 'suspended', revoke_reason: reason });
}
async function reactivateCustomer(tenantId) {
  return ctrlReq('PATCH', `/customers?id=eq.${tenantId}`, { status: 'active', revoke_reason: null });
}

module.exports = {
  listNodes, getNodeCredentials, upsertNode, updateNodeStatus, deleteNode,
  listCustomers, createCustomer, updateCustomerPlan, suspendCustomer, reactivateCustomer,
  encrypt, decrypt, PLAN_QUOTAS,
};