'use strict';

const path = require('path');
const { randomBytes } = require('node:crypto');

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

console.log('[LOCAL] SQLite database: .tmp/data-local.db');
console.log('[LOCAL] Media storage: public/uploads');
console.log('[LOCAL] Production database and S3 writes are disabled.');

// Use Strapi's development lifecycle: the Content-Type Builder requires
// autoReload and its worker supervisor to save schemas and restart the server.
process.chdir(appDir);
const strapiCli = path.join(path.dirname(require.resolve('@strapi/strapi/package.json')), 'bin', 'strapi.js');
process.argv = [process.execPath, strapiCli, 'develop', '--no-install-deps'];
require(strapiCli);
