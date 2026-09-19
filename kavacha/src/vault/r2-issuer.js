'use strict';
/**
 * r2-issuer.js — Issues pre-signed S3-compatible URLs for R2 object storage nodes.
 *
 * Operations:
 *   put    → PUT presigned URL (upload), 15-min TTL
 *   get    → GET presigned URL (download), 15-min TTL
 *   delete → DELETE presigned URL, 15-min TTL
 *
 * The access/secret keys are never logged — only nodeCode, bucket, key path,
 * and operation appear in logs.
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getCredential } = require('./credentials');
const pino = require('pino');

const logger = pino({ name: 'kavacha-r2', level: process.env.LOG_LEVEL || 'info' });

const PRESIGN_TTL_SECONDS = 900; // 15 minutes

/** Cached S3Client instances keyed by nodeCode to avoid re-initialising per request */
const clientCache = new Map();

/**
 * Returns (or creates) an S3Client for the given R2 node.
 * Credentials come from the vault — never hardcoded.
 *
 * @param {object} creds - vault entry for an r2 node
 * @param {string} nodeCode
 * @returns {S3Client}
 */
const getS3Client = (creds, nodeCode) => {
  if (clientCache.has(nodeCode)) return clientCache.get(nodeCode);

  const endpoint = creds.endpoint;
  if (!endpoint) throw new Error(No endpoint configured for );

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId:     creds.accessKey,
      secretAccessKey: creds.secretKey,
    },
    forcePathStyle: true, // Required for R2 compatibility
  });

  clientCache.set(nodeCode, client);
  return client;
};

/**
 * Evicts the cached S3Client for a node (e.g. after key rotation).
 * @param {string} nodeCode
 */
const evictClientCache = (nodeCode) => {
  if (nodeCode) clientCache.delete(nodeCode);
  else          clientCache.clear();
};

/**
 * Builds the appropriate S3 Command for the requested operation.
 *
 * @param {'put'|'get'|'delete'|'head'} operation
 * @param {string} bucket
 * @param {string} key
 * @param {object} [options] - additional command options (ContentType, etc.)
 */
const buildCommand = (operation, bucket, key, options = {}) => {
  switch (operation) {
    case 'put':    return new PutObjectCommand({ Bucket: bucket, Key: key, ...options });
    case 'get':    return new GetObjectCommand({ Bucket: bucket, Key: key });
    case 'delete': return new DeleteObjectCommand({ Bucket: bucket, Key: key });
    case 'head':   return new HeadObjectCommand({ Bucket: bucket, Key: key });
    default:       throw new Error(Invalid R2 operation: );
  }
};

/**
 * Issues a pre-signed URL for an R2 object operation.
 *
 * @param {string} nodeCode  - e.g. 'node-r2a'
 * @param {string} key       - object key within the bucket
 * @param {'put'|'get'|'delete'|'head'} operation
 * @param {object} [options] - passed to the S3 command (e.g. ContentType for put)
 * @returns {{ presignedUrl: string, bucket: string, key: string, operation: string, expiresAt: string }}
 */
const issueR2Credential = async (nodeCode, key, operation, options = {}) => {
  if (!key || typeof key !== 'string') throw new Error('key is required and must be a string');

  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'r2') {
    throw new Error(Invalid nodeCode or credential type for R2: );
  }

  const bucket = creds.bucket;
  if (!bucket) throw new Error(Bucket not configured for );

  const client     = getS3Client(creds, nodeCode);
  const command    = buildCommand(operation, bucket, key, options);
  const expiresIn  = PRESIGN_TTL_SECONDS;
  const presignedUrl = await getSignedUrl(client, command, { expiresIn });

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  logger.info(
    { nodeCode, bucket, key, operation, expiresAt },
    'Issued R2 presigned credential'
  );

  return { presignedUrl, bucket, key, operation, expiresAt };
};

module.exports = { issueR2Credential, evictClientCache };
