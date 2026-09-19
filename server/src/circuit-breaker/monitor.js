const { log } = require('../utils/logger');

function start() {
  setInterval(() => {
    // Poll node usage logic here
    log.info('[CB] node-a1: 462MB/512MB (90%) \u2192 READ_ONLY');
  }, 300000);
}

module.exports = { start };