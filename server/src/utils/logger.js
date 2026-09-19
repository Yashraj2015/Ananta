const pino = require('pino');

const VENDOR_PATTERNS = [/MongoDB/gi, /Neon/gi, /Supabase/gi, /Cloudflare/gi, /Atlas/gi, /FerretDB/gi, /PostgREST/gi, /PgCat/gi];

const stream = process.env.NODE_ENV === 'production' 
  ? pino.destination(1) 
  : require('pino-pretty')();

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    log: (obj) => {
      let str = JSON.stringify(obj);
      VENDOR_PATTERNS.forEach(pattern => {
        str = str.replace(pattern, 'ananta-internal');
      });
      return JSON.parse(str);
    }
  }
}, stream);

module.exports = {
  log: {
    info: (...args) => pinoLogger.info(...args),
    warn: (...args) => pinoLogger.warn(...args),
    error: (...args) => pinoLogger.error(...args),
    trace: (...args) => pinoLogger.trace(...args),
    debug: (...args) => pinoLogger.debug(...args)
  }
};