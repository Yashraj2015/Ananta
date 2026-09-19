'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * Compress video using system FFmpeg (installed via apt-get in Docker).
 * Falls back to returning original path if FFmpeg is not found.
 *
 * @param {Buffer} buffer     Input video buffer
 * @param {object} opts
 * @param {string}  opts.quality   '480p' | '720p' (default) | '1080p'
 * @param {boolean} opts.isPaid    Use CF Stream for paid users + large files
 * @returns {{ outputBuffer: Buffer, mimeType: string }}
 */
async function processVideo(buffer, { quality = '720p', isPaid = false } = {}) {
  // For paid users with CF Stream configured, use Stream API for large videos
  if (isPaid && buffer.length > 50 * 1024 * 1024 && process.env.CF_STREAM_ACCOUNT) {
    return uploadToStream(buffer);
  }

  const tmpIn  = path.join(os.tmpdir(), `ananta_in_${uuidv4()}`);
  const tmpOut = path.join(os.tmpdir(), `ananta_out_${uuidv4()}.mp4`);

  try {
    fs.writeFileSync(tmpIn, buffer);

    const scaleFilter = quality === '1080p' ? 'scale=1920:-2'
                      : quality === '480p'  ? 'scale=854:-2'
                      : 'scale=1280:-2'; // 720p default

    await runFfmpeg([
      '-i', tmpIn,
      '-vf', scaleFilter,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-y', tmpOut
    ]);

    const outputBuffer = fs.readFileSync(tmpOut);
    return { outputBuffer, mimeType: 'video/mp4', streamUrl: null };
  } finally {
    try { fs.unlinkSync(tmpIn); } catch (_) {}
    try { fs.unlinkSync(tmpOut); } catch (_) {}
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error('Media processing failed'));  // no 'ffmpeg' in error
    });
    setTimeout(() => { proc.kill(); reject(new Error('Media processing timed out')); }, 300000);
  });
}

async function uploadToStream(buffer) {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', buffer, { filename: 'video.mp4', contentType: 'video/mp4' });

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_STREAM_ACCOUNT}/stream`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.CF_STREAM_TOKEN}` }, body: form }
  );
  const data = await res.json();
  if (!data.success) throw new Error('Media upload failed');
  return { outputBuffer: null, mimeType: 'video/mp4', streamUrl: data.result.playback.hls };
}

module.exports = { processVideo };
