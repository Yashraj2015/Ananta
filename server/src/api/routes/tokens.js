'use strict';
/**
 * /v1/tokens  — API key management for tenant users
 * Requires JWT in Authorization: Bearer <token>
 *
 * GET    /v1/tokens          - list all tokens for current user
 * POST   /v1/tokens          - create new token (returns plain key ONCE)
 * DELETE /v1/tokens/:id      - revoke a token
 */
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const { Pool } = require('pg');

function getPool() {
  return new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

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
  if (!token) return res.status(401).json({ error: { message: 'No token provided' } });
  const payload = parseJWT(token);
  if (!payload || !payload.email) return res.status(401).json({ error: { message: 'Invalid token' } });
  if (payload.exp < Date.now() / 1000) return res.status(401).json({ error: { message: 'Token expired' } });
  req.user = payload;
  next();
}

// GET /v1/tokens
router.get('/', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows: cRows } = await pool.query(
      'SELECT id FROM customers WHERE email = $1',
      [req.user.email]
    );
    if (!cRows.length) return res.json({ tokens: [] });

    const { rows } = await pool.query(
      `SELECT id, name, key_prefix, scopes, last_used, expires_at, created_at
       FROM api_keys
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [cRows[0].id]
    );
    res.json({ tokens: rows });
  } catch (err) {
    // Table might not exist yet — return empty gracefully
    if (err.code === '42P01') return res.json({ tokens: [] });
    res.status(500).json({ error: { message: 'Failed to fetch tokens' } });
  } finally {
    await pool.end().catch(() => {});
  }
});

// POST /v1/tokens — create new token (returns raw key ONCE, never stored)
router.post('/', requireAuth, express.json(), async (req, res) => {
  const { name, scopes, expiresAt } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: { message: 'name is required' } });

  const pool = getPool();
  try {
    const { rows: cRows } = await pool.query(
      'SELECT id FROM customers WHERE email = $1',
      [req.user.email]
    );
    if (!cRows.length) return res.status(404).json({ error: { message: 'User not found' } });

    // Generate secure random key: ant_live_<32 base64url bytes>
    const rawKey    = 'ant_live_' + crypto.randomBytes(24).toString('base64url');
    const keyHash   = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 17) + '...';  // only show prefix in UI

    const validScopes = ['read', 'write', 'admin'];
    const finalScopes = Array.isArray(scopes)
      ? scopes.filter(s => validScopes.includes(s))
      : ['read', 'write'];

    await pool.query(
      `INSERT INTO api_keys (customer_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cRows[0].id, name.trim(), keyHash, keyPrefix, finalScopes, expiresAt || null]
    );

    // Return the raw key ONCE — this is the only time the plain key is visible
    res.status(201).json({
      message: 'Token created. Copy it now — it will not be shown again.',
      token:  rawKey,
      prefix: keyPrefix,
      name:   name.trim(),
      scopes: finalScopes,
    });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: { message: 'Token storage not initialized. Run migrations.' } });
    }
    res.status(500).json({ error: { message: 'Failed to create token' } });
  } finally {
    await pool.end().catch(() => {});
  }
});

// DELETE /v1/tokens/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const { rows: cRows } = await pool.query(
      'SELECT id FROM customers WHERE email = $1',
      [req.user.email]
    );
    if (!cRows.length) return res.status(404).json({ error: { message: 'User not found' } });

    const result = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND customer_id = $2 RETURNING id',
      [req.params.id, cRows[0].id]
    );

    if (!result.rowCount) return res.status(404).json({ error: { message: 'Token not found' } });
    res.json({ message: 'Token revoked' });
  } finally {
    await pool.end().catch(() => {});
  }
});

module.exports = router;
