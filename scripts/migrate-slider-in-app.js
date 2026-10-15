'use strict';

// Run inside the deployed Heroku backend; reuse its database access, no new API token.
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { createStrapi } = require('@strapi/core');
const { resolvePayload, writable } = require('./migrate-slider');
const source = require('../docs/migrations/slider-content.json');

async function main() {
  if (process.env.NODE_ENV !== 'production' || !process.env.DATABASE_URL) throw new Error('Production database environment required.');
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--confirm-target=auroresalavert-backend')) throw new Error('Explicit target confirmation required.');
  const appDir = path.resolve(__dirname, '..');
  const app = createStrapi({ appDir, distDir: appDir, autoReload: false });
  try {
    await app.load();
    const desired = await resolvePayload(async endpoint => {
      const url = new URL(endpoint, 'http://migration.local/');
      if (url.pathname === '/upload/files') {
        const hash = url.searchParams.get('filters[hash][$eq]');
        const name = url.searchParams.get('filters[name][$eq]');
        return app.db.query('plugin::upload.file').findMany({ where: hash ? { hash } : { name } });
      }
      if (url.pathname === '/projects') {
        return { data: await app.documents('api::project.project').findMany({
          status: 'published', locale: url.searchParams.get('locale') || undefined,
          filters: { slug: url.searchParams.get('filters[slug][$eq]') },
        }) };
      }
      throw new Error('Unexpected migration query.');
    }, source);
    const documents = app.documents('api::slider-item.slider-item');
    const populate = { Slides: { populate: ['Image', 'Project'] } };
    const published = await documents.findFirst({ status: 'published', populate });
    const draft = await documents.findFirst({ status: 'draft', populate });
    const matches = entry => isDeepStrictEqual(writable(entry), desired);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'plan', slides: desired.Slides.length, alreadyMatches: matches(published) && matches(draft) }));
    if (!apply) return;
    if (!matches(published) || !matches(draft)) {
      const documentId = draft?.documentId || published?.documentId;
      if (!documentId) throw new Error('Existing slider document not found; refusing to create another.');
      await documents.update({ documentId, status: 'published', data: desired });
    }
    const checkedPublished = await documents.findFirst({ status: 'published', populate });
    const checkedDraft = await documents.findFirst({ status: 'draft', populate });
    if (!matches(checkedPublished) || !matches(checkedDraft)) throw new Error('Post-migration content verification failed.');
    const contentTypes = app.plugin('content-manager').service('content-types');
    const type = app.contentTypes['api::slider-item.slider-item'];
    const config = await contentTypes.findConfiguration(type);
    if (config.settings.mainField !== 'Title') await contentTypes.updateConfiguration(type, {
      ...config, settings: { ...config.settings, mainField: 'Title' },
    });
    console.log('VERIFIED: four-slide content, ordering, media, projects, hooks, positions, themes, draft and publication match the local export.');
  } finally {
    await app.destroy();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
