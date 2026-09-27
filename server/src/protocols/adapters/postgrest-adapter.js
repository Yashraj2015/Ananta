'use strict';
/**
 * postgrest-adapter.js — Supabase SDK compatible REST layer
 * Translates /rest/v1/table?select=...&filter=eq.value → internal data layer
 * Used by: smars-webui (Supabase JS SDK), any app using Supabase client
 */
const express = require('express');
const router  = express.Router();

function parseFilter(key, val) {
  if (typeof val !== 'string') return { [key]: val };
  const dot = val.indexOf('.');
  if (dot === -1) return { [key]: val };
  const op  = val.slice(0, dot);
  const raw = val.slice(dot + 1);
  const opMap = { eq:'$eq', neq:'$ne', gt:'$gt', gte:'$gte', lt:'$lt', lte:'$lte', is:'$eq' };
  if (op === 'in') {
    const vals = raw.replace(/^\(|\)$/g, '').split(',').map(v => v.trim());
    return { [key]: { '$in': vals } };
  }
  return { [key]: { [opMap[op] || '$eq']: raw } };
}

function buildFilter(query) {
  const reserved = ['select','order','limit','offset','count'];
  const filter = {};
  for (const [k, v] of Object.entries(query)) {
    if (!reserved.includes(k)) Object.assign(filter, parseFilter(k, v));
  }
  return filter;
}

router.get('/:table', async (req, res) => {
  if (req.query.count === 'exact') res.setHeader('Content-Range', '0-0/0');
  res.setHeader('Content-Type', 'application/json');
  res.json([]); // TODO: wire to Neon via kavacha-client
});
router.post('/:table', async (req, res) => {
  const prefer = req.headers['prefer'] || '';
  const row = Array.isArray(req.body) ? req.body[0] : req.body;
  res.status(201).json(prefer.includes('return=representation') ? [{ id: 'stub-id', ...row }] : null);
});
router.patch('/:table', async (req, res) => { res.json([]); });
router.delete('/:table', async (req, res) => { res.json([]); });
router.head('/:table', (req, res) => { res.setHeader('Content-Range', '0-0/0'); res.end(); });

module.exports = router;