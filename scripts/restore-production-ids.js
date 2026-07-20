'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const APP_DIR = path.resolve(__dirname, '..');
const DATABASE_PATH = path.join(APP_DIR, '.tmp', 'data-local.db');
const ENTITIES_PATH = path.join(APP_DIR, '.tmp', 'production-entities.jsonl');
const CONTENT_TABLES = {
  'api::category.category': 'categories',
  'api::competence.competence': 'competences',
  'api::contact.contact': 'contacts',
  'api::layout.layout': 'layouts',
  'api::privacy-policy.privacy-policy': 'privacy_policies',
  'api::project.project': 'projects',
  'api::service.service': 'services',
  'api::showcase.showcase': 'showcases',
  'api::skill.skill': 'skills',
  'api::slider-item.slider-item': 'slider_items',
  'api::social-network.social-network': 'social_networks',
};

const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
const normalizeLocale = (locale) => locale || null;
const isPublished = (value) => value !== null && value !== undefined;

const sourceEntities = fs
  .readFileSync(ENTITIES_PATH, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const db = new Database(DATABASE_PATH);

try {
  const tables = db
    .prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map(({ name }) => name);
  const foreignReferences = new Map();
  const polymorphicTables = [];

  for (const table of tables) {
    const quotedTable = quoteIdentifier(table);
    const columns = db
      .prepare(`pragma table_info(${quotedTable})`)
      .all()
      .map(({ name }) => name);

    if (columns.includes('related_id') && columns.includes('related_type')) {
      polymorphicTables.push(table);
    }

    for (const reference of db.prepare(`pragma foreign_key_list(${quotedTable})`).all()) {
      const references = foreignReferences.get(reference.table) || [];
      references.push({ table, column: reference.from });
      foreignReferences.set(reference.table, references);
    }
  }

  const remaps = [];

  for (const [uid, table] of Object.entries(CONTENT_TABLES)) {
    const localRows = db
      .prepare(
        `select id, document_id, locale, published_at from ${quoteIdentifier(table)}`
      )
      .all();
    const sourceRows = sourceEntities.filter((entity) => entity.type === uid);

    if (localRows.length !== sourceRows.length) {
      throw new Error(
        `${uid} row count mismatch: local=${localRows.length}, production=${sourceRows.length}`
      );
    }

    for (const source of sourceRows) {
      const matches = localRows.filter(
        (local) =>
          local.document_id === source.data.documentId &&
          normalizeLocale(local.locale) === normalizeLocale(source.data.locale) &&
          isPublished(local.published_at) === isPublished(source.data.publishedAt)
      );

      if (matches.length !== 1) {
        throw new Error(
          `Unable to uniquely match ${uid} source ID ${source.id}; matches=${matches.length}`
        );
      }

      remaps.push({ uid, table, from: matches[0].id, to: source.id });
    }
  }

  const applyReferences = (remap, from, to) => {
    for (const reference of foreignReferences.get(remap.table) || []) {
      db.prepare(
        `update ${quoteIdentifier(reference.table)} set ${quoteIdentifier(reference.column)} = ? where ${quoteIdentifier(reference.column)} = ?`
      ).run(to, from);
    }

    for (const table of polymorphicTables) {
      db.prepare(
        `update ${quoteIdentifier(table)} set related_id = ? where related_id = ? and related_type = ?`
      ).run(to, from, remap.uid);
    }
  };

  db.pragma('foreign_keys = OFF');
  const restoreIds = db.transaction(() => {
    for (const remap of remaps.filter(({ from, to }) => from !== to)) {
      const temporaryId = -remap.from;
      applyReferences(remap, remap.from, temporaryId);
      db.prepare(`update ${quoteIdentifier(remap.table)} set id = ? where id = ?`).run(
        temporaryId,
        remap.from
      );
    }

    for (const remap of remaps.filter(({ from, to }) => from !== to)) {
      const temporaryId = -remap.from;
      applyReferences(remap, temporaryId, remap.to);
      db.prepare(`update ${quoteIdentifier(remap.table)} set id = ? where id = ?`).run(
        remap.to,
        temporaryId
      );
    }

    for (const table of new Set(Object.values(CONTENT_TABLES))) {
      const maximumId = db
        .prepare(`select max(id) as maximumId from ${quoteIdentifier(table)}`)
        .get().maximumId;
      db.prepare('update sqlite_sequence set seq = ? where name = ?').run(maximumId, table);
    }
  });

  restoreIds();
  db.pragma('foreign_keys = ON');

  const violations = db.pragma('foreign_key_check');
  if (violations.length > 0) {
    throw new Error(`Foreign key violations after ID restore: ${JSON.stringify(violations)}`);
  }

  console.log(
    `RESTORED_IDS ${remaps.filter(({ from, to }) => from !== to).length}/${remaps.length}`
  );
} finally {
  db.close();
}
