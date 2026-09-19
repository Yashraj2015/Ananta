const { log } = require('../utils/logger');

const VENDOR_PATTERNS = [/MongoDB/gi, /Neon/gi, /Supabase/gi, /Cloudflare/gi, /Atlas/gi, /FerretDB/gi, /PostgREST/gi, /PgCat/gi];

function sanitizeError(err, req, res, next) {
  let message = err.message || 'Internal Server Error';
  
  VENDOR_PATTERNS.forEach(pattern => {
    message = message.replace(pattern, 'ananta-internal');
  });
  
  const response = {
    error: {
      code: err.code || 'ANANTA_5001',
      message
    }
  };
  
  log.error('API Error', { url: req.url, error: message });
  res.status(err.status || 500).json(response);
}

module.exports = sanitizeError;