const nodeStates = new Map();

function isWriteAllowed(nodeCode) {
  const state = nodeStates.get(nodeCode) || 'ACTIVE';
  return state === 'ACTIVE';
}

function getActiveWriteNode(type) {
  // Logic to get active node by type
  return 'node-a1';
}

module.exports = { isWriteAllowed, getActiveWriteNode };