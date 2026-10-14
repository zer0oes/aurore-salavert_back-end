'use strict';

/**
 *  project controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { verifyPreviewToken } = require('../../../utils/preview-token');

module.exports = createCoreController('api::project.project', ({ strapi }) => ({
  async preview(ctx) {
    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Robots-Tag', 'noindex, nofollow');
    const claims = verifyPreviewToken(ctx.query.token, process.env.PREVIEW_SECRET);
    if (!claims) return ctx.unauthorized('Lien de prévisualisation invalide ou expiré.');
    const document = await strapi.documents('api::project.project').findOne({
      documentId: claims.documentId,
      locale: claims.locale,
      status: claims.status,
      populate: ['thumbnail', 'gallery', 'categories', 'layout'],
    });
    if (!document) return ctx.notFound('Projet introuvable.');
    const data = await strapi.contentAPI.sanitize.output(document, strapi.getModel('api::project.project'));
    ctx.body = { data: [data], meta: { preview: true, status: claims.status, locale: claims.locale } };
  },
}));

