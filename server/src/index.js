require('dotenv').config();
const { log } = require('./utils/logger');
const healthServer = require('./health/server');
const apiServer = require('./api/server');
const filesServer = require('./files/server');
const mongoProxy = require('./mongo-proxy/server');
const circuitBreakerMonitor = require('./circuit-breaker/monitor');
const pinger = require('./pinger');

const PORT_API = process.env.PORT_API || 8080;
const PORT_FILES = process.env.PORT_FILES || 8081;
const PORT_MONGO = process.env.PORT_MONGO || 27017;
const PORT_HEALTH = process.env.PORT_HEALTH || 3001;

async function start() {
  try {
    healthServer.listen(PORT_HEALTH, () => log.info(`Health server listening on ${PORT_HEALTH}`));
    apiServer.listen(PORT_API, () => log.info(`API server listening on ${PORT_API}`));
    filesServer.listen(PORT_FILES, () => log.info(`Files server listening on ${PORT_FILES}`));
    mongoProxy.listen(PORT_MONGO, () => log.info(`Mongo proxy listening on ${PORT_MONGO}`));
    
    circuitBreakerMonitor.start();
    pinger.start();
    
    log.info('Ananta core server started successfully');
  } catch (err) {
    log.error('Failed to start servers', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  log.info('SIGTERM received, initiating graceful shutdown');
  process.exit(0);
});

start();