'use strict';
const { rotateAtlasPassword } = require('./atlas-rotator');
const { getCredential, listNodes } = require('../vault/credentials');
const { audit } = require('../audit/logger');
const pino   = require('pino');
const logger = pino({ name: 'kavacha-schedule', level: process.env.LOG_LEVEL || 'info' });

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function startSchedule() {
  // Rotate all Atlas nodes every 7 days
  const atlasNodes = listNodes().filter(n => n.type === 'atlas');
  logger.info({ count: atlasNodes.length }, 'Starting rotation schedules');

  for (const { nodeCode } of atlasNodes) {
    // Stagger rotations by node index to avoid simultaneous API calls
    const index   = parseInt(nodeCode.replace('node-a', '')) || 1;
    const stagger = (index - 1) * 60 * 60 * 1000; // 1hr apart

    setTimeout(() => {
      setInterval(() => {
        rotateAtlasPassword(nodeCode).catch(err => {
          logger.error({ nodeCode, err: err.message }, 'Scheduled rotation failed');
        });
      }, SEVEN_DAYS_MS);
    }, stagger);
  }
}

module.exports = { startSchedule };
