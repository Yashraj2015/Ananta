const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const errorSanitizer = require('../middleware/error-sanitizer');

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Routes
app.use('/v1/data', require('./routes/collections'));
app.use('/v1/internal', require('./routes/internal'));

app.use(errorSanitizer);

module.exports = app;