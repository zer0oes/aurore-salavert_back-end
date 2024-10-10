module.exports = ({ env }) => ({
    email: {
        provider: 'smtp',
        providerOptions: {
            host: env('OVH_SERVER'),
            port: 465,
            secure: true,
            auth: {
                user:  env('OVH_EMAIL_ADDRESS'),
                pass:  env('OVH_PASSWORD_MAIL'),
            },
        },
        settings: {
            defaultFrom: env('OVH_EMAIL_ADDRESS'),
            defaultReplyTo:  env('OVH_EMAIL_ADDRESS'),
        },
    },
    'users-permissions': {
        config: {
            jwtSecret: env('jwtSecret', 'JWT_SECRET'),
        },
    },
    upload: {
        config: {
            provider: 'aws-s3',
            providerOptions: {
                s3Options: {
                    credentials: {
                        accessKeyId: env('AWS_ACCESS_KEY_ID'),
                        secretAccessKey: env('AWS_ACCESS_SECRET'),
                    },
                    region: env('AWS_REGION'),
                    params: {
                        Bucket: env('AWS_BUCKET'),
                    },
                },
                ACL: 'private',
                signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60),
            },
            actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
            },
        },
    },
});
