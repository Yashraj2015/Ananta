const { spawn } = require('child_process');

async function processVideo(inputPath, { quality, isPaid }) {
  // Logic to process video
  return { outputPath: inputPath };
}

module.exports = { processVideo };