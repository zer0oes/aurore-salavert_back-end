module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', 'localhost'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'heroku_db_name'),
      user: env('DATABASE_USERNAME', 'heroku_user'),
      password: env('DATABASE_PASSWORD', 'heroku_password'),
      ssl: {
        rejectUnauthorized: false,
      },
    },
  },
});
