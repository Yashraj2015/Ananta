const express = require('express');
const router = express.Router();

router.get('/broker', (req, res) => {
  const authHeader = req.headers['x-ananta-internal-key'];
  if (authHeader !== process.env.INTERNAL_BROKER_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({
    mongoUri: 'mongodb://smars.internal.ananta.io',
    s3Endpoint: 'https://s3.internal.ananta.io',
    s3Bucket: 'ananta-internal',
    s3Key: 'mock-key',
    s3Secret: 'mock-secret'
  });
});

module.exports = router;