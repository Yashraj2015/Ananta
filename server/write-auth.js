const fs = require('fs')

const content = `'use strict';
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

// Auth routes proxy to GoTrue (Ananta Auth server)
const GOTRUE_URL = process.env.GOTRUE_URL || 'http://localhost:9999';
const JWT_SECRET = process.env.ANANTA_JWT_SECRET || 'dev-jwt-secret-change-in-prod';

// ── GoTrue proxy helpers ──────────────────────────────────────────────────────

async function proxyToAuth(req, res, endpoint) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    const response = await fetch(GOTRUE_URL + endpoint, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({ error: { code: 'ANANTA_5030', message: 'Authentication service unavailable' } });
  }
}

function parseJWT(token) {
  try {
    const b = token.split('.')[1];
    const base64 = b.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

// ── GoTrue proxy routes ───────────────────────────────────────────────────────

router.post('/signup',  express.json(), (req, res) => proxyToAuth(req, res, '/signup'));
router.post('/signin',  express.json(), (req, res) => proxyToAuth(req, res, '/token?grant_type=password'));
router.post('/signout', express.json(), (req, res) => proxyToAuth(req, res, '/logout'));
router.post('/refresh', express.json(), (req, res) => proxyToAuth(req, res, '/token?grant_type=refresh_token'));
router.get('/user',     (req, res)    => proxyToAuth(req, res, '/user'));

// ── PATCH /v1/auth/profile ────────────────────────────────────────────────────
// Update the logged-in user's name in the customers table.
// Reads JWT from Authorization: Bearer <token>
router.patch('/profile', express.json(), async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: { message: 'No token' } });

    const payload = parseJWT(token);
    if (!payload || !payload.email) return res.status(401).json({ error: { message: 'Invalid token' } });
    if (payload.exp < Date.now() / 1000) return res.status(401).json({ error: { message: 'Token expired' } });

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: { message: 'name is required' } });

    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });

    await pool.query(
      'UPDATE customers SET name = $1, updated_at = NOW() WHERE email = $2',
      [name.trim(), payload.email]
    );
    await pool.end();

    res.json({ message: 'Profile updated', name: name.trim() });
  } catch (err) {
    console.error('[auth] profile update error:', err.message);
    res.status(500).json({ error: { message: 'Update failed' } });
  }
});

// ── GET /v1/auth/me ───────────────────────────────────────────────────────────
// Returns the logged-in user's DB row (name, email, role, plan)
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: { message: 'No token' } });
    const payload = parseJWT(token);
    if (!payload?.email) return res.status(401).json({ error: { message: 'Invalid token' } });

    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
      ssl: { rejectUnauthorized: false }, max: 2,
    });
    const { rows } = await pool.query(
      'SELECT name, email, role, plan, status, assigned_mongo_node, assigned_pg_node, assigned_r2_node FROM customers WHERE email = $1',
      [payload.email]
    );
    await pool.end();
    if (!rows.length) return res.status(404).json({ error: { message: 'User not found' } });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
`

fs.writeFileSync(
  'd:\\\\Smars\\\\Smars\\\\Ananta\\\\server\\\\src\\\\api\\\\routes\\\\auth.js',
  content,
  { encoding: 'utf8' }
)
console.log('Written auth routes')
`
