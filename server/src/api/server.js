'use strict';
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const errorSanitizer   = require('../middleware/error-sanitizer');
const authenticate     = require('./middleware/authenticate');
const protocolsRouter  = require('../protocols/index');
const googleOAuthRouter = require('./routes/google-oauth');
const adminRouter       = require('./routes/admin/index');
const { router: metricsRouter, countRequest } = require('./routes/metrics');

const app = express();

// Trust reverse proxy (Cloudflare, Railway, Fly.io, nginx, etc.)
// Required for rate limiting to use real client IP, not proxy IP
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // handled by Next.js Studio
}));

// ── CORS ───────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // In dev allow all; in prod restrict to configured origins
    if (!origin || process.env.NODE_ENV !== 'production' || ALLOWED_ORIGINS.length === 0) {
      return cb(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ──────────────────────────────────────────────────────────────
let rateLimit;
try { rateLimit = require('express-rate-limit'); } catch {}

if (rateLimit) {
  // Strict limit for auth endpoints — prevent brute force
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait 15 minutes.' } },
  });

  // General API limit
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
    skip: (req) => req.path.startsWith('/v1/health') || req.path.startsWith('/v1/metrics'),
  });

  app.use('/v1/auth', authLimiter);
  app.use('/', apiLimiter);
} else {
  console.warn('[server] express-rate-limit not installed — run: npm install express-rate-limit');
}

// ── Request counter (analytics) ───────────────────────────────────────────────
app.use(countRequest);

// ── Public routes (no auth) ───────────────────────────────────────────────────

// Google OAuth
app.use('/v1/auth/google', googleOAuthRouter);

// Auth (signup/signin/profile/me)
app.use('/v1/auth', require('./routes/auth'));

// Internal service-to-service
app.use('/v1/internal', require('./routes/internal'));

// Metrics (public read-only system info)
app.use('/v1/metrics', metricsRouter);

// Health check
app.get('/v1/health', (req, res) => res.json({ status: 'ok', ts: Date.now(), uptime: process.uptime() }));

// ── Protected routes ──────────────────────────────────────────────────────────

// Admin (protected by x-ananta-admin-key inside the router)
app.use('/v1/admin', adminRouter);

// Tenant data API (protected by JWT)
app.use('/v1/data', authenticate, require('./routes/collections'));

// API key tokens (protected by JWT inside the router)
app.use('/v1/tokens', require('./routes/tokens'));

// Multi-platform protocol adapters (PostgREST /rest/v1/*, GraphQL, etc.)
app.use('/', protocolsRouter);

// ── Error sanitizer ───────────────────────────────────────────────────────────
// Strips vendor names (Supabase, Atlas, Neon, etc.) from ALL outbound error messages
app.use(errorSanitizer);

module.exports = app;
