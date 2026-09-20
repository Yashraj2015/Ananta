'use strict';
/**
 * google-oauth.js — Google OAuth handler
 * GET  /v1/auth/google         — redirect to Google
 * GET  /v1/auth/google/callback — handle callback, issue JWT, set cookie
 */
const express  = require('express');
const https    = require('https');
const crypto   = require('crypto');
const router   = express.Router();

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET           = process.env.ANANTA_JWT_SECRET || 'dev-jwt-secret';
const BASE_URL             = process.env.ANANTA_PUBLIC_URL || 'http://localhost:8080';
const REDIRECT_URI         = BASE_URL + '/v1/auth/google/callback';

// Simple state store (in-memory, short-lived)
const states = new Map();

function makeJWT(payload) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400 })).toString('base64url');
  const sig     = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = ''; res.on('data', c => { d += c; }); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const u    = new URL(url);
    const req  = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => { let d=''; res.on('data',c=>{d+=c;}); res.on('end',()=>resolve(JSON.parse(d))); });
    req.on('error', reject); req.write(body); req.end();
  });
}

// ── Step 1: Redirect to Google ────────────────────────────────────────────────
router.get('/', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: { message: 'Google OAuth not configured' } });
  const state = crypto.randomBytes(16).toString('hex');
  states.set(state, { created: Date.now(), returnTo: req.query.returnTo || '/' });
  setTimeout(() => states.delete(state), 10 * 60 * 1000); // 10 min TTL

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

// ── Step 2: Handle callback ───────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/sign-in?error=' + encodeURIComponent(error));
  if (!state || !states.has(state)) return res.redirect('/sign-in?error=invalid_state');

  const { returnTo } = states.get(state);
  states.delete(state);

  try {
    // Exchange code for tokens
    const tokens = await httpsPost('https://oauth2.googleapis.com/token', {
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    });

    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Get user info
    const userInfo = await httpsGet('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + tokens.access_token);

    // Issue Ananta JWT
    const ADMIN_EMAIL = process.env.ANANTA_ADMIN_EMAIL || 'shreyashshastri2015@gmail.com';
    const jwt = makeJWT({
      sub:   userInfo.sub,
      email: userInfo.email,
      name:  userInfo.name,
      role:  userInfo.email === ADMIN_EMAIL ? 'admin' : 'authenticated',
      provider: 'google',
      avatar: userInfo.picture,
    });

    // Set cookie + redirect to studio
    const studioUrl = process.env.STUDIO_URL || 'http://localhost:3003';
    res.setHeader('Set-Cookie', [
      `ananta-token=${jwt}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      `ananta-user=${encodeURIComponent(JSON.stringify({ email: userInfo.email, name: userInfo.name, avatar: userInfo.picture, role: userInfo.email === ADMIN_EMAIL ? 'admin' : 'user' }))}; Path=/; SameSite=Lax; Max-Age=86400`,
    ]);

    // Redirect to studio with token in query so Studio can pick it up
    res.redirect(`${studioUrl}/project/default?auth_token=${jwt}&user=${encodeURIComponent(userInfo.email)}`);
  } catch (err) {
    console.error('[google-oauth] error:', err.message);
    res.redirect('/sign-in?error=oauth_failed');
  }
});

module.exports = router;