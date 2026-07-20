'use strict';

const fs = require('fs/promises');
const path = require('path');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { createStrapi } = require('@strapi/core');

const APP_DIR = path.resolve(__dirname, '..');
const DATABASE_PATH = path.join(APP_DIR, '.tmp', 'data-local.db');
const UPLOAD_DIRECTORY = path.join(APP_DIR, 'public', 'uploads');

process.env.HOST = '127.0.0.1';
process.env.BROWSER = 'false';
process.env.NODE_ENV = 'development';
process.env.DATABASE_FILENAME = '.tmp/data-local.db';
process.env.APP_KEYS = process.env.APP_KEYS || 'local-media-app-key-a,local-media-app-key-b';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'local-media-admin-jwt-secret';
process.env.API_TOKEN_SALT = process.env.API_TOKEN_SALT || 'local-media-api-token-salt';
process.env.TRANSFER_TOKEN_SALT =
  process.env.TRANSFER_TOKEN_SALT || 'local-media-transfer-token-salt';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || 'local-media-encryption-key-32-chars';

const createS3Reader = () => {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_ACCESS_SECRET;
  const bucket = process.env.AWS_BUCKET;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('AWS read credentials are missing from the local environment');
  }

  return {
    bucket,
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
};

const localFileName = (asset) => `${asset.hash}${asset.ext || ''}`;

const localizeAsset = async (asset, s3Reader) => {
  if (!asset?.url || asset.url.startsWith('/')) {
    return asset;
  }

  const key = decodeURIComponent(new URL(asset.url).pathname.replace(/^\//, ''));
  const response = await s3Reader.client.send(
    new GetObjectCommand({ Bucket: s3Reader.bucket, Key: key })
  );
  const fileName = localFileName(asset);

  await fs.writeFile(
    path.join(UPLOAD_DIRECTORY, fileName),
    Buffer.from(await response.Body.transformToByteArray())
  );

  return { ...asset, url: `/uploads/${fileName}` };
};

const main = async () => {
  const strapi = createStrapi({ appDir: APP_DIR, distDir: APP_DIR, autoReload: false });
  strapi.config.set('database.connection', {
    client: 'sqlite',
    connection: { filename: DATABASE_PATH },
    useNullAsDefault: true,
  });

  try {
    await strapi.load();
    await fs.mkdir(UPLOAD_DIRECTORY, { recursive: true });

    const repository = strapi.db.query('plugin::upload.file');
    const files = await repository.findMany();
    const remoteFiles = files.filter(
      (file) => file.provider !== 'local' || !file.url?.startsWith('/')
    );
    const s3Reader = createS3Reader();

    for (let index = 0; index < remoteFiles.length; index += 1) {
      const file = remoteFiles[index];
      const localizedFile = await localizeAsset(file, s3Reader);
      const formats = file.formats
        ? Object.fromEntries(
            await Promise.all(
              Object.entries(file.formats).map(async ([name, format]) => [
                name,
                await localizeAsset(format, s3Reader),
              ])
            )
          )
        : null;

      await repository.update({
        where: { id: file.id },
        data: {
          provider: 'local',
          provider_metadata: null,
          url: localizedFile.url,
          formats,
        },
      });
      console.log(`[media ${index + 1}/${remoteFiles.length}] ${file.name}`);
    }

    console.log(`LOCALIZED_MEDIA ${remoteFiles.length}`);
  } finally {
    await strapi.destroy();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
