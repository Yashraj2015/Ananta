'use strict';
/**
 * /v1/audit — Audit log for users
 *
 * GET /v1/audit  — list recent audit events for the current user (last 100)
 */
const express = require('express');
const router  = express.Router();

function parseJWT(token) {
  try {
    const b = token.split('.')[1];
    const base64 = b.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: { message: 'Authorization required' } });
  const payload = parseJWT(token);
  if (!payload?.email) return res.status(401).json({ error: { message: 'Invalid token' } });
  if (payload.exp < Date.now() / 1000) return res.status(401).json({ error: { message: 'Token expired' } });
  req.user = payload;
  next();
}

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const { Pool } = require('pg');
  _pool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  return _pool;
}

// Human-readable action labels (no vendor names)
const ACTION_LABELS = {
  login:            'Signed in',
  logout:           'Signed out',
  profile_updated:  'Profile updated',
  token_created:    'API token created',
  token_revoked:    'API token revoked',
  plan_upgraded:    'Plan upgraded',
  plan_downgraded:  'Plan downgraded',
};

// GET /v1/audit
router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT al.id, al.action, al.metadata, al.ip_address, al.created_at
       FROM audit_log al
       JOIN customers c ON c.id = al.customer_id
       WHERE c.email = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [req.user.email, limit]
    );

    const events = rows.map(row => ({
      id:         row.id,
      action:     ACTION_LABELS[row.action] ?? row.action,
      action_code: row.action,
      // Sanitize metadata — strip any node code or provider info
      details:    sanitizeMetadata(row.metadata),
      created_at: row.created_at,
    }));

    res.json({ events, total: events.length });
  } catch (err) {
    // Table might not exist yet — return empty
    if (err.code === '42P01') return res.json({ events: [], total: 0 });
    res.status(500).json({ error: { message: 'Failed to fetch audit log' } });
  }
});

// Strip provider/node details from metadata before returning to user
function sanitizeMetadata(meta) {
  if (!meta) return {};
  const safe = {};
  if (meta.name)           safe.name          = meta.name;
  if (meta.plan)           safe.plan          = meta.plan;
  if (meta.newly_provisioned) safe.services_activated = meta.newly_provisioned.length;
  return safe;
}

module.exports = router;
