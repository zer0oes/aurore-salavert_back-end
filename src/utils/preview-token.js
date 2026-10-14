'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');
const sign = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');

function createPreviewToken(document, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...document, expires: now + 30 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

function verifyPreviewToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 4096) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const document = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof document.documentId !== 'string' || !document.documentId ||
        !['draft', 'published'].includes(document.status) ||
        (document.locale !== undefined && typeof document.locale !== 'string') ||
        !Number.isFinite(document.expires) || document.expires <= now) return null;
    return document;
  } catch {
    return null;
  }
}

module.exports = { createPreviewToken, verifyPreviewToken };
