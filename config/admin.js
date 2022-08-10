var API_TOKEN_SALT = require('crypto').randomBytes(16).toString('base64');
var ADMIN_JWT_SECRET =  require('crypto').randomBytes(64).toString('hex');
module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', ADMIN_JWT_SECRET),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', API_TOKEN_SALT),
  },
});
