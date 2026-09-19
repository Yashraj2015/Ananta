let activeNodes = { atlasNodes: [], neonNodes: [], r2Nodes: [] };

async function fetchRegistry() {
  // Implementation to fetch from CTRL_PLANE_URL
}

setInterval(fetchRegistry, 60000);

module.exports = {
  getActiveAtlasNode: () => activeNodes.atlasNodes.find(n => n.status === 'ACTIVE'),
  getActiveNeonNode: (tenantId) => activeNodes.neonNodes.find(n => n.status === 'ACTIVE'),
  getActiveR2Bucket: () => activeNodes.r2Nodes.find(n => n.status === 'ACTIVE')
};