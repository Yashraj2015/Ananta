'use strict';
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const compression = require('compression');
const errorSanitizer  = require('../middleware/error-sanitizer');
const authenticate    = require('./middleware/authenticate');
const protocolsRouter  = require('../protocols/index');
const googleOAuthRouter = require('./routes/google-oauth');
const adminRouter       = require('./routes/admin/index');
const { router: metricsRouter, countRequest } = require('./routes/metrics');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Count every API request for analytics
app.use(countRequest);

// Google OAuth (public — before auth middleware)
app.use('/v1/auth/google', googleOAuthRouter);

// Core public routes
app.use('/v1/auth',     require('./routes/auth'));
app.use('/v1/internal', require('./routes/internal'));

// Metrics (public — read-only system info)
app.use('/v1/metrics', metricsRouter);

// Multi-platform protocol adapters (PostgREST /rest/v1/*, GraphQL /graphql, Telegram)
app.use('/', protocolsRouter);

// Admin (protected by x-ananta-admin-key, handled inside the router)
app.use('/v1/admin', adminRouter);

// Tenant data API (protected by JWT)
app.use('/v1/data', authenticate, require('./routes/collections'));

// Health
app.get('/v1/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Error sanitizer — strips vendor names from ALL outbound errors
app.use(errorSanitizer);

module.exports = app;
