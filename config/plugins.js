module.exports = ({ env }) => ({
    email: {
        provider: 'smtp',
        providerOptions: {
            host: 'ssl0.ovh.net',
            port: 465,
            secure: true,
            auth: {
                user: 'hello@aurore-salavert.fr',
                pass: '&xmoBXYXJ5SXQs$i',
            },
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
