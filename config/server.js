var KEY_A = require('crypto').randomBytes(16).toString('base64');
var KEY_B = require('crypto').randomBytes(16).toString('base64');

console.log(KEY_A);

module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS', [KEY_A, KEY_B]),
  },
});
