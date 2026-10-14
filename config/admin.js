const { createPreviewToken } = require('../src/utils/preview-token');

module.exports = ({ env }) => ({
  preview: {
    enabled: Boolean(env('PREVIEW_URL') && env('PREVIEW_SECRET')),
    config: {
      allowedOrigins: env('PREVIEW_URL') ? new URL(env('PREVIEW_URL')).origin : [],
      async handler(uid, { documentId, locale, status }) {
        if (uid !== 'api::project.project' || !documentId) return null;
        // The Content Manager uses "modified" for a draft with published changes.
        status = !status || status === 'modified' ? 'draft' : status;
        if (!['draft', 'published'].includes(status)) return null;

        const document = await strapi.documents(uid).findOne({
          documentId,
          locale,
          status,
        });
        if (!document || !document.slug) return null;

        const url = new URL(env('PREVIEW_URL'));
        url.pathname = `${url.pathname.replace(/\/$/, '')}/project/${encodeURIComponent(document.slug)}`;
        url.searchParams.set('preview', createPreviewToken({ documentId, locale, status }, env('PREVIEW_SECRET')));
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
