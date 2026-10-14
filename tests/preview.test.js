'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../config/admin');
const { createPreviewToken, verifyPreviewToken } = require('../src/utils/preview-token');
const config = (values) => configure({ env: (key) => values[key] }).preview;

test('preview requires URL and secret', () => {
  assert.equal(config({}).enabled, false);
  assert.equal(config({ PREVIEW_URL: 'https://example.com' }).enabled, false);
  assert.equal(config({ PREVIEW_SECRET: 'secret' }).enabled, false);
});

test('project preview signs identity, locale and status without exposing the secret', async () => {
  const preview = config({ PREVIEW_URL: 'https://example.com', PREVIEW_SECRET: 'secret&value' });
  assert.equal(preview.config.allowedOrigins, 'https://example.com');
  const previous = global.strapi;
  global.strapi = { documents: () => ({ findOne: async (params) => {
    assert.equal(params.documentId, 'doc-id');
    return { slug: 'un projet/&?' };
  } }) };
  try {
    for (const status of ['draft', 'published', 'modified']) {
      const url = new URL(await preview.config.handler('api::project.project', {
        documentId: 'doc-id', locale: 'fr', status,
      }));
      assert.equal(url.pathname, '/project/un%20projet%2F%26%3F');
      assert.equal(url.searchParams.has('secret'), false);
      const claims = verifyPreviewToken(url.searchParams.get('preview'), 'secret&value');
      assert.equal(claims.documentId, 'doc-id');
      assert.equal(claims.locale, 'fr');
      assert.equal(claims.status, status === 'modified' ? 'draft' : status);
    }
    assert.equal(await preview.config.handler('api::contact.contact', { documentId: 'id' }), null);
    assert.equal(await preview.config.handler('api::project.project', {}), null);
    assert.equal(await preview.config.handler('api::project.project', { documentId: 'id', status: 'invalid' }), null);
    global.strapi.documents = () => ({ findOne: async () => null });
    assert.equal(await preview.config.handler('api::project.project', { documentId: 'missing' }), null);
    global.strapi.documents = () => ({ findOne: async () => ({}) });
    assert.equal(await preview.config.handler('api::project.project', { documentId: 'missing-slug' }), null);
  } finally { global.strapi = previous; }
});

test('tokens reject tampering, expiration, invalid claims and disabled configuration', () => {
  const token = createPreviewToken({ documentId: 'doc-id', locale: 'fr', status: 'draft' }, 'secret', 1000);
  assert.ok(verifyPreviewToken(token, 'secret', 1001));
  assert.equal(verifyPreviewToken(token, 'other', 1001), null);
  assert.equal(verifyPreviewToken(token, '', 1001), null);
  assert.equal(verifyPreviewToken(token, 'secret', 1801000), null);
  assert.equal(verifyPreviewToken(token + '.extra', 'secret', 1001), null);
  assert.equal(verifyPreviewToken('invalid', 'secret'), null);
  assert.equal(verifyPreviewToken({}, 'secret'), null);
  assert.equal(verifyPreviewToken(createPreviewToken({ documentId: 'id', status: 'invalid' }, 'secret'), 'secret'), null);
});
