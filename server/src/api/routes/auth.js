'use strict';
/**
 * /v1/auth/* — Authentication routes
 *
 * POST /v1/auth/signup         — proxy to GoTrue
 * POST /v1/auth/signin         — proxy to GoTrue
 * POST /v1/auth/signout        — proxy to GoTrue
 * POST /v1/auth/refresh        — proxy to GoTrue
 * GET  /v1/auth/user           — proxy to GoTrue
 * GET  /v1/auth/me             — returns full Ananta user row (assigned_nodes etc.)
 * PATCH /v1/auth/profile       — update display name in DB
 */
const express = require('express');
const router  = express.Router();

const GOTRUE_URL = process.env.GOTRUE_URL || 'http://localhost:9999';

// ── Shared helpers ────────────────────────────────────────────────────────────

function parseJWT(token) {
  try {
    const b      = token.split('.')[1];
    const base64 = b.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

function requireToken(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) { res.status(401).json({ error: { message: 'Authorization header required' } }); return null; }
  const payload = parseJWT(token);
  if (!payload || !payload.email) { res.status(401).json({ error: { message: 'Invalid token' } }); return null; }
  if (payload.exp < Date.now() / 1000) { res.status(401).json({ error: { message: 'Token expired' } }); return null; }
  return payload;
}

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const { Pool } = require('pg');
  _pool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return _pool;
}

async function proxyToAuth(req, res, endpoint) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    const response = await fetch(GOTRUE_URL + endpoint, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(503).json({ error: { code: 'ANANTA_5030', message: 'Authentication service unavailable' } });
  }
}

// ── GoTrue proxy routes ───────────────────────────────────────────────────────
router.post('/signup',  express.json(), (req, res) => proxyToAuth(req, res, '/signup'));
router.post('/signin',  express.json(), (req, res) => proxyToAuth(req, res, '/token?grant_type=password'));
router.post('/signout', express.json(), (req, res) => proxyToAuth(req, res, '/logout'));
router.post('/refresh', express.json(), (req, res) => proxyToAuth(req, res, '/token?grant_type=refresh_token'));
router.get('/user',     (req, res)    => proxyToAuth(req, res, '/user'));

// ── PATCH /v1/auth/profile — update display name ──────────────────────────────
router.patch('/profile', express.json(), async (req, res) => {
  const payload = requireToken(req, res);
  if (!payload) return;

  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: { message: 'name is required' } });

  try {
    const p = getPool();
    const { rowCount } = await p.query(
      `UPDATE customers SET name = $1, updated_at = NOW() WHERE email = $2`,
      [name.trim(), payload.email]
    );
    if (!rowCount) return res.status(404).json({ error: { message: 'User not found' } });

    // Audit log
    try {
      const { writeAuditLog } = require('../provisioner');
      await writeAuditLog(payload.email, 'profile_updated', { name: name.trim() });
    } catch {}

    res.json({ message: 'Profile updated', name: name.trim() });
  } catch {
    res.status(500).json({ error: { message: 'Update failed' } });
  }
});

// ── GET /v1/auth/me — full user row ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const payload = requireToken(req, res);
  if (!payload) return;

  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT id, name, email, role, plan, status,
              assigned_nodes, billing_plan, billing_cycle_end,
              created_at
       FROM customers WHERE email = $1`,
      [payload.email]
    );
    if (!rows.length) return res.status(404).json({ error: { message: 'User not found' } });

    const user = rows[0];
    // Never expose which providers are backing each node category
    // assigned_nodes is used internally — return a simplified "has_*" map for the UI
    const capabilities = {
      has_pg:     !!(user.assigned_nodes?.pg),
      has_doc:    !!(user.assigned_nodes?.doc),
      has_vector: !!(user.assigned_nodes?.vector),
      has_cache:  !!(user.assigned_nodes?.cache),
      has_files:  !!(user.assigned_nodes?.files),
    };

    res.json({
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        plan:        user.plan,
        status:      user.status,
        created_at:  user.created_at,
        capabilities,
        // assigned_nodes is intentionally NOT returned — would expose provider names
      },
    });
  } catch {
    res.status(500).json({ error: { message: 'Failed to fetch user data' } });
  }
});

// ── GET /v1/auth/me/connections — connection strings for the user ─────────────
// Returns only Ananta-branded connection strings. No vendor names exposed.
router.get('/me/connections', async (req, res) => {
  const payload = requireToken(req, res);
  if (!payload) return;

  try {
    const p  = getPool();
    const { rows } = await p.query(
      `SELECT assigned_nodes, plan FROM customers WHERE email = $1`,
      [payload.email]
    );
    if (!rows.length) return res.status(404).json({ error: { message: 'User not found' } });

    const { assigned_nodes: nodes, plan } = rows[0];
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    // Use a safe project ref: first segment of email (no domain) max 12 chars, alphanumeric
    const ref = payload.email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();

    // Build connection strings — all pointing to Ananta's own domains
    const connections = {};

    if (nodes?.pg) {
      connections.relational = {
        direct:       `postgresql://${ref}:${token}@sql.ananta.io:5432/${ref}`,
        pooled:       `postgresql://${ref}:${token}@sql.ananta.io:6543/${ref}?pgbouncer=true`,
        session:      `postgresql://${ref}:${token}@sql.ananta.io:5432/${ref}`,
      };
    }

    if (nodes?.doc) {
      connections.document = {
        uri:      `mongodb://${token}@db.ananta.io:27017/${ref}`,
        database: ref,
        port:     27017,
      };
    }

    if (nodes?.vector) {
      connections.vector = {
        endpoint: `https://vector.ananta.io/v1`,
        api_key:  token,
        namespace: ref,
      };
    }

    if (nodes?.cache) {
      connections.cache = {
        uri:  `redis://:${token}@cache.ananta.io:6379`,
        host: 'cache.ananta.io',
        port: 6379,
      };
    }

    if (nodes?.files) {
      connections.files = {
        endpoint:   `https://files.ananta.io`,
        access_key: ref,
        secret_key: token,
        bucket:     ref,
      };
    }

    // REST / SDK (always available regardless of node assignment)
    connections.rest = {
      base_url:   'https://api.ananta.io/v1',
      auth_header: `Authorization: Bearer ${token}`,
    };

    connections.sdk = {
      install: 'npm install @ananta/js',
      init:    `const db = createClient('https://api.ananta.io', '${token}')`,
    };

    res.json({ connections, plan });
  } catch {
    res.status(500).json({ error: { message: 'Failed to fetch connection info' } });
  }
});

module.exports = router;
