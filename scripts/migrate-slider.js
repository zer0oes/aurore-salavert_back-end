'use strict';

// Targeted REST migration. Does not bootstrap Strapi or access a database directly.
const fs = require('node:fs/promises');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const root = path.resolve(__dirname, '..');
const contentFile = path.join(root, 'docs/migrations/slider-content.json');
const query = 'populate[Slides][populate][Image]=true&populate[Slides][populate][Project]=true';
const positions = new Set(['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right']);

function client(base, token) {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash) throw new Error('Use an origin URL without credentials or query.');
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('HTTPS required for remote targets.');
  return async (endpoint, data) => {
    const response = await fetch(new URL(`/api/${endpoint}`, url), {
      method: data ? 'PUT' : 'GET',
      redirect: 'error',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
      body: data ? JSON.stringify({ data }) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${data ? 'PUT' : 'GET'} /api/${endpoint.split('?')[0]}: HTTP ${response.status}`);
    return response.json();
  };
}

function portable(data) {
  if (!data?.Slides?.length) throw new Error('No published slides found.');
  return {
    version: 1,
    Title: data.Title || 'Slider d’accueil',
    Slides: data.Slides.map(slide => {
      if (!slide.Image?.mime?.startsWith('image/')) throw new Error('Each slide must reference an image.');
      if (!positions.has(slide.Position) || !['light', 'dark'].includes(slide.Theme)) throw new Error('Invalid position/theme.');
      if (slide.Project && (!slide.Project.slug || !slide.Project.publishedAt)) throw new Error('Project must be published and have a slug.');
      return {
        Image: { hash: slide.Image.hash, name: slide.Image.name, mime: slide.Image.mime, width: slide.Image.width, height: slide.Image.height },
        Accroche: slide.Accroche || [],
        Project: slide.Project ? { slug: slide.Project.slug, locale: slide.Project.locale } : null,
        Position: slide.Position,
        Theme: slide.Theme,
      };
    }),
  };
}

function writable(data) {
  return {
    Title: data?.Title || '',
    Slides: (data?.Slides || []).map(slide => ({
      Image: slide.Image?.id,
      Accroche: slide.Accroche || [],
      Project: slide.Project?.documentId || null,
      Position: slide.Position,
      Theme: slide.Theme,
    })),
  };
}

async function backup(api, base) {
  const states = {};
  // populate=* also supports the legacy Gallery before the new schema deploys.
  for (const status of ['draft', 'published']) {
    const entry = (await api(`slider-item?status=${status}&populate=*`)).data;
    states[status] = entry && Object.hasOwn(entry, 'Slides')
      ? { ...entry, ...(await api(`slider-item?status=${status}&${query}`)).data }
      : entry;
  }
  const directory = path.join(root, '.tmp/slider-backups');
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(file, JSON.stringify({ target: base, states }, null, 2), { flag: 'wx' });
  console.log(`Backup: ${file}`);
  return file;
}

async function resolvePayload(api, source) {
  if (source.version !== 1 || !source.Slides?.length) throw new Error('Invalid migration content.');
  const Slides = [];
  for (const slide of source.Slides) {
    if (!positions.has(slide.Position) || !['light', 'dark'].includes(slide.Theme)) throw new Error('Invalid position/theme.');
    let media;
    for (const key of ['hash', 'name']) {
      if (!slide.Image[key]) continue;
      const params = new URLSearchParams({ [`filters[${key}][$eq]`]: slide.Image[key] });
      const response = await api(`upload/files?${params}`);
      const matches = Array.isArray(response) ? response : response.data;
      if (!Array.isArray(matches)) throw new Error('Invalid media API response.');
      if (matches.length > 1) throw new Error(`Ambiguous media: ${slide.Image.name}`);
      if (matches.length === 1) { media = matches[0]; break; }
    }
    if (!media || media.mime !== slide.Image.mime || media.width !== slide.Image.width || media.height !== slide.Image.height) {
      throw new Error(`Missing or incompatible media: ${slide.Image.name}. Upload/verify it in the target Media Library first.`);
    }
    let project = null;
    if (slide.Project) {
      const params = new URLSearchParams({ 'filters[slug][$eq]': slide.Project.slug, status: 'published' });
      if (slide.Project.locale) params.set('locale', slide.Project.locale);
      const response = await api(`projects?${params}`);
      if (response.data?.length !== 1) throw new Error(`Missing or ambiguous published project: ${slide.Project.slug}`);
      project = response.data[0].documentId;
    }
    Slides.push({ Image: media.id, Accroche: slide.Accroche, Project: project, Position: slide.Position, Theme: slide.Theme });
    console.log(`Resolved: ${slide.Image.name} -> ${slide.Project?.slug || '(no project)'}`);
  }
  return { Title: source.Title, Slides };
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'export') {
    const api = client(process.env.SLIDER_SOURCE_URL || 'http://127.0.0.1:1338', process.env.SLIDER_SOURCE_TOKEN);
    const data = (await api(`slider-item?status=published&${query}`)).data;
    const snapshot = portable(data);
    await fs.mkdir(path.dirname(contentFile), { recursive: true });
    await fs.writeFile(contentFile, JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`Exported ${snapshot.Slides.length} slides to ${contentFile}`);
    return;
  }
  if (!['backup', 'plan', 'apply'].includes(mode)) throw new Error('Usage: node scripts/migrate-slider.js export | backup | plan | apply --confirm-target=<origin>');
  const base = process.env.SLIDER_TARGET_URL;
  if (!base) throw new Error('Set SLIDER_TARGET_URL explicitly.');
  const api = client(base, process.env.SLIDER_API_TOKEN);
  if (mode === 'backup') { await backup(api, base); return; }
  const source = JSON.parse(await fs.readFile(contentFile, 'utf8'));
  const desired = await resolvePayload(api, source);
  const current = (await api(`slider-item?status=published&${query}`)).data;
  const draft = (await api(`slider-item?status=draft&${query}`)).data;
  if (isDeepStrictEqual(writable(current), desired) && isDeepStrictEqual(writable(draft), desired)) {
    console.log('Already migrated: draft and published slider match. No writes.');
    return;
  }
  console.log(`Plan: replace slider content with ${desired.Slides.length} slides on ${new URL(base).origin}.`);
  if (mode === 'plan') { console.log('Read-only plan. No writes.'); return; }
  if (!process.env.SLIDER_API_TOKEN) throw new Error('SLIDER_API_TOKEN required for apply.');
  if (!args.includes(`--confirm-target=${new URL(base).origin}`)) throw new Error('Explicit --confirm-target=<origin> required.');
  const backupFile = await backup(api, base);
  await api('slider-item?status=published', desired);
  const published = (await api(`slider-item?status=published&${query}`)).data;
  const updatedDraft = (await api(`slider-item?status=draft&${query}`)).data;
  if (!isDeepStrictEqual(writable(published), desired) || !isDeepStrictEqual(writable(updatedDraft), desired)) {
    throw new Error(`Post-migration verification failed. Stop deployment and use backup ${backupFile}.`);
  }
  console.log('Verified: published and draft content, slide order, images, projects, hooks, positions and themes match.');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { client, portable, writable, resolvePayload };
