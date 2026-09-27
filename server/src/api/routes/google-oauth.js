'use strict';
/**
 * google-oauth.js — Ananta Google OAuth
 * GET /v1/auth/google           → redirect to Google
 * GET /v1/auth/google/callback  → exchange code, upsert user, issue JWT
 *
 * First user to ever sign in gets role='admin' automatically — no key needed.
 * Every subsequent user from ANANTA_ADMIN_EMAIL also gets admin.
 */

const express = require('express');
const https   = require('https');
const crypto  = require('crypto');
const router  = express.Router();

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET           = process.env.ANANTA_JWT_SECRET || 'dev-jwt-secret-change-in-prod';
const BASE_URL             = process.env.ANANTA_PUBLIC_URL || 'http://localhost:8080';
const REDIRECT_URI         = `${BASE_URL}/v1/auth/google/callback`;
const STUDIO_URL           = process.env.STUDIO_URL || 'http://localhost:3003';
const ADMIN_EMAILS         = (process.env.ANANTA_ADMIN_EMAIL || 'shreyashshastri2015@gmail.com')
                               .split(',').map(e => e.trim().toLowerCase());

// In-memory state store (short-lived CSRF tokens)
const states = new Map();

// ─── Ctrl-plane DB client (lazy import to avoid circular) ─────────────────────
let ctrlPool = null;
function getPool() {
  if (ctrlPool) return ctrlPool;
  const { Pool } = require('pg');
  ctrlPool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return ctrlPool;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    iss: 'ananta-auth',
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig  = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const u    = new URL(url);
    const req  = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on('error', reject);
  });
}

// ─── Upsert user in ctrl-plane, return role ───────────────────────────────────
async function upsertUser(email, name, avatar, googleSub) {
  const pool = getPool();
  try {
    // Check if ANY user exists (first-user-is-admin logic)
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM customers WHERE provider = 'google'`
    );
    const isFirstUser = parseInt(countRows[0].cnt, 10) === 0;

    // Determine role
    const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());
    const role = (isFirstUser || isAdminEmail) ? 'admin' : 'user';

    // Upsert — id is TEXT NOT NULL (no pg default), use JS UUID
    const newId = crypto.randomUUID();
    await pool.query(`
      INSERT INTO customers (
        id, email, name, avatar, google_sub, provider, role, plan,
        status, created_at, updated_at
      )
      VALUES (
        $6, $1, $2, $3, $4, 'google', $5, 'free',
        'active', NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        name       = EXCLUDED.name,
        avatar     = EXCLUDED.avatar,
        google_sub = EXCLUDED.google_sub,
        role       = CASE
          WHEN customers.role = 'admin' THEN 'admin'
          ELSE EXCLUDED.role
        END,
        updated_at = NOW()
    `, [email, name || email, avatar, googleSub, role, newId]);

    // Fetch final role (in case they were already admin in DB)
    const { rows } = await pool.query(
      `SELECT role, plan FROM customers WHERE email = $1`, [email]
    );
    return rows[0] ?? { role, plan: 'free' };
  } catch (err) {
    console.warn('[auth] DB upsert failed, falling back to email-based role. Error:', err.message, err.code);
    const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';
    return { role, plan: 'free' };
  }
}

// ─── Step 1: Redirect to Google ───────────────────────────────────────────────
router.get('/', (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: { message: 'Google OAuth not configured' } });
  }

  const state = crypto.randomBytes(16).toString('hex');
  states.set(state, { created: Date.now(), returnTo: req.query.returnTo || '/' });
  setTimeout(() => states.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'online',
    prompt:        'select_account',
  });

  res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params);
});

// ─── Step 2: Handle callback ──────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(`${STUDIO_URL}/sign-in?error=${encodeURIComponent(error)}`);
  if (!state || !states.has(state)) return res.redirect(`${STUDIO_URL}/sign-in?error=invalid_state`);

  states.delete(state);

  try {
    // 1. Exchange auth code for tokens
    const tokens = await httpsPost('https://oauth2.googleapis.com/token', {
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });

    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // 2. Get Google user info
    const userInfo = await httpsGet(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokens.access_token}`
    );
    const { sub, email, name, picture } = userInfo;

    // 3. Upsert user in ctrl-plane DB (handles first-user-admin)
    const { role, plan } = await upsertUser(email, name, picture, sub);

    // 4. Issue Ananta JWT
    const jwt = makeJWT({ sub, email, name, avatar: picture, role, plan, provider: 'google' });

    // 5. Redirect to Studio /auth/callback — it stores the token on its own domain
    //    (cookies set at :8080 are NOT sent to :3003 in dev — use URL token instead)
    res.redirect(`${STUDIO_URL}/auth/callback?token=${jwt}&role=${role}`);
  } catch (err) {
    console.error('[google-oauth] callback error:', err.message);
    res.redirect(`${STUDIO_URL}/sign-in?error=oauth_failed`);
  }
});

// ─── GET /v1/auth/me — return current user from JWT ──────────────────────────
router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '') ||
                req.cookies?.['ananta-token'];
  if (!token) return res.status(401).json({ error: 'not authenticated' });
  try {
    const [, body] = token.split('.');
    const payload  = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now() / 1000) return res.status(401).json({ error: 'token expired' });
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
});

module.exports = router;