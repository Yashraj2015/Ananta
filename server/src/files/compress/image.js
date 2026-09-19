const sharp = require('sharp');

async function processImage(buffer, { isPaid }) {
  const webpBuffer = await sharp(buffer)
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
    
  return isPaid ? { webpBuffer, originalBuffer: buffer } : { webpBuffer };
}

module.exports = { processImage };