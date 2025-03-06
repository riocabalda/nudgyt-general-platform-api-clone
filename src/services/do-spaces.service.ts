/**
 * Migrated from v2 to v3
 * using `aws-sdk-js-codemod` and manual editing
 *
 * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrating.html
 * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html
 * https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html
 */

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import DOSpacesConfig from '../config/do-spaces.config';

const s3Client = new S3Client({
  region: DOSpacesConfig.region, // Required in AWS SDK v3, but apparently not actually used
  endpoint: `https://${DOSpacesConfig.endPoint}`,
  credentials: {
    accessKeyId: DOSpacesConfig.apiKey,
    secretAccessKey: DOSpacesConfig.secretKey
  }
});

/**
 * Path should start with slash, e.g.
 *
 * ```ts
 * createKey(`/path/to/${file}`)
 * ```
 */
function createKey(
  path: string,
  options: {
    directory?: string;
  } = {}
) {
  const { directory = DOSpacesConfig.directory } = options;

  const key = directory + path;

  return key;
}

function createFileUrl(
  key: string,
  options: {
    bucket?: string;
    endpoint?: string;
  } = {}
) {
  const {
    bucket = DOSpacesConfig.bucket,
    endpoint = DOSpacesConfig.endPoint
  } = options;

  const url = `https://${bucket}.${endpoint}/${key}`;

  return url;
}

async function upload(file: Buffer, mimetype: string, key: string) {
  const uploadCmd = new PutObjectCommand({
    Bucket: DOSpacesConfig.bucket,
    Key: key,
    Body: file,
    ACL: 'public-read',
    ContentType: mimetype
  });
  await s3Client.send(uploadCmd);

  const fileUrl = createFileUrl(key);

  return fileUrl;
}

/** Not verified to be working!!! */
async function deleteFile(key: string) {
  const deleteCmd = new DeleteObjectCommand({
    Bucket: DOSpacesConfig.bucket,
    Key: key
  });
  await s3Client.send(deleteCmd);
}

const DOSpacesService = {
  createKey,
  upload,
  deleteFile
};

export default DOSpacesService;
