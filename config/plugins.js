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
  });
  