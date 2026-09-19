'use strict';
const net = require('net');
const kavacha  = require('../kavacha-client');
const { log } = require('../utils/logger');

class MongoPool {
  constructor(nodeCode, maxSize = 10) {
    this.nodeCode = nodeCode;
    this.maxSize  = maxSize;
    this.pool     = []; // idle sockets
    this.pending  = []; // resolve callbacks waiting for a socket
    this.active   = 0;
  }

  async acquire() {
    // Return idle socket if available
    while (this.pool.length > 0) {
      const sock = this.pool.pop();
      if (!sock.destroyed) return sock;
    }
    // Create new socket if under limit
    if (this.active < this.maxSize) {
      return this._connect();
    }
    // Wait for a socket to be released
    return new Promise((resolve) => this.pending.push(resolve));
  }

  release(socket) {
    if (!socket.destroyed) {
      this.pool.push(socket);
    } else {
      this.active--;
    }
    if (this.pending.length > 0) {
      const next = this.pending.shift();
      this.acquire().then(next);
    }
  }

  async _connect() {
    const { credential } = await kavacha.requestToken(this.nodeCode, 'write');
    return new Promise((resolve, reject) => {
      const url  = new URL(credential.uri);
      const sock = net.createConnection({ host: url.hostname, port: parseInt(url.port) || 27017 }, () => {
        this.active++;
        resolve(sock);
      });
      sock.on('error', (err) => { this.active--; reject(err); });
      setTimeout(() => { sock.destroy(); reject(new Error('Backend connection timed out')); }, 8000);
    });
  }
}

const pools = new Map();

function getPool(nodeCode) {
  if (!pools.has(nodeCode)) pools.set(nodeCode, new MongoPool(nodeCode));
  return pools.get(nodeCode);
}

module.exports = { getPool };
