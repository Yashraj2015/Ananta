'use strict';
/**
 * protocols/index.js — Multi-platform protocol support
 *
 * Ananta supports ANY client library. Platform detection + routing:
 *
 * WIRE PROTOCOLS (TCP listeners):
 *   - MongoDB wire (port 27017)  → LibreChat, Mongoose, MongoDB driver
 *   - PostgreSQL wire (port 5432) → psql, Prisma, Drizzle, SQLAlchemy
 *
 * HTTP REST PROTOCOLS (all on port 8080):
 *   - /v1/data/*          → Ananta REST (our SDK, curl, custom clients)
 *   - /rest/v1/*          → PostgREST-compatible (Supabase SDK, smars-webui)
 *   - /graphql            → GraphQL endpoint
 *   - /v1/auth/*          → GoTrue-compatible auth (any Supabase auth client)
 *   - /v1/storage/*       → Storage-Object-compatible (Supabase storage clients)
 *   - /v1/realtime/*      → WebSocket (Supabase realtime clients)
 *
 * TELEGRAM / BOT PLATFORMS:
 *   - /v1/webhooks/telegram → Telegram bot data endpoints
 *
 * MOBILE:
 *   - Same /v1/* REST + our SDK (works in React Native, Flutter via HTTP)
 */

const express = require('express');
const router  = express.Router();

// ── PostgREST-compatible layer (/rest/v1/*) ───────────────────────────────────
// Smars-webui uses the Supabase JS SDK which calls /rest/v1/table?select=...
// We translate these to our internal data layer
router.use('/rest/v1', require('./adapters/postgrest-adapter'));

// ── GraphQL (/graphql) ────────────────────────────────────────────────────────
router.use('/graphql', require('./adapters/graphql-adapter'));

// ── Telegram webhook data (/v1/webhooks/telegram) ─────────────────────────────
router.use('/v1/webhooks/telegram', require('./adapters/telegram-adapter'));

module.exports = router;