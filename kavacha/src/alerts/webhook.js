const axios = require('axios');
const pino = require('pino');
const logger = pino({ name: 'kavacha-alert' });

const sendAlert = async ({ event, nodeCode, ip, details }) => {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const msg = `🚨 *KAVACHA ALERT* 🚨\nEvent: ${event}\nNode: ${nodeCode || 'N/A'}\nIP: ${ip || 'N/A'}\nDetails: ${details}`;
  
  try {
    await axios.post(url, {
      text: msg,
      content: msg // in case of discord vs telegram
    });
    logger.info(`[KAVACHA] Sent alert for ${event}`);
  } catch (err) {
    logger.error(`[KAVACHA] Failed to send alert: ${err.message}`);
  }
};

module.exports = { sendAlert };
