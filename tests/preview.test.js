'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../config/admin');

const config = (values) => configure({ env: (key) => values[key] }).preview;

test('preview requires both an endpoint and a secret', () => {
  assert.equal(config({}).enabled, false);
  assert.equal(config({ PREVIEW_URL: 'https://example.com/preview' }).enabled, false);
  assert.equal(config({ PREVIEW_SECRET: 'secret' }).enabled, false);
});

test('preview preserves document identity, locale, status and encoded slug', async () => {
  const preview = config({
    PREVIEW_URL: 'https://example.com/preview?existing=value',
    PREVIEW_SECRET: 'secret&value',
  });
  assert.equal(preview.enabled, true);
  assert.equal(preview.config.allowedOrigins, 'https://example.com');
  const previous = global.strapi;
  global.strapi = {
    documents(uid) {
      assert.equal(uid, 'api::project.project');
      return {
        async findOne(params) {
          assert.deepEqual(params, { documentId: 'doc-id', locale: 'fr', status: 'draft' });
          return { slug: 'un projet/&?' };
        },
      };
    },
  };
  try {
    const url = new URL(await preview.config.handler('api::project.project', {
      documentId: 'doc-id', locale: 'fr', status: 'draft',
    }));
    assert.equal(url.searchParams.get('secret'), 'secret&value');
    assert.equal(url.searchParams.get('slug'), 'un projet/&?');
    assert.equal(url.searchParams.get('documentId'), 'doc-id');
    assert.equal(url.searchParams.get('uid'), 'api::project.project');
    assert.equal(url.searchParams.get('locale'), 'fr');
    assert.equal(url.searchParams.get('status'), 'draft');
    assert.equal(url.searchParams.get('existing'), 'value');
    global.strapi.documents = () => ({ findOne: async () => ({}) });
    const published = new URL(await preview.config.handler('api::contact.contact', {
      documentId: 'contact-id', status: 'published',
    }));
    assert.equal(published.searchParams.get('status'), 'published');
    assert.equal(published.searchParams.has('slug'), false);
    assert.equal(published.searchParams.has('locale'), false);
    global.strapi.documents = () => ({ findOne: async () => null });
    assert.equal(await preview.config.handler('api::project.project', { documentId: 'missing' }), null);
  } finally {
    global.strapi = previous;
  }
  assert.equal(await preview.config.handler('admin::user', { documentId: 'id' }), null);
  assert.equal(await preview.config.handler('api::project.project', {}), null);
});
