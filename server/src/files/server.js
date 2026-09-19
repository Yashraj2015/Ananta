'use strict';
const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const { processImage } = require('./compress/image');
const { processVideo } = require('./compress/video');
const { compressText } = require('./compress/text');
const { uploadToR2, getPresignedDownload, deleteFromR2, getPresignedUpload } = require('./r2-router');
const { log } = require('../utils/logger');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

// POST /v1/files/upload — multipart upload
app.post('/v1/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: { code: 'ANANTA_4001', message: 'No file provided' } });
    const { originalname, mimetype, buffer } = req.file;
    const isPaid = req.headers['x-ananta-plan'] === 'paid';
    const ext    = originalname.split('.').pop()?.toLowerCase();
    const key    = `${uuidv4()}`;
    let finalBuffer, finalMime, originalKey;

    if (mimetype.startsWith('image/')) {
      const result = await processImage(buffer, { isPaid });
      finalBuffer = result.webpBuffer;
      finalMime   = result.mimeType;
      // For paid users: also store original
      if (isPaid && result.originalBuffer) {
        originalKey = `originals/${key}.${ext}`;
        await uploadToR2(result.originalBuffer, originalKey, mimetype);
      }
      const { url } = await uploadToR2(finalBuffer, `compressed/${key}.webp`, finalMime);
      return res.json({ url, originalUrl: originalKey ? `${process.env.ANANTA_FILES_CDN || ''}/${originalKey}` : undefined });
    }

    if (mimetype.startsWith('video/')) {
      const result = await processVideo(buffer, { isPaid });
      if (result.streamUrl) return res.json({ url: result.streamUrl, type: 'stream' });
      finalBuffer = result.outputBuffer;
      finalMime   = result.mimeType;
      const { url } = await uploadToR2(finalBuffer, `videos/${key}.mp4`, finalMime);
      return res.json({ url });
    }

    // Text / other — brotli compress
    const compressedBuf = await compressText(buffer, mimetype);
    const { url } = await uploadToR2(compressedBuf, `files/${key}.${ext}`, mimetype);
    return res.json({ url });
  } catch (err) {
    log.error('[files] upload error', { msg: err.message });
    return res.status(500).json({ error: { code: 'ANANTA_5002', message: 'File processing failed' } });
  }
});

// GET /v1/files/:key — serve file (optionally original for paid)
app.get('/v1/files/:key(*)', async (req, res) => {
  try {
    const { key } = req.params;
    const wantOriginal = req.query.q === 'original' && req.headers['x-ananta-plan'] === 'paid';
    const fileKey = wantOriginal ? key.replace('compressed/', 'originals/') : key;
    const signedUrl = await getPresignedDownload(fileKey);
    res.redirect(302, signedUrl);
  } catch (err) {
    res.status(404).json({ error: { code: 'ANANTA_4041', message: 'File not found' } });
  }
});

// POST /v1/files/presign — get presigned upload URL for direct client upload
app.post('/v1/files/presign', express.json(), async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType) return res.status(400).json({ error: { code: 'ANANTA_4002', message: 'filename and contentType required' } });
    const key = `uploads/${uuidv4()}/${filename}`;
    const url = await getPresignedUpload(key, contentType);
    res.json({ uploadUrl: url, key });
  } catch (err) {
    res.status(500).json({ error: { code: 'ANANTA_5003', message: 'Could not generate upload URL' } });
  }
});

// DELETE /v1/files/:key
app.delete('/v1/files/:key(*)', async (req, res) => {
  try {
    await deleteFromR2(req.params.key);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'ANANTA_5004', message: 'Delete failed' } });
  }
});

module.exports = app;
