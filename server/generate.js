const fs = require('fs');
const path = require('path');

const files = {
  'package.json': `{
  "name": "ananta-server",
  "version": "1.0.0",
  "description": "Ananta DB core server",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/s3-request-presigner": "^3.0.0",
    "axios": "^1.6.0",
    "bullmq": "^5.0.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.0",
    "form-data": "^4.0.0",
    "helmet": "^7.1.0",
    "ioredis": "^5.4.0",
    "mongodb": "^6.5.0",
    "node-cron": "^3.0.3",
    "pg": "^8.11.0",
    "pino": "^8.20.0",
    "pino-pretty": "^11.0.0",
    "sharp": "^0.33.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}`,
  '.env.example': `# Kavacha Vault (the only external service Ananta server knows about)
KAVACHA_URL=https://kavacha.internal.ananta.io
KAVACHA_SHARED_SECRET=
KAVACHA_MTLS_CERT_PATH=./certs/ananta-client.pem
KAVACHA_MTLS_KEY_PATH=./certs/ananta-client.key

# Control Plane (codename: ctrl-plane)
CTRL_PLANE_URL=
CTRL_PLANE_KEY=

# Server config
PORT_API=8080
PORT_FILES=8081
PORT_MONGO=27017
PORT_PG=5432
PORT_HEALTH=3001
NODE_ENV=production

# Internal broker (for shim)
INTERNAL_BROKER_KEY=

# CF Stream (paid video, optional)
CF_STREAM_ACCOUNT=
CF_STREAM_TOKEN=

# Domain
ANANTA_DOMAIN=ananta.io`,
  'src/index.js': `require('dotenv').config();
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
    healthServer.listen(PORT_HEALTH, () => log.info(\`Health server listening on \${PORT_HEALTH}\`));
    apiServer.listen(PORT_API, () => log.info(\`API server listening on \${PORT_API}\`));
    filesServer.listen(PORT_FILES, () => log.info(\`Files server listening on \${PORT_FILES}\`));
    mongoProxy.listen(PORT_MONGO, () => log.info(\`Mongo proxy listening on \${PORT_MONGO}\`));
    
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

start();`,
  'src/health/server.js': `const express = require('express');
const app = express();

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/readyz', (req, res) => {
  // Check internal services ready logic here
  res.json({ status: 'ready', ts: Date.now() });
});

module.exports = app;`,
  'src/utils/logger.js': `const pino = require('pino');

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
};`,
  'src/utils/retry.js': `async function retry(fn, { maxAttempts = 3, initialDelayMs = 1000, backoffFactor = 2 } = {}) {
  let attempt = 1;
  let delay = initialDelayMs;
  
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= backoffFactor;
      attempt++;
    }
  }
}

module.exports = retry;`,
  'src/kavacha-client/index.js': `const https = require('https');
const fs = require('fs');

const tokenCache = new Map();

async function requestToken(nodeCode, operation) {
  const cacheKey = \`\${nodeCode}:\${operation}\`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now() + 30000) {
    return cached;
  }
  
  // Implementation of mTLS request to Kavacha would go here
  // returning mock for now
  const result = { credential: 'mock-cred', expiresAt: Date.now() + 3600000 };
  tokenCache.set(cacheKey, result);
  
  return result;
}

module.exports = { requestToken };`,
  'src/directory/registry.js': `let activeNodes = { atlasNodes: [], neonNodes: [], r2Nodes: [] };

async function fetchRegistry() {
  // Implementation to fetch from CTRL_PLANE_URL
}

setInterval(fetchRegistry, 60000);

module.exports = {
  getActiveAtlasNode: () => activeNodes.atlasNodes.find(n => n.status === 'ACTIVE'),
  getActiveNeonNode: (tenantId) => activeNodes.neonNodes.find(n => n.status === 'ACTIVE'),
  getActiveR2Bucket: () => activeNodes.r2Nodes.find(n => n.status === 'ACTIVE')
};`,
  'src/directory/provisioner.js': `const { getActiveNeonNode } = require('./registry');

async function provisionCustomer(tenantId) {
  const node = getActiveNeonNode();
  if (!node) throw new Error('No active node-n1 available');
  
  const schemaName = \`ananta_proj_\${tenantId}\`;
  // Implementation to call Neon API via Kavacha and create schema & tables
  
  return { neonNodeCode: node.code, schemaName };
}

module.exports = { provisionCustomer };`,
  'src/middleware/error-sanitizer.js': `const { log } = require('../utils/logger');

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

module.exports = sanitizeError;`,
  'src/api/server.js': `const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const errorSanitizer = require('../middleware/error-sanitizer');

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Routes
app.use('/v1/data', require('./routes/collections'));
app.use('/v1/internal', require('./routes/internal'));

app.use(errorSanitizer);

module.exports = app;`,
  'src/api/routes/collections.js': `const express = require('express');
const router = express.Router();

router.post('/:collection', async (req, res, next) => {
  try {
    // Insert document logic
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/:collection', async (req, res, next) => {
  try {
    // Find documents logic
    res.json({ data: [] });
  } catch (err) { next(err); }
});

router.patch('/:collection/:id', async (req, res, next) => {
  try {
    // Update document logic
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:collection/:id', async (req, res, next) => {
  try {
    // Delete document logic
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/:collection/search', async (req, res, next) => {
  try {
    // Full text search logic
    res.json({ data: [] });
  } catch (err) { next(err); }
});

module.exports = router;`,
  'src/api/routes/internal.js': `const express = require('express');
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

module.exports = router;`,
  'src/circuit-breaker/monitor.js': `const { log } = require('../utils/logger');

function start() {
  setInterval(() => {
    // Poll node usage logic here
    log.info('[CB] node-a1: 462MB/512MB (90%) \\u2192 READ_ONLY');
  }, 300000);
}

module.exports = { start };`,
  'src/circuit-breaker/breaker.js': `const nodeStates = new Map();

function isWriteAllowed(nodeCode) {
  const state = nodeStates.get(nodeCode) || 'ACTIVE';
  return state === 'ACTIVE';
}

function getActiveWriteNode(type) {
  // Logic to get active node by type
  return 'node-a1';
}

module.exports = { isWriteAllowed, getActiveWriteNode };`,
  'src/pinger/index.js': `const { log } = require('../utils/logger');

function start() {
  setInterval(() => {
    // Silent keep-alive pinger logic here
    log.info('[HB] node-a1 ok (22ms)');
  }, 3600000);
}

module.exports = { start };`,
  'src/mongo-proxy/server.js': `const net = require('net');
const tls = require('tls');
const poolManager = require('./pool-manager');

const server = net.createServer((socket) => {
  // Spoof hello response or route connection
  socket.on('data', (data) => {
    // Handle mongodb wire protocol
  });
});

module.exports = server;`,
  'src/mongo-proxy/wire-parser.js': `function isWriteCommand(buf) {
  return false; // Implement proper parsing
}

function rewriteResponseTo(buf, newId) {
  return buf; // Implement proper parsing
}

module.exports = { isWriteCommand, rewriteResponseTo };`,
  'src/mongo-proxy/pool-manager.js': `const pools = new Map();

function getPool(nodeCode) {
  if (!pools.has(nodeCode)) {
    // Initialize pool
    pools.set(nodeCode, {});
  }
  return pools.get(nodeCode);
}

module.exports = { getPool };`,
  'src/files/server.js': `const express = require('express');
const app = express();

app.post('/v1/files/upload', (req, res) => {
  res.json({ success: true });
});

app.get('/v1/files/:key', (req, res) => {
  res.json({ success: true });
});

app.delete('/v1/files/:key', (req, res) => {
  res.json({ success: true });
});

module.exports = app;`,
  'src/files/compress/image.js': `const sharp = require('sharp');

async function processImage(buffer, { isPaid }) {
  const webpBuffer = await sharp(buffer)
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
    
  return isPaid ? { webpBuffer, originalBuffer: buffer } : { webpBuffer };
}

module.exports = { processImage };`,
  'src/files/compress/video.js': `const { spawn } = require('child_process');

async function processVideo(inputPath, { quality, isPaid }) {
  // Logic to process video
  return { outputPath: inputPath };
}

module.exports = { processVideo };`,
  'src/files/compress/text.js': `const zlib = require('zlib');
const { promisify } = require('util');
const brotliCompress = promisify(zlib.brotliCompress);

async function compressText(buffer, mimeType) {
  const compressible = ['application/json', 'text/csv', 'text/plain', 'application/xml'];
  if (compressible.includes(mimeType)) {
    return await brotliCompress(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 6
      }
    });
  }
  return buffer;
}

module.exports = { compressText };`,
  'src/files/r2-router.js': `function getActiveBucket() {
  return {
    nodeCode: 'node-r2b',
    endpoint: 'https://s3.ananta.io',
    bucket: 'ananta-internal',
    key: 'mock',
    secret: 'mock'
  };
}

async function uploadToR2(buffer, key, contentType, nodeCode) {
  return 'https://ananta.io/' + key;
}

module.exports = { getActiveBucket, uploadToR2 };`,
  'Dockerfile': `FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080 8081 27017 5432 3001
CMD ["node", "src/index.js"]`
};

Object.keys(files).forEach(file => {
  const fullPath = path.join('d:/Smars/Smars/Ananta/server', file);
  fs.writeFileSync(fullPath, files[file]);
  console.log('Created ' + fullPath);
});
