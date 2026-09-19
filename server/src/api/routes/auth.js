'use strict';
const express = require('express');
const router = express.Router();

// Auth routes proxy to GoTrue (Ananta Auth server)
const GOTRUE_URL = process.env.GOTRUE_URL || 'http://localhost:9999';

async function proxyToAuth(req, res, endpoint) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    const response = await fetch(`${GOTRUE_URL}${endpoint}`, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({ error: { code: 'ANANTA_5030', message: 'Authentication service unavailable' } });
  }
}

router.post('/signup',    express.json(), (req, res) => proxyToAuth(req, res, '/signup'));
router.post('/signin',    express.json(), (req, res) => proxyToAuth(req, res, '/token?grant_type=password'));
router.post('/signout',   express.json(), (req, res) => proxyToAuth(req, res, '/logout'));
router.post('/refresh',   express.json(), (req, res) => proxyToAuth(req, res, '/token?grant_type=refresh_token'));
router.get('/user',       (req, res)    => proxyToAuth(req, res, '/user'));

module.exports = router;
