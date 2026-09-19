const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getCredential } = require('./credentials');
const pino = require('pino');
const logger = pino({ name: 'kavacha-r2' });

const issueR2Credential = async (nodeCode, key, operation) => {
  const creds = getCredential(nodeCode);
  if (!creds || creds.type !== 'r2') throw new Error('Invalid nodeCode or type');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: creds.accessKey,
      secretAccessKey: creds.secretKey,
    },
  });

  let command;
  if (operation === 'put') {
    command = new PutObjectCommand({ Bucket: creds.bucket, Key: key });
  } else if (operation === 'get') {
    command = new GetObjectCommand({ Bucket: creds.bucket, Key: key });
  } else if (operation === 'delete') {
    command = new DeleteObjectCommand({ Bucket: creds.bucket, Key: key });
  } else {
    throw new Error('Invalid operation');
  }

  const expiresIn = 900; // 15 mins
  const presignedUrl = await getSignedUrl(client, command, { expiresIn });

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  logger.info(`[KAVACHA] Issued r2-cred for ${nodeCode} op:${operation} exp:${expiresAt}`);

  return { presignedUrl, expiresAt };
};

module.exports = { issueR2Credential };
