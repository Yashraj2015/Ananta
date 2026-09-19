const pools = new Map();

function getPool(nodeCode) {
  if (!pools.has(nodeCode)) {
    // Initialize pool
    pools.set(nodeCode, {});
  }
  return pools.get(nodeCode);
}

module.exports = { getPool };