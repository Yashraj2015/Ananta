const express = require('express');
const app = express();

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/readyz', (req, res) => {
  // Check internal services ready logic here
  res.json({ status: 'ready', ts: Date.now() });
});

module.exports = app;