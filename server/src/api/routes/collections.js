'use strict';
const { enforceDbQuota } = require('../../middleware/quota');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const kavacha = require('../../kavacha-client');
const registry = require('../../directory/registry');
const { log } = require('../../utils/logger');

const router = express.Router();

// Extract tenant from JWT (simplified — full JWT verify is in authenticate middleware)
function getTenant(req) {
  return req.tenant || req.headers['x-ananta-tenant'] || 'default';
}

// Get a PostgreSQL client connection for a tenant
async function getPgClient(tenantId) {
  const node = registry.getActiveNeonNode(tenantId);
  if (!node) throw Object.assign(new Error('No active data node available'), { status: 503 });
  const { credential } = await kavacha.requestToken(node.code, 'write', tenantId);
  const { Client } = require('pg');
  const client = new Client({ connectionString: credential.connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  return { client, node, schemaName: `ananta_proj_${tenantId}` };
}

// Build WHERE clause from filter object (MongoDB-style: { field: value, field: { $gt: value } })
function buildWhere(filter, params) {
  if (!filter || Object.keys(filter).length === 0) return '';
  const clauses = [];
  for (const [field, val] of Object.entries(filter)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      if (val.$eq !== undefined)  { params.push(val.$eq);  clauses.push(`data->>'${field}' = $${params.length}`); }
      if (val.$gt !== undefined)  { params.push(val.$gt);  clauses.push(`(data->>'${field}')::numeric > $${params.length}`); }
      if (val.$lt !== undefined)  { params.push(val.$lt);  clauses.push(`(data->>'${field}')::numeric < $${params.length}`); }
      if (val.$gte !== undefined) { params.push(val.$gte); clauses.push(`(data->>'${field}')::numeric >= $${params.length}`); }
      if (val.$lte !== undefined) { params.push(val.$lte); clauses.push(`(data->>'${field}')::numeric <= $${params.length}`); }
      if (val.$in  !== undefined) { params.push(val.$in);  clauses.push(`data->>'${field}' = ANY($${params.length})`); }
    } else {
      params.push(String(val));
      clauses.push(`data->>'${field}' = $${params.length}`);
    }
  }
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

// POST /:collection — insert document
router.post('/:collection', express.json(), async (req, res, next) => {
  const { collection } = req.params;
  const tenantId = getTenant(req);
  let pg;
  try {
    const doc = { _id: req.body._id || uuidv4(), ...req.body, _createdAt: new Date().toISOString() };
    pg = await getPgClient(tenantId);
    const { schemaName, client } = pg;
    // Auto-create table if not exists (idempotent)
    await client.query(`CREATE TABLE IF NOT EXISTS "${schemaName}"."${collection}" (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
    await client.query(`INSERT INTO "${schemaName}"."${collection}" (id, data) VALUES ($1, $2)`, [doc._id, doc]);
    res.status(201).json({ data: doc });
  } catch (err) { next(err); }
  finally { try { await pg?.client.end(); } catch(_){} }
});

// GET /:collection — find with optional filter, limit, skip, sort
router.get('/:collection', async (req, res, next) => {
  const { collection } = req.params;
  const tenantId = getTenant(req);
  let pg;
  try {
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};
    const limit  = Math.min(parseInt(req.query.limit) || 50, 1000);
    const skip   = parseInt(req.query.skip) || 0;
    const sort   = req.query.sort || '_createdAt';
    const order  = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const params = [];
    const where  = buildWhere(filter, params);
    params.push(limit, skip);
    pg = await getPgClient(tenantId);
    const { schemaName, client } = pg;
    const result = await client.query(
      `SELECT data FROM "${schemaName}"."${collection}" ${where} ORDER BY data->>'${sort}' ${order} LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: result.rows.map(r => r.data) });
  } catch (err) { next(err); }
  finally { try { await pg?.client.end(); } catch(_){} }
});

// PATCH /:collection/:id — update document
router.patch('/:collection/:id', express.json(), async (req, res, next) => {
  const { collection, id } = req.params;
  const tenantId = getTenant(req);
  let pg;
  try {
    pg = await getPgClient(tenantId);
    const { schemaName, client } = pg;
    const existing = await client.query(`SELECT data FROM "${schemaName}"."${collection}" WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: { code: 'ANANTA_4042', message: 'Document not found' } });
    const updated = { ...existing.rows[0].data, ...req.body, _updatedAt: new Date().toISOString() };
    await client.query(`UPDATE "${schemaName}"."${collection}" SET data = $1 WHERE id = $2`, [updated, id]);
    res.json({ data: updated });
  } catch (err) { next(err); }
  finally { try { await pg?.client.end(); } catch(_){} }
});

// DELETE /:collection/:id
router.delete('/:collection/:id', async (req, res, next) => {
  const { collection, id } = req.params;
  const tenantId = getTenant(req);
  let pg;
  try {
    pg = await getPgClient(tenantId);
    const { schemaName, client } = pg;
    const result = await client.query(`DELETE FROM "${schemaName}"."${collection}" WHERE id = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: { code: 'ANANTA_4043', message: 'Document not found' } });
    res.json({ success: true });
  } catch (err) { next(err); }
  finally { try { await pg?.client.end(); } catch(_){} }
});

module.exports = router;
