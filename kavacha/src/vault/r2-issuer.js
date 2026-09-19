'use strict';
/**
 * r2-issuer.js — Issues 15-minute presigned URLs for Cloudflare R2 buckets.
 */
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getCredential } = require('./credentials');
const pino   = require('pino');
const logger = pino({ name: 'kavacha-r2', level: process.env.LOG_LEVEL || 'info' });

const TTL_SECONDS = 900; // 15 minutes

const getClient = (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'r2') throw new Error('Invalid r2 node: ' + nodeCode);
  const client = new S3Client({
    region: 'auto',
    endpoint: creds.endpoint,
    credentials: { accessKeyId: creds.accessKey, secretAccessKey: creds.secretKey }
  });
  return { client, bucket: creds.bucket, nodeCode };
};

const issuePresignedUpload = async (nodeCode, key, contentType) => {
  const { client, bucket } = getClient(nodeCode);
  const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: TTL_SECONDS });
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  logger.info({ nodeCode, key: key.slice(0, 20) + '...' }, 'R2 presigned upload issued');
  return { uploadUrl: url, expiresAt };
};

const issuePresignedDownload = async (nodeCode, key) => {
  const { client, bucket } = getClient(nodeCode);
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: TTL_SECONDS });
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  return { downloadUrl: url, expiresAt };
};

// Returns raw credentials for server-side upload (used when server does the uploading)
const issueR2Credential = async (nodeCode) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'r2') throw new Error('Invalid r2 node: ' + nodeCode);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  logger.info({ nodeCode }, 'R2 server credential issued');
  return { accessKey: creds.accessKey, secretKey: creds.secretKey, endpoint: creds.endpoint, bucket: creds.bucket, expiresAt };
};

module.exports = { issuePresignedUpload, issuePresignedDownload, issueR2Credential };
