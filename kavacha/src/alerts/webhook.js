'use strict';
const pino   = require('pino');
const logger = pino({ name: 'kavacha-alert', level: 'info' });

async function sendAlert(message) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) { logger.warn('[alert] No ALERT_WEBHOOK_URL set'); return; }
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: '[KAVACHA] ' + message, ts: new Date().toISOString() })
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Alert webhook failed');
  }
}

module.exports = { sendAlert };
