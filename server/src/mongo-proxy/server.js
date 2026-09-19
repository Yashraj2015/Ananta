const net = require('net');
const tls = require('tls');
const poolManager = require('./pool-manager');

const server = net.createServer((socket) => {
  // Spoof hello response or route connection
  socket.on('data', (data) => {
    // Handle mongodb wire protocol
  });
});

module.exports = server;