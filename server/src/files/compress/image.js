'use strict';
const sharp = require('sharp');

/**
 * Process an image buffer:
 *  - Resize to max 2048px on longest side (withoutEnlargement)
 *  - Convert to WebP quality 82
 *  - Strip ALL EXIF metadata (privacy)
 *  - For paid users: also return the original buffer
 *
 * @param {Buffer} buffer       Raw image buffer
 * @param {object} opts
 * @param {boolean} opts.isPaid Keep original for paid users
 * @param {number}  opts.quality WebP quality (default 82)
 * @param {number}  opts.maxPx  Max dimension in pixels (default 2048)
 * @returns {{ webpBuffer: Buffer, originalBuffer?: Buffer, mimeType: string, ext: string }}
 */
async function processImage(buffer, { isPaid = false, quality = 82, maxPx = 2048 } = {}) {
  const webpBuffer = await sharp(buffer)
    .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .withMetadata(false) // strip EXIF
    .toBuffer();

  return {
    webpBuffer,
    originalBuffer: isPaid ? buffer : undefined,
    mimeType: 'image/webp',
    ext: '.webp'
  };
}

module.exports = { processImage };
