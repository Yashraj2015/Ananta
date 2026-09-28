'use strict';
/**
 * Error Sanitizer Middleware
 * ──────────────────────────
 * Strips ALL vendor-specific names, internal hostnames, connection strings,
 * and infrastructure details from outbound API error responses.
 *
 * Users must NEVER see: Neon, Supabase, MongoDB, Atlas, Pinecone, Qdrant,
 * Weaviate, Cloudflare, Upstash, Turso, CockroachDB, Firebase, Appwrite, etc.
 */
const { log } = require('../utils/logger');

// ── Vendor name patterns (order matters — more specific first) ────────────────
const VENDOR_PATTERNS = [
  // Specific hostnames / URLs
  /[a-z0-9-]+\.neon\.tech/gi,
  /[a-z0-9-]+\.supabase\.co/gi,
  /[a-z0-9-]+\.supabase\.com/gi,
  /[a-z0-9-]+\.mongodb\.net/gi,
  /[a-z0-9-]+\.atlas\.mongodb\.com/gi,
  /[a-z0-9-]+\.pinecone\.io/gi,
  /[a-z0-9-]+\.svc\.pinecone\.io/gi,
  /[a-z0-9-]+\.qdrant\.io/gi,
  /[a-z0-9-]+\.weaviate\.network/gi,
  /[a-z0-9-]+\.upstash\.io/gi,
  /[a-z0-9-]+\.turso\.io/gi,
  /[a-z0-9-]+\.cockroachdb\.cloud/gi,
  /[a-z0-9-]+\.firebaseio\.com/gi,
  /[a-z0-9-]+\.firebasedatabase\.app/gi,
  /[a-z0-9-]+\.cloudfirestore\.com/gi,
  /[a-z0-9-]+\.appwrite\.io/gi,
  /[a-z0-9-]+\.cloudflare\.com/gi,
  /[a-z0-9-]+\.r2\.cloudflarestorage\.com/gi,
  /[a-z0-9-]+\.railway\.app/gi,
  /[a-z0-9-]+\.fly\.io/gi,
  /[a-z0-9-]+\.render\.com/gi,
  /[a-z0-9-]+\.xata\.io/gi,
  /[a-z0-9-]+\.convex\.cloud/gi,
  /[a-z0-9-]+\.voroa\.app/gi,

  // Internal IP/host patterns
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{4,5}/g,   // 192.168.x.x:PORT
  /localhost:\d+/g,

  // Connection string schemes
  /mongodb(\+srv)?:\/\/[^\s"']+/gi,
  /postgresql:\/\/[^\s"']+/gi,
  /postgres:\/\/[^\s"']+/gi,
  /redis:\/\/[^\s"']+/gi,
  /rediss:\/\/[^\s"']+/gi,
  /mysql:\/\/[^\s"']+/gi,

  // Vendor brand names (standalone words)
  /\bneon\b/gi,
  /\bsupabase\b/gi,
  /\bmongodb\b/gi,
  /\batlas\b/gi,
  /\bpinecone\b/gi,
  /\bqdrant\b/gi,
  /\bweaviate\b/gi,
  /\bupstash\b/gi,
  /\bturso\b/gi,
  /\bcockroachdb\b/gi,
  /\bcockcroach\b/gi,
  /\bfirebase\b/gi,
  /\bfirestore\b/gi,
  /\bappwrite\b/gi,
  /\bferretdb\b/gi,
  /\bpgbouncer\b/gi,
  /\bpgcat\b/gi,
  /\bpgpool\b/gi,
  /\bpostgrest\b/gi,
  /\bneon_owner\b/gi,
  /\bneondb_owner\b/gi,

  // Remove any key-like strings (long hex/base64 that might be credentials)
  /\b[A-Za-z0-9+/=]{40,}\b/g,
];

// Replacement: neutral internal error label
const REPLACEMENT = '[internal]';

function sanitize(str) {
  if (typeof str !== 'string') return str;
  let s = str;
  for (const pattern of VENDOR_PATTERNS) {
    s = s.replace(pattern, REPLACEMENT);
  }
  return s;
}

/**
 * Express error-handling middleware.
 * Must be the LAST middleware registered in server.js.
 */
function errorSanitizer(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Build sanitized message
  const raw     = err.message || 'Internal server error';
  const message = sanitize(raw);

  // Status code: use err.status, err.statusCode, or fall back to 500
  const status  = err.status || err.statusCode || 500;

  // Log the REAL error internally (not the sanitized one) for debugging
  log.error('[api] error', {
    method:  req.method,
    url:     req.url,
    status,
    code:    err.code,
    message: raw,   // raw — for internal logs
  });

  // Send the SANITIZED response to the client
  res.status(status).json({
    error: {
      code:    err.code || `ANANTA_${status}`,
      message,
    },
  });
}

module.exports = errorSanitizer;
