'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client, portable, writable, resolvePayload } = require('./migrate-slider');

const media = { id: 17, documentId: 'target-image', hash: 'example', name: 'example.jpg', mime: 'image/jpeg', width: 2000, height: 1333 };
const project = { documentId: 'target-project', slug: 'example', locale: 'fr', publishedAt: '2026-10-15' };
const entry = { Title: 'Slider d’accueil', Slides: [{ id: 999, Image: { ...media, url: 'https://example.test/image?signature=temporary' }, Project: project, Accroche: [{ type: 'paragraph', children: [{ type: 'text', text: 'Bonjour' }] }], Position: 'bottom-center', Theme: 'light' }] };
const source = portable(entry);

test('portable snapshot excludes IDs and signed URLs', () => {
  const json = JSON.stringify(source);
  assert.ok(!json.includes('signature'));
  assert.ok(!json.includes('documentId'));
  assert.ok(!json.includes('999'));
  assert.deepEqual(source.Slides[0].Project, { slug: 'example', locale: 'fr' });
});

test('resolves target media IDs and localized project documentIds', async () => {
  const calls = [];
  const data = await resolvePayload(async endpoint => {
    calls.push(endpoint);
    return endpoint.startsWith('upload/') ? [media] : { data: [project] };
  }, source);
  assert.deepEqual(data, writable(entry));
  assert.ok(calls[1].includes('locale=fr'));
  assert.equal(data.Slides[0].Image, 17);
  assert.equal(data.Slides[0].Project, 'target-project');
});

test('rejects absent media instead of reusing a local ID', async () => {
  await assert.rejects(resolvePayload(async () => [], source), /Missing or incompatible media/);
});

test('rejects ambiguous media and projects', async () => {
  await assert.rejects(resolvePayload(async () => [media, media], source), /Ambiguous media/);
  await assert.rejects(resolvePayload(async endpoint => endpoint.startsWith('upload/') ? [media] : { data: [project, project] }, source), /ambiguous published project/);
});

test('rejects incompatible media dimensions', async () => {
  await assert.rejects(resolvePayload(async () => [{ ...media, width: 500 }], source), /incompatible media/);
});

test('rejects credentials in URLs and insecure remote targets', () => {
  assert.throws(() => client('https://user:password@example.test'), /credentials/);
  assert.throws(() => client('http://example.test'), /HTTPS/);
  assert.doesNotThrow(() => client('http://127.0.0.1:1338'));
});

test('CLI plan is read-only; apply backs up, verifies and is idempotent', async () => {
  const http = require('node:http');
  const fs = require('node:fs');
  const path = require('node:path');
  const { promisify } = require('node:util');
  const exec = promisify(require('node:child_process').execFile);
  const content = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/migrations/slider-content.json'), 'utf8'));
  const mediaList = content.Slides.map((slide, index) => ({ ...slide.Image, id: 100 + index }));
  const projects = content.Slides.filter(slide => slide.Project).map(slide => ({ ...slide.Project, documentId: `target-${slide.Project.slug}`, publishedAt: '2026-10-15' }));
  let state = { Title: 'Before', Slides: [] };
  let writes = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'PUT') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const payload = JSON.parse(raw).data;
      state = { Title: payload.Title, Slides: payload.Slides.map(slide => ({ ...slide, Image: mediaList.find(item => item.id === slide.Image), Project: projects.find(item => item.documentId === slide.Project) || null })) };
      writes++;
      res.end(JSON.stringify({ data: state }));
    } else if (url.pathname.endsWith('/upload/files')) {
      res.end(JSON.stringify(mediaList.filter(item => item.hash === url.searchParams.get('filters[hash][$eq]') || item.name === url.searchParams.get('filters[name][$eq]'))));
    } else if (url.pathname.endsWith('/projects')) {
      res.end(JSON.stringify({ data: projects.filter(item => item.slug === url.searchParams.get('filters[slug][$eq]') && item.locale === url.searchParams.get('locale')) }));
    } else {
      res.end(JSON.stringify({ data: state }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const target = `http://127.0.0.1:${server.address().port}`;
  const run = (...args) => exec(process.execPath, [path.join(__dirname, 'migrate-slider.js'), ...args], {
    env: { ...process.env, SLIDER_TARGET_URL: target, SLIDER_API_TOKEN: 'fixture-only' }, timeout: 15000,
  });
  try {
    await run('plan');
    assert.equal(writes, 0);
    await assert.rejects(run('apply'));
    assert.equal(writes, 0);
    const applied = await run('apply', `--confirm-target=${target}`);
    assert.match(applied.stdout, /Backup:/);
    assert.match(applied.stdout, /Verified:/);
    assert.equal(writes, 1);
    const repeated = await run('apply', `--confirm-target=${target}`);
    assert.match(repeated.stdout, /Already migrated/);
    assert.equal(writes, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
