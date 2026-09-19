const { log } = require('../utils/logger');

function start() {
  setInterval(() => {
    // Silent keep-alive pinger logic here
    log.info('[HB] node-a1 ok (22ms)');
  }, 3600000);
}

module.exports = { start };