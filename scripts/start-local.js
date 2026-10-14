'use strict';

const path = require('path');
const { randomBytes } = require('node:crypto');
const { createStrapi } = require('@strapi/core');

const appDir = path.resolve(__dirname, '..');

process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.PORT = process.env.PORT || '1338';
process.env.BROWSER = process.env.BROWSER || 'false';
process.env.NODE_ENV = 'development';
process.env.DATABASE_FILENAME = process.env.DATABASE_FILENAME || '.tmp/data-local.db';
process.env.APP_KEYS = process.env.APP_KEYS || 'local-app-key-a,local-app-key-b';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'local-admin-jwt-secret';
process.env.API_TOKEN_SALT = process.env.API_TOKEN_SALT || 'local-api-token-salt';
process.env.TRANSFER_TOKEN_SALT = process.env.TRANSFER_TOKEN_SALT || 'local-transfer-token-salt';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'local-encryption-key-32-characters';
process.env.PREVIEW_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4200';
process.env.PREVIEW_SECRET = process.env.PREVIEW_SECRET || randomBytes(32).toString('hex');

const strapi = createStrapi({ appDir, distDir: appDir, autoReload: false });

console.log('[LOCAL] SQLite database: .tmp/data-local.db');
console.log('[LOCAL] Media storage: public/uploads');
console.log('[LOCAL] Production database and S3 writes are disabled.');

strapi.config.set('database.connection', {
  client: 'sqlite',
  connection: { filename: path.resolve(appDir, process.env.DATABASE_FILENAME) },
  useNullAsDefault: true,
});

(async () => {
  try {
    await strapi.load();
    await strapi.listen();
  } catch (error) {
    console.error(error);
    await strapi.destroy();
    process.exit(1);
  }
})();
