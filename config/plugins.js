module.exports = ({ env }) => ({
    email: {
        provider: 'YOUR_EMAIL_PROVIDER',
        providerOptions: {
            // Options for your email provider
        },
        settings: {
            defaultFrom: 'hello@aurore-salavert.fr',
            defaultReplyTo: 'hello@aurore-salavert.fr',
        },
    },
    'users-permissions': {
        config: {
            jwtSecret: env('jwtSecret', 'JWT_SECRET'),
        },
    },
    upload: {
        provider: 'aws-s3',
        providerOptions: {
          accessKeyId: env('AWS_ACCESS_KEY_ID'),
          secretAccessKey: env('AWS_ACCESS_SECRET'),
          region: env('AWS_REGION'),
          params: {
            Bucket: env('AWS_BUCKET'),
          },
        },
    },
});
