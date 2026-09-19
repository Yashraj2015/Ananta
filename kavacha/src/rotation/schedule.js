const cron = require('node-cron');
const { rotateAtlasPassword } = require('./atlas-rotator');
const { getCredential } = require('../vault/credentials');
const pino = require('pino');
const logger = pino({ name: 'kavacha-schedule' });

const startSchedule = () => {
  cron.schedule('0 0 */7 * *', async () => {
    logger.info('[KAVACHA] Rotation schedule triggered');
    const nodes = ['node-a1', 'node-a2', 'node-a3'];
    for (const code of nodes) {
      const cred = getCredential(code);
      if (cred) {
        logger.info(`[KAVACHA] Rotation scheduled for ${code}`);
        try {
          await rotateAtlasPassword(code);
        } catch (e) {
          logger.error(`[KAVACHA] Rotation failed for ${code}`);
        }
      }
    }
  });
  logger.info('[KAVACHA] Schedules started');
};

module.exports = { startSchedule };
