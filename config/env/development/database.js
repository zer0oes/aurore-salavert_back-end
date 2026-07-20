const path = require('path');

module.exports = ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        env('DATABASE_FILENAME', '.tmp/data-local.db')
      ),
    },
    useNullAsDefault: true,
  },
});
