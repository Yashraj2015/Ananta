'use strict';
/**
 * Admin API Routes — /v1/admin/*
 * Protected by INTERNAL_BROKER_KEY header
 * All writes go to ctrl-plane DB (no restart needed)
 */
const express = require('express');
const crypto  = require('crypto');
const ctrl    = require('../../../ctrl-plane/client');
const router  = express.Router();

// ── Auth guard ────────────────────────────────────────────────────────────────
router.use((req, res, next) => {
  const key = req.headers['x-ananta-admin-key'];
  if (!key || key !== process.env.INTERNAL_BROKER_KEY) {
    return res.status(401).json({ error: { code: 'ANANTA_4010', message: 'Unauthorized' } });
  }
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// NODES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /v1/admin/nodes  — list all nodes (no credentials returned)
router.get('/nodes', async (req, res) => {
  const { nodes, error } = await ctrl.listNodes(req.query.type || null);
  if (error && !nodes.length) return res.status(502).json({ error: { message: error } });
  res.json({ nodes });
});

// POST /v1/admin/nodes  — add/update a node
// Body: { nodeCode, nodeType, label, region, credentials: {...}, metadata: {...} }
router.post('/nodes', async (req, res) => {
  const { nodeCode, nodeType, label, region, credentials, metadata } = req.body;
  if (!nodeCode || !nodeType) return res.status(400).json({ error: { message: 'nodeCode and nodeType required' } });

  const VALID_TYPES = ['atlas', 'pg-neon', 'ctrl-plane', 'r2', 'redis'];
  if (!VALID_TYPES.includes(nodeType)) {
    return res.status(400).json({ error: { message: `nodeType must be one of: ${VALID_TYPES.join(', ')}` } });
  }

  const { data, error } = await ctrl.upsertNode({ nodeCode, nodeType, label, region, credentials, metadata });
  if (error) return res.status(502).json({ error: { message: error } });
  res.status(201).json({ message: 'Node saved', nodeCode });
});

// PATCH /v1/admin/nodes/:code/status
router.patch('/nodes/:code/status', async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE','STANDBY','OFFLINE','DEGRADED'].includes(status)) {
    return res.status(400).json({ error: { message: 'Invalid status' } });
  }
  await ctrl.updateNodeStatus(req.params.code, status);
  res.json({ message: 'Status updated', nodeCode: req.params.code, status });
});

// DELETE /v1/admin/nodes/:code
router.delete('/nodes/:code', async (req, res) => {
  await ctrl.deleteNode(req.params.code);
  res.json({ message: 'Node deleted', nodeCode: req.params.code });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /v1/admin/accounts
router.get('/accounts', async (req, res) => {
  const { customers, error } = await ctrl.listCustomers();
  if (error && !customers.length) return res.status(502).json({ error: { message: error } });
  res.json({ accounts: customers });
});

// POST /v1/admin/accounts  — create new customer
// Body: { name, email, plan, mongoNode?, pgNode?, r2Node? }
router.post('/accounts', async (req, res) => {
  const { name, email, plan, mongoNode, pgNode, r2Node } = req.body;
  if (!name || !email) return res.status(400).json({ error: { message: 'name and email required' } });

  const PLANS = ['free','starter','pro','scale','enterprise'];
  if (plan && !PLANS.includes(plan)) return res.status(400).json({ error: { message: 'Invalid plan' } });

  const id = 'tenant_' + crypto.randomBytes(8).toString('hex');
  const { data, error } = await ctrl.createCustomer({ id, name, email, plan: plan || 'free', mongoNode, pgNode, r2Node });
  if (error) return res.status(502).json({ error: { message: error } });

  res.status(201).json({
    message: 'Account created',
    tenantId: id,
    mongoUri: `mongodb://${id}:[api-key]@dave.db.ananta.io:27017/${id}`,
    pgUri:    `postgresql://${id}:[api-key]@sql.ananta.io:5432/${id}`,
    restUrl:  `https://api.ananta.io/v1/data`,
  });
});

// PATCH /v1/admin/accounts/:id/plan
router.patch('/accounts/:id/plan', async (req, res) => {
  const { plan } = req.body;
  await ctrl.updateCustomerPlan(req.params.id, plan);
  res.json({ message: 'Plan updated', tenantId: req.params.id, plan });
});

// PATCH /v1/admin/accounts/:id/suspend
router.patch('/accounts/:id/suspend', async (req, res) => {
  await ctrl.suspendCustomer(req.params.id, req.body.reason || 'admin_action');
  res.json({ message: 'Account suspended', tenantId: req.params.id });
});

// PATCH /v1/admin/accounts/:id/reactivate
router.patch('/accounts/:id/reactivate', async (req, res) => {
  await ctrl.reactivateCustomer(req.params.id);
  res.json({ message: 'Account reactivated', tenantId: req.params.id });
});

// GET /v1/admin/plans  — plan definitions
router.get('/plans', (req, res) => {
  res.json({
    plans: {
      free:       { price: 0,  priceLabel: 'Free',     dbMb: 500,    fileMb: 1024,   dbRows: 50000 },
      starter:    { price: 12, priceLabel: '$12/mo',   dbMb: 10240,  fileMb: 20480,  dbRows: 500000 },
      pro:        { price: 29, priceLabel: '$29/mo',   dbMb: 51200,  fileMb: 102400, dbRows: 5000000 },
      scale:      { price: 79, priceLabel: '$79/mo',   dbMb: 204800, fileMb: 512000, dbRows: 50000000 },
      enterprise: { price: -1, priceLabel: 'Custom',   dbMb: -1,     fileMb: -1,     dbRows: -1 },
    }
  });
});

// GET /v1/admin/stats  — quick overview
router.get('/stats', async (req, res) => {
  const [{ nodes }, { customers }] = await Promise.all([ctrl.listNodes(), ctrl.listCustomers()]);
  const active    = customers.filter(c => c.status === 'active').length;
  const suspended = customers.filter(c => c.status === 'suspended').length;
  const byPlan    = customers.reduce((acc, c) => { acc[c.plan] = (acc[c.plan] || 0) + 1; return acc; }, {});
  const byType    = nodes.reduce((acc, n) => { acc[n.node_type] = (acc[n.node_type] || 0) + 1; return acc; }, {});
  res.json({ nodes: { total: nodes.length, byType }, accounts: { total: customers.length, active, suspended, byPlan } });
});

module.exports = router;