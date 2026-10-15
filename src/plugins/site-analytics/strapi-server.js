'use strict';

const { createSign } = require('node:crypto');
const { readFileSync } = require('node:fs');
const action = 'plugin::site-analytics.read';
let token;
let cached;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function googleToken(credentials) {
  if (token && token.expires > Date.now()) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(payload).sign(credentials.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${payload}.${signature}` }),
  });
  if (!response.ok) throw new Error('Google authentication failed');
  const result = await response.json();
  if (!result.access_token) throw new Error('Missing Google access token');
  token = { value: result.access_token, expires: Date.now() + (result.expires_in - 60) * 1000 };
  return token.value;
}

module.exports = {
  async bootstrap({ strapi }) {
    await strapi.admin.services.permission.actionProvider.registerMany([
      { section: 'plugins', displayName: 'Consulter les statistiques', uid: 'read', pluginName: 'site-analytics' },
    ]);
  },
  routes: { admin: { type: 'admin', routes: [
    { method: 'GET', path: '/report', handler: 'report.index', config: {
      policies: ['admin::isAuthenticatedAdmin', { name: 'admin::hasPermissions', config: { actions: [action] } }],
    } },
  ] } },
  controllers: {
    report: {
      async index(ctx) {
        ctx.set('Cache-Control', 'no-store');
        const range = String(ctx.query.range || '7');
        if (!['7', '30', '90'].includes(range)) return ctx.badRequest('Période invalide.');
        const property = process.env.GA4_PROPERTY_ID;
        const json = process.env.GA4_SERVICE_ACCOUNT_JSON;
        const file = process.env.GA4_SERVICE_ACCOUNT_FILE;
        if (!property || (!json && !file)) {
          ctx.body = { configured: false };
          return;
        }
        if (!/^\d+$/.test(property)) return ctx.badRequest('GA4_PROPERTY_ID doit être numérique.');
        try {
          if (cached && cached.property === property && cached.range === range && cached.expires > Date.now()) {
            ctx.body = cached.data;
            return;
          }
          const credentials = JSON.parse(json || readFileSync(file, 'utf8'));
          const accessToken = await googleToken(credentials);
          let timeZone = 'Europe/Paris';
          const report = async (dimensions, metrics, limit) => {
            const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
              method: 'POST', signal: AbortSignal.timeout(20000),
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dateRanges: [{ startDate: `${Number(range) - 1}daysAgo`, endDate: 'today' }],
                dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })),
                ...(limit ? { limit, orderBys: [{ metric: { metricName: metrics[0] }, desc: true }] } : {}),
              }),
            });
            if (!response.ok) throw new Error(`Google report status ${response.status}`);
            const result = await response.json();
            if (result.metadata?.timeZone) timeZone = result.metadata.timeZone;
            return (result.rows || []).map((row) => ({
              labels: (row.dimensionValues || []).map((item) => item.value),
              values: row.metricValues.map((item) => Number(item.value)),
            }));
          };
          const [overview, pages, sources, countries, devices, daily] = await Promise.all([
            report([], ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate']),
            report(['pagePath'], ['screenPageViews'], 10),
            report(['sessionSourceMedium'], ['sessions'], 10),
            report(['country'], ['activeUsers'], 10),
            report(['deviceCategory'], ['activeUsers'], 10),
            report(['date'], ['activeUsers', 'sessions', 'screenPageViews']),
          ]);
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
          const part = (name) => parts.find((item) => item.type === name).value;
          const today = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
          const byDate = new Map(daily.map((row) => [row.labels[0], row.values]));
          const timeline = Array.from({ length: Number(range) }, (_, index) => {
            const day = new Date(today);
            day.setUTCDate(day.getUTCDate() - Number(range) + index + 1);
            const date = day.toISOString().slice(0, 10);
            return { date, values: byDate.get(date.replaceAll('-', '')) || [0, 0, 0] };
          });
          const data = { configured: true, overview: overview[0]?.values || [0, 0, 0, 0], pages, sources, countries, devices, timeline };
          cached = { property, range, expires: Date.now() + 300000, data };
          ctx.body = data;
        } catch (error) {
          strapi.log.warn(`[site-analytics] ${error.code || 'Google Analytics unavailable'}`);
          ctx.status = 502;
          ctx.body = { error: { message: 'Impossible de lire Google Analytics. Vérifiez les identifiants, l’API Data et l’accès Lecteur à la propriété.' } };
        }
      },
    },
  },
};
