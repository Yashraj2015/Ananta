/**
 * fix-env.js
 * Rewrites server/.env cleanly — preserves all real values, removes garbled bytes,
 * leaves JWT_SECRET and INTERNAL_BROKER_KEY with clear REPLACE_ME placeholders.
 */
const fs = require('fs')

// Read current .env and extract only valid KEY=value lines
const raw = fs.readFileSync('server/.env', 'utf8')
const currentVars = {}
raw.split('\n').forEach(line => {
  const clean = line.replace(/[^\x20-\x7E\n\r]/g, '') // strip non-ASCII
  const m = clean.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) currentVars[m[1]] = m[2].trim()
})

const newEnv = `# ── Ananta Server Config ─────────────────────────────────────────────────────
# Edit this file directly — it is the real config (not .env.example)

# ── Ports ─────────────────────────────────────────────────────────────────────
PORT=3001
API_PORT=8080
FILES_PORT=8081
MONGO_PORT=27017

# ── Ctrl-plane (Ananta's own internal DB) ─────────────────────────────────────
CTRL_PLANE_URL=${currentVars.CTRL_PLANE_URL || 'https://zmegrjxbpsyvdtuhhvet.supabase.co'}
CTRL_PLANE_KEY=${currentVars.CTRL_PLANE_KEY || ''}
CTRL_PLANE_DIRECT=${currentVars.CTRL_PLANE_DIRECT || ''}
CTRL_PLANE_POOL_TXN=${currentVars.CTRL_PLANE_POOL_TXN || ''}
CTRL_PLANE_POOL_SESSION=${currentVars.CTRL_PLANE_POOL_SESSION || ''}
CTRL_PLANE_POOLER_URL=${currentVars.CTRL_PLANE_POOLER_URL || ''}

# ── Kavacha ───────────────────────────────────────────────────────────────────
KAVACHA_URL=http://localhost:4001
KAVACHA_SHARED_SECRET=${currentVars.KAVACHA_SHARED_SECRET || 'dev-kavacha-secret-change-in-production'}

# ── Admin / broker key  ← CHANGE THIS before production ──────────────────────
INTERNAL_BROKER_KEY=${currentVars.INTERNAL_BROKER_KEY || 'REPLACE_ME_strong_random_key'}

# ── JWT  ← CHANGE THIS before production ─────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
ANANTA_JWT_SECRET=${currentVars.ANANTA_JWT_SECRET || 'REPLACE_ME_generate_with_crypto_randomBytes'}

# ── Google OAuth ──────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=${currentVars.GOOGLE_CLIENT_ID || ''}
GOOGLE_CLIENT_SECRET=${currentVars.GOOGLE_CLIENT_SECRET || ''}
ANANTA_ADMIN_EMAIL=${currentVars.ANANTA_ADMIN_EMAIL || 'shreyashshastri2015@gmail.com'}
STUDIO_URL=${currentVars.STUDIO_URL || 'http://localhost:3003'}

# ── Public URL (set to https://api.yourdomain.com in production) ──────────────
ANANTA_PUBLIC_URL=${currentVars.ANANTA_PUBLIC_URL || 'http://localhost:8080'}

# ── CORS (comma-separated, set to https://app.yourdomain.com in production) ───
ALLOWED_ORIGINS=${currentVars.ALLOWED_ORIGINS || 'http://localhost:3003'}

# ── Razorpay (optional — billing returns 503 without these) ──────────────────
RAZORPAY_KEY_ID=${currentVars.RAZORPAY_KEY_ID || ''}
RAZORPAY_KEY_SECRET=${currentVars.RAZORPAY_KEY_SECRET || ''}
RAZORPAY_WEBHOOK_SECRET=${currentVars.RAZORPAY_WEBHOOK_SECRET || ''}

# ── Cloudflare Stream (optional — for video uploads over 100MB) ───────────────
CF_STREAM_ACCOUNT=${currentVars.CF_STREAM_ACCOUNT || ''}
CF_STREAM_TOKEN=${currentVars.CF_STREAM_TOKEN || ''}
`

fs.writeFileSync('server/.env', newEnv, 'utf8')
console.log('Done. server/.env rewritten cleanly.')
console.log('Current JWT secret:', (currentVars.ANANTA_JWT_SECRET || '').slice(0,40))
console.log('Current broker key:', (currentVars.INTERNAL_BROKER_KEY || '').slice(0,40))
