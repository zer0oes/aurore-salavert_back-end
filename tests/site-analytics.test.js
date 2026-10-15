'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const plugin = require('../src/plugins/site-analytics/strapi-server');

test('Analytics: accès admin, configuration absente, période et rapports agrégés', async () => {
  assert.deepEqual(Object.keys(plugin.routes), ['admin']);
  assert.equal(plugin.routes.admin.type, 'admin');
  assert.ok(plugin.routes.admin.routes[0].config.policies.includes('admin::isAuthenticatedAdmin'));
  assert.deepEqual(plugin.routes.admin.routes[0].config.policies[1].config.actions, ['plugin::site-analytics.read']);
  const savedEnv = { ...process.env };
  const originalFetch = global.fetch;
  const ctx = { query: {}, set() {}, badRequest(message) { this.status = 400; this.body = message; } };
  try {
    delete process.env.GA4_PROPERTY_ID;
    await plugin.controllers.report.index(ctx);
    assert.deepEqual(ctx.body, { configured: false });
    ctx.query.range = '999';
    await plugin.controllers.report.index(ctx);
    assert.equal(ctx.status, 400);
    ctx.query.range = '30';
    process.env.GA4_PROPERTY_ID = '123';
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'test@example.test', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    const requests = [];
    global.fetch = async (url, options) => {
      if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'secret', expires_in: 3600 }) };
      const body = JSON.parse(options.body);
      requests.push(body);
      return { ok: true, json: async () => ({ rows: [{ dimensionValues: body.dimensions.map(() => ({ value: '/' })), metricValues: body.metrics.map(() => ({ value: '4' })) }] }) };
    };
    await plugin.controllers.report.index(ctx);
    assert.equal(ctx.body.configured, true);
    assert.deepEqual(ctx.body.overview, [4, 4, 4, 4]);
    assert.deepEqual(requests[0].dimensions, []);
    assert.equal(requests[0].dateRanges[0].startDate, '29daysAgo');
    assert.equal(requests[1].orderBys[0].desc, true);
    assert.ok(!JSON.stringify(ctx.body).includes('secret'));
    await plugin.controllers.report.index(ctx);
    assert.equal(requests.length, 6, 'Les rapports doivent être mis en cache');
    assert.equal(ctx.body.timeline.length, 30);
    assert.deepEqual(ctx.body.timeline[0].values, [0, 0, 0]);
    assert.deepEqual(requests[5].dimensions, [{ name: 'date' }]);
  } finally {
    global.fetch = originalFetch;
    for (const key of ['GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_JSON']) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  }
});
