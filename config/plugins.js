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
            jwtSecret: env('jwtSecret', 'DFeVO895pymJjKZcZtl0og=='),
        },
    },
});
