'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { createStrapi } = require('@strapi/core');

const APP_DIR = path.resolve(__dirname, '..');
const DATABASE_PATH = path.join(APP_DIR, '.tmp', 'data-local.db');
const PRODUCTION_API = 'https://strapi.aurore-salavert.fr/api';
const LOCALES = ['en', 'fr'];
const PROJECT_SLUG_ALIASES = {
  'as-graphic-design': ['aurore-salavert'],
  'my-coachin': ['my-coach-in'],
};

process.env.HOST = '127.0.0.1';
process.env.BROWSER = 'false';
process.env.NODE_ENV = 'development';
process.env.DATABASE_FILENAME = '.tmp/data-local.db';
process.env.APP_KEYS = process.env.APP_KEYS || 'local-sync-app-key-a,local-sync-app-key-b';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'local-sync-admin-jwt-secret';
process.env.API_TOKEN_SALT = process.env.API_TOKEN_SALT || 'local-sync-api-token-salt';
process.env.TRANSFER_TOKEN_SALT = process.env.TRANSFER_TOKEN_SALT || 'local-sync-transfer-token-salt';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'local-sync-encryption-key-32-chars';

const byDocumentId = (entries) => {
  const groups = new Map();

  for (const entry of entries) {
    const group = groups.get(entry.documentId) || [];
    group.push(entry);
    groups.set(entry.documentId, group);
  }

  return groups;
};

const fetchJson = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  return response.json();
};

const fetchProductionCollection = async (endpoint, { localized = true } = {}) => {
  const locales = localized ? LOCALES : [null];
  const pages = await Promise.all(
    locales.map((locale) => {
      const localeQuery = locale ? `&locale=${locale}` : '';
      return fetchJson(
        `${PRODUCTION_API}/${endpoint}?populate=*${localeQuery}&pagination[pageSize]=100`
      );
    })
  );

  return pages.flatMap((page) => page.data);
};

const uniqueBy = (entries, getKey) => {
  const result = new Map();

  for (const entry of entries) {
    if (entry) {
      result.set(getKey(entry), entry);
    }
  }

  return [...result.values()];
};

const createS3Reader = () => {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_ACCESS_SECRET;
  const bucket = process.env.AWS_BUCKET;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('AWS read credentials are missing from the local environment');
  }

  return {
    bucket,
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
};

const sourceFileName = (media) =>
  path.basename(media.name || `${media.hash}${media.ext || ''}`).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');

