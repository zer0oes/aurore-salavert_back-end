module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'bookshelf',
      settings: {
        client: 'postgres',
        connection: env('DATABASE_URL'),
      },
      options: {
        useNullAsDefault: true,
      },
    },
  },
});
