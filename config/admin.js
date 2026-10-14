module.exports = ({ env }) => ({
  preview: {
    // Enable only after the front-end preview endpoint and its secret are configured.
    enabled: Boolean(env('PREVIEW_URL') && env('PREVIEW_SECRET')),
    config: {
      allowedOrigins: env('PREVIEW_URL') ? new URL(env('PREVIEW_URL')).origin : [],
      async handler(uid, { documentId, locale, status }) {
        if (!uid.startsWith('api::') || !documentId) return null;

        const document = await strapi.documents(uid).findOne({
          documentId,
          locale,
          status,
        });
        if (!document) return null;

        const url = new URL(env('PREVIEW_URL'));
        url.searchParams.set('secret', env('PREVIEW_SECRET'));
        url.searchParams.set('uid', uid);
        url.searchParams.set('documentId', documentId);
        url.searchParams.set('status', status || 'draft');
        if (locale) url.searchParams.set('locale', locale);
        if (document.slug) url.searchParams.set('slug', document.slug);
        return url.toString();
      },
    },
  },
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
});
