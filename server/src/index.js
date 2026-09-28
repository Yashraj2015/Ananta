require('dotenv').config();
const { log } = require('./utils/logger');
const healthServer = require('./health/server');
const apiServer    = require('./api/server');
const filesServer  = require('./files/server');
const mongoProxy   = require('./mongo-proxy/server');
const circuitBreakerMonitor = require('./circuit-breaker/monitor');
const pinger = require('./pinger');

const PORT_API    = process.env.PORT_API    || 8080;
const PORT_FILES  = process.env.PORT_FILES  || 8081;
const PORT_MONGO  = process.env.PORT_MONGO  || 27017;
const PORT_HEALTH = process.env.PORT_HEALTH || 3001;

// ── Environment validation ────────────────────────────────────────────────────
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const errors  = [];
  const warnings = [];

  // ── Critical secrets ──────────────────────────────────────────────────────
  const jwtSecret = process.env.ANANTA_JWT_SECRET;
  if (!jwtSecret) {
    errors.push('ANANTA_JWT_SECRET is not set — JWTs will use an insecure fallback');
  } else if (jwtSecret === 'dev-jwt-secret-change-in-prod') {
    errors.push('ANANTA_JWT_SECRET is still the default dev value — change it before production!');
  } else if (jwtSecret.length < 32) {
    warnings.push('ANANTA_JWT_SECRET is less than 32 characters — use at least 64 random bytes');
  }

  const brokerKey = process.env.INTERNAL_BROKER_KEY;
  if (!brokerKey) {
    errors.push('INTERNAL_BROKER_KEY is not set — admin API is unprotected!');
  } else if (brokerKey === 'dev-broker-key-change-in-production') {
    errors.push('INTERNAL_BROKER_KEY is still the default dev value — change it before production!');
  } else if (brokerKey.length < 16) {
    warnings.push('INTERNAL_BROKER_KEY is very short — use at least 32 random bytes');
  }

  // ── Database ──────────────────────────────────────────────────────────────
  if (!process.env.CTRL_PLANE_URL) {
    errors.push('CTRL_PLANE_URL is not set — control plane DB unavailable');
  }
  if (!process.env.CTRL_PLANE_POOLER_URL && !process.env.CTRL_PLANE_DIRECT) {
    errors.push('CTRL_PLANE_POOLER_URL is not set — DB write operations will fail');
  }

  // ── Optional warnings ──────────────────────────────────────────────────────
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth will not work');
  }
  if (!process.env.ANANTA_PUBLIC_URL && isProd) {
    warnings.push('ANANTA_PUBLIC_URL not set — Google OAuth redirect URI will default to localhost:8080');
  }
  if (!process.env.STUDIO_URL && isProd) {
    warnings.push('STUDIO_URL not set — OAuth will redirect users back to localhost:3003');
  }

  // ── Print results ──────────────────────────────────────────────────────────
  warnings.forEach(w => log.warn(`[env] WARNING: ${w}`));

  if (errors.length > 0) {
    errors.forEach(e => log.error(`[env] CRITICAL: ${e}`));
    if (isProd) {
      log.error('[env] Production startup aborted due to missing/insecure environment variables.');
      log.error('[env] Fix the above issues before deploying. See .env.example for guidance.');
      process.exit(1);
    } else {
      log.warn('[env] Running in DEVELOPMENT mode with insecure config — DO NOT use in production.');
    }
  } else {
    log.info('[env] Environment validation passed');
  }

  return isProd;
}

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  validateEnv();

  try {
    healthServer.listen(PORT_HEALTH, () => log.info(`Health server listening on ${PORT_HEALTH}`));
    apiServer.listen(PORT_API,    () => log.info(`API server listening on ${PORT_API}`));
    filesServer.listen(PORT_FILES, () => log.info(`Files server listening on ${PORT_FILES}`));
    mongoProxy.listen(PORT_MONGO,  () => log.info(`Mongo proxy listening on ${PORT_MONGO}`));

    circuitBreakerMonitor.start();
    pinger.start();

    log.info('Ananta core server started successfully');
  } catch (err) {
    log.error('Failed to start servers', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  log.info('SIGTERM received, initiating graceful shutdown');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err.message);
  // Don't exit — keep serving, just log it
});

process.on('unhandledRejection', (reason) => {
  log.warn('Unhandled promise rejection:', reason);
});

start();