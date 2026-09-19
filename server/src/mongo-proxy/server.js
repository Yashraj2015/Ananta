'use strict';
const net = require('net');
const poolManager = require('./pool-manager');
const { log } = require('../utils/logger');
const registry = require('../directory/registry');
const kavacha  = require('../kavacha-client');

// MongoDB Wire Protocol constants
const OP_REPLY        = 1;
const OP_QUERY        = 2004;
const OP_MSG          = 2013;

function readInt32LE(buf, offset) { return buf.readInt32LE(offset); }
function writeInt32LE(buf, val, offset) { buf.writeInt32LE(val, offset); }

// Minimal OP_MSG hello response — spoofs Ananta DB
function buildHelloResponse(requestId, responseTo) {
  // BSON document: { ok: 1, ismaster: true, maxWireVersion: 21, minWireVersion: 0, ... }
  const bsonDoc = Buffer.from([
    // doc length (placeholder)
    0x00,0x00,0x00,0x00,
    // ok: 1 (double 1.0)
    0x01,'o'.charCodeAt(0),'k'.charCodeAt(0),0x00,
    0x00,0x00,0x00,0x00,0x00,0x00,0xF0,0x3F,
    // ismaster: true (boolean)
    0x08,'i'.charCodeAt(0),'s'.charCodeAt(0),'m'.charCodeAt(0),'a'.charCodeAt(0),'s'.charCodeAt(0),'t'.charCodeAt(0),'e'.charCodeAt(0),'r'.charCodeAt(0),0x00,0x01,
    // maxWireVersion: 21 (int32)
    0x10,'m'.charCodeAt(0),'a'.charCodeAt(0),'x'.charCodeAt(0),'W'.charCodeAt(0),'i'.charCodeAt(0),'r'.charCodeAt(0),'e'.charCodeAt(0),'V'.charCodeAt(0),'e'.charCodeAt(0),'r'.charCodeAt(0),'s'.charCodeAt(0),'i'.charCodeAt(0),'o'.charCodeAt(0),'n'.charCodeAt(0),0x00,
    0x15,0x00,0x00,0x00,
    // minWireVersion: 0 (int32)
    0x10,'m'.charCodeAt(0),'i'.charCodeAt(0),'n'.charCodeAt(0),'W'.charCodeAt(0),'i'.charCodeAt(0),'r'.charCodeAt(0),'e'.charCodeAt(0),'V'.charCodeAt(0),'e'.charCodeAt(0),'r'.charCodeAt(0),'s'.charCodeAt(0),'i'.charCodeAt(0),'o'.charCodeAt(0),'n'.charCodeAt(0),0x00,
    0x00,0x00,0x00,0x00,
    // end of document
    0x00
  ]);
  // Fix document length
  bsonDoc.writeInt32LE(bsonDoc.length, 0);

  // OP_REPLY header (36 bytes) + bsonDoc
  const header = Buffer.allocUnsafe(36);
  writeInt32LE(header, 36 + bsonDoc.length, 0); // messageLength
  writeInt32LE(header, requestId + 1, 4);        // requestID
  writeInt32LE(header, requestId, 8);             // responseTo
  writeInt32LE(header, OP_REPLY, 12);             // opCode
  writeInt32LE(header, 0, 16);                    // responseFlags
  header.writeBigInt64LE(0n, 20);                 // cursorID
  writeInt32LE(header, 0, 28);                    // startingFrom
  writeInt32LE(header, 1, 32);                    // numberReturned
  return Buffer.concat([header, bsonDoc]);
}

function isHelloCommand(data) {
  // Look for "hello" or "isMaster" or "ismaster" string in the buffer
  const str = data.toString('latin1');
  return str.includes('hello') || str.includes('isMaster') || str.includes('ismaster');
}

const server = net.createServer(async (clientSocket) => {
  const clientAddr = clientSocket.remoteAddress;
  let backendSocket = null;
  let handshakeDone = false;
  let requestId = 1;

  // Get Atlas backend connection from pool
  async function connectBackend() {
    const node = registry.getActiveAtlasNode();
    if (!node) throw new Error('No active backend available');
    const pool = poolManager.getPool(node.code);
    const socket = await pool.acquire();
    return socket;
  }

  clientSocket.on('data', async (data) => {
    try {
      if (!handshakeDone && isHelloCommand(data)) {
        // Spoof hello response — return Ananta DB identity
        const reqId = readInt32LE(data, 4);
        const reply = buildHelloResponse(reqId, requestId++);
        clientSocket.write(reply);
        handshakeDone = true;
        log.trace('[mongo-proxy] hello spoofed for new connection');
        return;
      }

      // Route to backend
      if (!backendSocket) {
        try {
          backendSocket = await connectBackend();
        } catch (err) {
          log.warn('[mongo-proxy] backend unavailable');
          clientSocket.destroy();
          return;
        }
        backendSocket.on('data', (d) => clientSocket.write(d));
        backendSocket.on('close', () => clientSocket.destroy());
        backendSocket.on('error', () => clientSocket.destroy());
      }
      backendSocket.write(data);
    } catch (err) {
      log.warn('[mongo-proxy] routing error');
      clientSocket.destroy();
    }
  });

  clientSocket.on('close', () => {
    if (backendSocket) backendSocket.destroy();
  });
  clientSocket.on('error', () => {
    if (backendSocket) backendSocket.destroy();
  });
});

module.exports = server;
