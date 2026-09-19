const { Client } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getCredential } = require('./credentials');
const pino = require('pino');
const logger = pino({ name: 'kavacha-pg' });

const issueNeonCredential = async (nodeCode, tenantId, operation) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'pg-neon') throw new Error('Invalid nodeCode or type');

  const client = new Client({ connectionString: creds.adminUri });
  await client.connect();

  const uuid = uuidv4().replace(/-/g, '');
  const roleName = `ananta_tmp_${uuid}`;
  const password = crypto.randomBytes(32).toString('hex');
  const schemaName = `ananta_proj_${tenantId}`;

  try {
    await client.query(`CREATE ROLE ${roleName} WITH LOGIN PASSWORD '${password}' VALID UNTIL NOW() + INTERVAL '15 minutes'`);
    await client.query(`GRANT USAGE ON SCHEMA ${schemaName} TO ${roleName}`);
    
    if (operation === 'readwrite') {
      await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schemaName} TO ${roleName}`);
    } else {
      await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${schemaName} TO ${roleName}`);
    }

    const host = creds.adminUri.split('@')[1].split('/')[0];
    const dbName = creds.adminUri.split('/').pop().split('?')[0];
    const connectionString = `postgres://${roleName}:${password}@${host}/${dbName}`;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    logger.info(`[KAVACHA] Issued pg-cred for ${nodeCode}/${tenantId} exp:${expiresAt}`);
    
    return { connectionString, expiresAt };
  } finally {
    await client.end();
  }
};

module.exports = { issueNeonCredential };
