'use strict';
// GraphQL adapter — full implementation needs graphql-js or mercurius
// For now returns a basic introspection stub
const express = require('express');
const router  = express.Router();
router.post('/', (req, res) => {
  const { query } = req.body || {};
  if (query && query.includes('__schema')) {
    return res.json({ data: { __schema: { types: [] } } });
  }
  res.json({ data: null, errors: [{ message: 'GraphQL not yet wired to data layer' }] });
});
router.get('/', (req, res) => res.json({ message: 'Ananta GraphQL endpoint. POST a query.' }));
module.exports = router;