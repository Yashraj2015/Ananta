const express = require('express');
const app = express();

app.post('/v1/files/upload', (req, res) => {
  res.json({ success: true });
});

app.get('/v1/files/:key', (req, res) => {
  res.json({ success: true });
});

app.delete('/v1/files/:key', (req, res) => {
  res.json({ success: true });
});

module.exports = app;