const readSourceMedia = async (media, s3Reader) => {
  if (media.provider === 'local') {
    const localPath = path.join(APP_DIR, 'public', media.url.replace(/^\//, ''));
    return fs.readFile(localPath);
  }

  if (media.provider === 'aws-s3') {
    const key = decodeURIComponent(new URL(media.url).pathname.replace(/^\//, ''));
    const response = await s3Reader.client.send(
      new GetObjectCommand({ Bucket: s3Reader.bucket, Key: key })
    );

    return Buffer.from(await response.Body.transformToByteArray());
  }

  const response = await fetch(media.url);

  if (!response.ok) {
    throw new Error(`Unable to download ${media.name}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const createMediaImporter = (strapi) => {
  const uploadService = strapi.plugin('upload').service('upload');
  const s3Reader = createS3Reader();
  const cache = new Map();

  const loadExistingMedia = async () => {
    const files = await strapi.db.query('plugin::upload.file').findMany({
      where: { provider: 'local' },
    });

    for (const file of files) {
      cache.set(file.hash, file);
    }
  };

  const ensureLocalMedia = async (media) => {
    if (!media) {
      return null;
    }

    if (cache.has(media.hash)) {
      return cache.get(media.hash);
    }

    const buffer = await readSourceMedia(media, s3Reader);
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'project-sync-'));
    const tempPath = path.join(tempDirectory, sourceFileName(media));

    try {
      await fs.writeFile(tempPath, buffer);
      const uploaded = await uploadService.upload({
        data: {
          fileInfo: {
            name: media.name,
            alternativeText: media.alternativeText,
            caption: media.caption,
          },
        },
        files: {
          filepath: tempPath,
          originalFilename: sourceFileName(media),
          mimetype: media.mime,
          detectedMimeType: media.mime,
          size: buffer.length,
        },
      });
      const imported = await strapi.db.query('plugin::upload.file').update({
        where: { id: uploaded[0].id },
        data: {
          hash: media.hash,
          alternativeText: media.alternativeText,
          caption: media.caption,
        },
      });

      cache.set(media.hash, imported);
      return imported;
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  };

  return { ensureLocalMedia, loadExistingMedia };
};

const upsertLocalizedGroups = async ({
  repository,
  productionGroups,
  existingEntries,
  toData,
  getMatchValues,
  findExisting,
}) => {
  const mapping = new Map();

  for (const [productionDocumentId, entries] of productionGroups) {
    const matchValues = getMatchValues(entries);
    const existing = findExisting
      ? findExisting(existingEntries, entries)
      : existingEntries.find(
          (entry) => matchValues.has(entry.slug) || matchValues.has(entry.title)
        );
    let localDocumentId = existing?.documentId;

    for (const entry of entries.sort((a, b) => LOCALES.indexOf(a.locale) - LOCALES.indexOf(b.locale))) {
      const options = {
        locale: entry.locale,
        status: 'published',
        data: toData(entry),
      };
      const saved = localDocumentId
        ? await repository.update({ documentId: localDocumentId, ...options })
        : await repository.create(options);

      localDocumentId = saved.documentId;
      mapping.set(`${productionDocumentId}:${entry.locale}`, {
        documentId: localDocumentId,
        locale: entry.locale,
      });
    }
  }

  return mapping;
};

const ensureFrenchLocale = async (strapi) => {
  const localeService = strapi.plugin('i18n').service('locales');
  const existing = await localeService.findByCode('fr');

  if (!existing) {
    await localeService.create({ name: 'French (fr)', code: 'fr' });
    console.log('[locale] registered fr');
  }
};

const synchronize = async (strapi) => {
  await ensureFrenchLocale(strapi);

  const [projects, productionCategories, productionLayouts, skills, socialNetworks] =
    await Promise.all([
      fetchProductionCollection('projects'),
      fetchProductionCollection('categories'),
      fetchProductionCollection('layouts', { localized: false }),
      fetchProductionCollection('skills'),
      fetchProductionCollection('social-networks', { localized: false }),
    ]);
  const projectRepository = strapi.documents('api::project.project');
  const categoryRepository = strapi.documents('api::category.category');
  const layoutRepository = strapi.documents('api::layout.layout');
  const skillRepository = strapi.documents('api::skill.skill');
  const socialNetworkRepository = strapi.documents('api::social-network.social-network');
  const mediaImporter = createMediaImporter(strapi);

  await mediaImporter.loadExistingMedia();

  const localProjects = await projectRepository.findMany({
    locale: '*',
    status: 'draft',
    populate: ['thumbnail', 'gallery', 'categories', 'layout'],
  });

  const projectsWithRemoteMedia = localProjects.filter(
    (project) =>
      project.thumbnail?.provider !== 'local' ||
      project.gallery?.some((media) => media.provider !== 'local')
  );

  for (const project of projectsWithRemoteMedia) {
    const thumbnail = await mediaImporter.ensureLocalMedia(project.thumbnail);
    const gallery = [];

    for (const media of project.gallery || []) {
      gallery.push(await mediaImporter.ensureLocalMedia(media));
    }

    await projectRepository.update({
      documentId: project.documentId,
      locale: project.locale,
      status: 'published',
      data: {
        thumbnail: thumbnail?.id || null,
        gallery: gallery.map((media) => media.id),
      },
    });
  }

  const productionMedia = uniqueBy(
    [
      ...projects.flatMap((project) => [project.thumbnail, ...(project.gallery || [])]),
      ...skills.map((skill) => skill.icon),
    ],
    (media) => media.hash
  );
  const mediaMapping = new Map();

  for (let index = 0; index < productionMedia.length; index += 1) {
    const source = productionMedia[index];
    const imported = await mediaImporter.ensureLocalMedia(source);
    mediaMapping.set(source.hash, imported);
    console.log(`[media ${index + 1}/${productionMedia.length}] ${source.name}`);
  }

  const uniqueProductionCategories = uniqueBy(
    productionCategories,
    (category) => `${category.documentId}:${category.locale}`
  );
  const existingCategories = await categoryRepository.findMany({
    locale: '*',
    status: 'draft',
  });
  const categoryMapping = await upsertLocalizedGroups({
    repository: categoryRepository,
    productionGroups: byDocumentId(uniqueProductionCategories),
    existingEntries: existingCategories,
    toData: (category) => ({ title: category.title, slug: category.slug }),
    getMatchValues: (entries) => new Set(entries.flatMap((entry) => [entry.slug, entry.title])),
  });

  const uniqueProductionLayouts = uniqueBy(
    productionLayouts,
    (layout) => layout.documentId
  );
  const existingLayouts = await layoutRepository.findMany({ status: 'draft' });
  const layoutMapping = new Map();

  for (const layout of uniqueProductionLayouts) {
    const existing = existingLayouts.find(
      (entry) => entry.slug === layout.slug || entry.title === layout.title
    );
    const options = {
      status: 'published',
      data: { title: layout.title, slug: layout.slug },
    };
    const saved = existing
      ? await layoutRepository.update({ documentId: existing.documentId, ...options })
      : await layoutRepository.create(options);

    layoutMapping.set(layout.documentId, { documentId: saved.documentId });
  }

  const existingSkills = await skillRepository.findMany({
    locale: '*',
    status: 'draft',
    populate: ['icon'],
  });
  await upsertLocalizedGroups({
    repository: skillRepository,
    productionGroups: byDocumentId(skills),
    existingEntries: existingSkills,
    toData: (skill) => ({
      title: skill.title,
      text: skill.text,
      order: skill.order,
      icon: skill.icon ? mediaMapping.get(skill.icon.hash)?.id || null : null,
    }),
    getMatchValues: (entries) => new Set(entries.flatMap((entry) => [entry.title, entry.order])),
    findExisting: (localEntries, entries) => {
      const orders = new Set(entries.map((entry) => entry.order));
      const titles = new Set(entries.map((entry) => entry.title));
      return localEntries.find(
        (entry) => orders.has(entry.order) || titles.has(entry.title)
      );
    },
  });

  const existingSocialNetworks = await socialNetworkRepository.findMany({ status: 'draft' });

  for (const socialNetwork of uniqueBy(socialNetworks, (entry) => entry.documentId)) {
    const existing = existingSocialNetworks.find(
      (entry) => entry.icon === socialNetwork.icon || entry.url === socialNetwork.url
    );
    const options = {
      status: 'published',
      data: { icon: socialNetwork.icon, url: socialNetwork.url },
    };

    if (existing) {
      await socialNetworkRepository.update({ documentId: existing.documentId, ...options });
    } else {
      await socialNetworkRepository.create(options);
    }
  }

  const projectGroups = byDocumentId(projects);

  for (const entries of projectGroups.values()) {
    const sourceSlugs = new Set(entries.map((entry) => entry.slug));
    const aliases = entries.flatMap((entry) => PROJECT_SLUG_ALIASES[entry.slug] || []);
    const sourceTitles = new Set(entries.map((entry) => entry.title));
    const existing = localProjects.find(
      (project) =>
        sourceSlugs.has(project.slug) ||
        aliases.includes(project.slug) ||
        sourceTitles.has(project.title)
    );
    let localDocumentId = existing?.documentId;

    for (const project of entries.sort((a, b) => LOCALES.indexOf(a.locale) - LOCALES.indexOf(b.locale))) {
      const categories = (project.categories || []).map((category) => {
        const relation = categoryMapping.get(`${category.documentId}:${category.locale}`);

        if (!relation) {
          throw new Error(`Missing local category mapping for ${category.slug}/${category.locale}`);
        }

        return relation;
      });
      const thumbnail = mediaMapping.get(project.thumbnail?.hash);
      const gallery = (project.gallery || []).map((media) => mediaMapping.get(media.hash));
      const data = {
        slug: project.slug,
        title: project.title,
        description: project.description,
        thumbnail: thumbnail?.id || null,
        gallery: gallery.map((media) => media.id),
        categories,
        layout: project.layout ? layoutMapping.get(project.layout.documentId) : null,
      };
      const options = { locale: project.locale, status: 'published', data };
      const saved = localDocumentId
        ? await projectRepository.update({ documentId: localDocumentId, ...options })
        : await projectRepository.create(options);

      localDocumentId = saved.documentId;
      console.log(`[project ${project.locale}] ${project.slug}`);
    }
  }

  const refreshedLocalProjects = await projectRepository.findMany({
    locale: '*',
    status: 'draft',
    populate: ['thumbnail', 'gallery'],
  });
  const localProjectGroups = byDocumentId(refreshedLocalProjects);
  let createdLocalProjectLocales = 0;

  for (const entries of localProjectGroups.values()) {
    const availableLocales = new Set(entries.map((entry) => entry.locale));
    const source = entries.find((entry) => entry.locale === 'en') || entries[0];

    for (const locale of LOCALES.filter((entryLocale) => !availableLocales.has(entryLocale))) {
      await projectRepository.update({
        documentId: source.documentId,
        locale,
        status: 'published',
        data: {
          slug: source.slug,
          title: source.title,
          description: source.description,
          thumbnail: source.thumbnail?.id || null,
          gallery: (source.gallery || []).map((media) => media.id),
        },
      });
      createdLocalProjectLocales += 1;
      console.log(`[local project ${locale}] ${source.slug}`);
    }
  }

  return {
    importedProductionProjects: projectGroups.size,
    importedProductionLocales: projects.length,
    importedProductionCategories: byDocumentId(uniqueProductionCategories).size,
    importedProductionCategoryLocales: uniqueProductionCategories.length,
    importedProductionLayouts: uniqueProductionLayouts.length,
    importedProductionSkills: byDocumentId(skills).size,
    importedProductionSkillLocales: skills.length,
    importedProductionSocialNetworks: uniqueBy(
      socialNetworks,
      (entry) => entry.documentId
    ).length,
    copiedProductionMedia: productionMedia.length,
    migratedLocalProjectsToLocalMedia: projectsWithRemoteMedia.length,
    createdLocalProjectLocales,
  };
};

const main = async () => {
  const strapi = createStrapi({ appDir: APP_DIR, distDir: APP_DIR, autoReload: false });
  strapi.config.set('database.connection', {
    client: 'sqlite',
    connection: { filename: DATABASE_PATH },
    useNullAsDefault: true,
  });

  try {
    await strapi.load();
    const result = await synchronize(strapi);
    console.log(`SYNC_RESULT ${JSON.stringify(result)}`);
  } finally {
    await strapi.destroy();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
