'use strict';
require('dotenv').config();
const fs = require('fs');
const https = require('https');
const http = require('http');
const express = require('express');
const pino = require('pino');

const logger = pino({ name: 'kavacha', level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(express.json({ limit: '64kb' }));

// Resolve modules after dotenv
const { ipAllowlist } = require('./auth/ip-allowlist');
const { verifyMtls } = require('./auth/mtls');
const tokenRoutes = require('./routes/token');
const revokeRoutes = require('./routes/revoke');
const healthRoutes = require('./routes/health');
const { startSchedule } = require('./rotation/schedule');
const { initAuditLog } = require('./audit/logger');
const { loadCredentials } = require('./vault/credentials');

loadCredentials();
initAuditLog();

// ---- Public routes (no auth) ----
app.use('/healthz', healthRoutes.healthz);
app.use('/audit-recent', healthRoutes.audit);

// ---- Protected routes ----
app.use(ipAllowlist);
app.use(verifyMtls);
app.use('/token', tokenRoutes);
app.use('/revoke', revokeRoutes);

// ---- Global error handler ----
app.use((err, req, res, _next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'internal_error' });
});

// ---- TLS setup ----
let tlsOptions = null;
const tlsKey  = process.env.KAVACHA_TLS_KEY_PATH;
const tlsCert = process.env.KAVACHA_TLS_CERT_PATH;
const tlsCa   = process.env.KAVACHA_CA_PATH;

if (tlsKey && tlsCert && tlsCa) {
  try {
    tlsOptions = {
      key:  fs.readFileSync(tlsKey),
      cert: fs.readFileSync(tlsCert),
      ca:   fs.readFileSync(tlsCa),
      requestCert:       true,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.3'
    };
    logger.info('TLS certs loaded — mTLS mode active');
  } catch (err) {
    logger.warn({ err }, 'TLS cert load failed — falling back to HTTP (dev only)');
  }
} else {
  logger.warn('TLS env vars not set — running in HTTP mode (dev only)');
}

const PORT = parseInt(process.env.PORT || '4001', 10);
const server = tlsOptions
  ? https.createServer(tlsOptions, app)
  : http.createServer(app);

// ---- Graceful shutdown ----
const shutdown = (sig) => {
  logger.info({ sig }, 'Shutdown signal received — closing server');
  server.close(() => {
    logger.info('HTTP(S) server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Force-exiting after shutdown timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

server.listen(PORT, () => {
  logger.info({ port: PORT, tls: !!tlsOptions }, 'Kavacha vault server ready');
  startSchedule();
});
