'use strict';
const registry = require('../directory/registry');

function isWriteAllowed(nodeCode) {
  const node = registry.getNode(nodeCode);
  return node ? node.status === 'ACTIVE' : false;
}

function getActiveWriteNode(type) {
  if (type === 'mongo') return registry.getActiveAtlasNode();
  if (type === 'pg')    return registry.getActiveNeonNode();
  return null;
}

module.exports = { isWriteAllowed, getActiveWriteNode };
