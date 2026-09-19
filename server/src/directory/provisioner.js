'use strict';
const registry = require('./registry');
const kavacha  = require('../kavacha-client');
const { log }  = require('../utils/logger');

async function provisionCustomer(tenantId, planType = 'FREE') {
  const node = registry.getActiveNeonNode();
  if (!node) throw Object.assign(new Error('No active data node'), { status: 503 });
  const schemaName = `ananta_proj_${tenantId}`;
  const { credential } = await kavacha.requestToken(node.code, 'admin');
  const { Client } = require('pg');
  const client = new Client({ connectionString: credential.connectionString });
  try {
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`COMMENT ON SCHEMA "${schemaName}" IS 'Ananta tenant: ${tenantId}'`);
    log.info(`[provisioner] schema created for tenant on ${node.code}`);
    return { neonNodeCode: node.code, schemaName };
  } finally { await client.end(); }
}

module.exports = { provisionCustomer };
