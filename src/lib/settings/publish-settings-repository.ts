import type Database from "better-sqlite3";

import type {
  PublishCredentialKey,
  PublishCredentialSetting,
} from "./publish-settings-types.ts";

type PublishCredentialRow = {
  key: PublishCredentialKey;
  label: string;
  description: string;
  value: string;
  updated_at: string;
};

export function createPublishSettingsRepository(db: Database.Database) {
  return {
    list() {
      return db
        .prepare(
          `SELECT key, label, description, value, updated_at
           FROM integration_credentials
           ORDER BY CASE key
             WHEN 'wechat_publish_api_key' THEN 1
             WHEN 'wechat_publish_base_url' THEN 2
             WHEN 'xiaohongshu_publish_api_key' THEN 3
             WHEN 'xiaohongshu_publish_base_url' THEN 4
           END`,
        )
        .all()
        .map((row) => mapRow(row as PublishCredentialRow));
    },

    update(key: PublishCredentialKey, value: string) {
      const updatedAt = new Date().toISOString();

      db.prepare(
        `UPDATE integration_credentials
         SET value = ?, updated_at = ?
         WHERE key = ?`,
      ).run(value, updatedAt, key);

      return this.getByKey(key);
    },

    getByKey(key: PublishCredentialKey) {
      const row = db
        .prepare(
          `SELECT key, label, description, value, updated_at
           FROM integration_credentials
           WHERE key = ?`,
        )
        .get(key) as PublishCredentialRow | undefined;

      if (!row) {
        throw new Error(`Publish credential not found for ${key}`);
      }

      return mapRow(row);
    },
  };
}

export function ensurePublishSettingsTable(
  db: Database.Database,
  defaults: PublishCredentialSetting[],
) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS integration_credentials (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO integration_credentials (
      key,
      label,
      description,
      value,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();

  for (const setting of defaults) {
    insert.run(
      setting.key,
      setting.label,
      setting.description,
      setting.value,
      now,
      setting.updatedAt,
    );
  }
}

function mapRow(row: PublishCredentialRow): PublishCredentialSetting {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    value: row.value,
    updatedAt: row.updated_at,
  };
}
