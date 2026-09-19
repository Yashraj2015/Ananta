'use strict';
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const compression = require('compression');
const errorSanitizer = require('../middleware/error-sanitizer');
const authenticate   = require('./middleware/authenticate');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(compression());

// Public routes
app.use('/v1/auth',     require('./routes/auth'));
app.use('/v1/internal', require('./routes/internal'));

// Protected routes
app.use('/v1/data',  authenticate, require('./routes/collections'));

// Health (also at /v1/health for CF Workers to check)
app.get('/v1/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use(errorSanitizer);

module.exports = app;
