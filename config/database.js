const path = require('path');

module.exports = ({ env }) => {
  const isProduction = env('NODE_ENV', 'development') === 'production';

  if (!isProduction) {
    return {
      connection: {
        client: 'sqlite',
        connection: {
          filename: path.resolve(
            __dirname,
            '..',
            env('DATABASE_FILENAME', '.tmp/data-local.db')
          ),
        },
        useNullAsDefault: true,
      },
    };
  }

  return {
    connection: {
      client: 'postgres',
      connection: {
        connectionString: env('DATABASE_URL'),
        ssl: {
          rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false),
        },
      },
    },
  };
};
