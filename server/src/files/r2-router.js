'use strict';
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const kavacha = require('../kavacha-client');
const registry = require('../directory/registry');
const { log } = require('../utils/logger');

// Returns an S3Client configured with credentials from Kavacha for a given R2 bucket node
async function getS3Client(nodeCode) {
  const { credential } = await kavacha.requestToken(nodeCode, 'write');
  return {
    client: new S3Client({
      region: 'auto',
      endpoint: credential.endpoint,
      credentials: { accessKeyId: credential.accessKey, secretAccessKey: credential.secretKey }
    }),
    bucket: credential.bucket,
    nodeCode
  };
}

// Upload a buffer to the active R2 bucket
async function uploadToR2(buffer, key, contentType) {
  const node = registry.getActiveR2Bucket();
  if (!node) throw new Error('No active file storage node available');
  const { client, bucket, nodeCode } = await getS3Client(node.code);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));
  log.debug(`[files] uploaded to ${nodeCode}: ${key}`);
  return { url: `${process.env.ANANTA_FILES_CDN || 'https://files.ananta.io'}/${key}`, nodeCode };
}

// Get a presigned download URL (15-min expiry)
async function getPresignedDownload(key) {
  const node = registry.getActiveR2Bucket();
  if (!node) throw new Error('No active file storage node');
  const { client, bucket } = await getS3Client(node.code);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
}

// Delete a file
async function deleteFromR2(key) {
  const node = registry.getActiveR2Bucket();
  if (!node) return;
  const { client, bucket, nodeCode } = await getS3Client(node.code);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  log.debug(`[files] deleted from ${nodeCode}: ${key}`);
}

// Get presigned upload URL (for direct client uploads)
async function getPresignedUpload(key, contentType) {
  const node = registry.getActiveR2Bucket();
  if (!node) throw new Error('No active file storage node');
  const { client, bucket } = await getS3Client(node.code);
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 900 });
}

module.exports = { uploadToR2, getPresignedDownload, deleteFromR2, getPresignedUpload };
