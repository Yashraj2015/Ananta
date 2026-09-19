const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../audit.log');
const memoryLog = [];
let prevHash = crypto.createHash('sha256').update('genesis').digest('hex');

const initAuditLog = () => {
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
  }
};

const appendAuditLog = (entry) => {
  const ts = new Date().toISOString();
  const data = { ts, ...entry };
  
  const hash = crypto.createHash('sha256')
    .update(prevHash + JSON.stringify(data))
    .digest('hex');
  
  data.hash = hash;
  prevHash = hash;

  memoryLog.unshift(data);
  if (memoryLog.length > 1000) memoryLog.pop();

  fs.appendFileSync(logFile, JSON.stringify(data) + '\n');
};

const getRecentAuditLogs = (n = 20) => {
  return memoryLog.slice(0, n);
};

module.exports = { initAuditLog, appendAuditLog, getRecentAuditLogs };
