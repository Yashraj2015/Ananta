function getActiveBucket() {
  return {
    nodeCode: 'node-r2b',
    endpoint: 'https://s3.ananta.io',
    bucket: 'ananta-internal',
    key: 'mock',
    secret: 'mock'
  };
}

async function uploadToR2(buffer, key, contentType, nodeCode) {
  return 'https://ananta.io/' + key;
}

module.exports = { getActiveBucket, uploadToR2 };