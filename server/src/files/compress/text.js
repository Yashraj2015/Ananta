const zlib = require('zlib');
const { promisify } = require('util');
const brotliCompress = promisify(zlib.brotliCompress);

async function compressText(buffer, mimeType) {
  const compressible = ['application/json', 'text/csv', 'text/plain', 'application/xml'];
  if (compressible.includes(mimeType)) {
    return await brotliCompress(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 6
      }
    });
  }
  return buffer;
}

module.exports = { compressText };