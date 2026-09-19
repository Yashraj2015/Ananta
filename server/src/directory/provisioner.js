const { getActiveNeonNode } = require('./registry');

async function provisionCustomer(tenantId) {
  const node = getActiveNeonNode();
  if (!node) throw new Error('No active node-n1 available');
  
  const schemaName = `ananta_proj_${tenantId}`;
  // Implementation to call Neon API via Kavacha and create schema & tables
  
  return { neonNodeCode: node.code, schemaName };
}

module.exports = { provisionCustomer };