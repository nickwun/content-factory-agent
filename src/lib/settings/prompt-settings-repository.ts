import type Database from "better-sqlite3";

import type { PlatformType } from "../types/platform.ts";
import type { PlatformPromptSetting } from "./prompt-settings-types.ts";

type PromptSettingRow = {
  platform: PlatformType;
  prompt_template: string;
  default_template: string;
  updated_at: string;
  version: string | null;
};

export function createPromptSettingsRepository(db: Database.Database) {
  return {
    list(platforms?: PlatformType[]) {
      if (platforms && platforms.length > 0) {
        const placeholders = platforms.map(() => "?").join(", ");
        const statement = db.prepare(
          `SELECT platform, prompt_template, default_template, updated_at, version
           FROM platform_prompt_settings
           WHERE platform IN (${placeholders})
           ORDER BY CASE platform
             WHEN 'wechat_article' THEN 1
             WHEN 'xiaohongshu' THEN 2
             WHEN 'twitter' THEN 3
             WHEN 'video_script' THEN 4
           END`,
        );

        return statement
          .all(...platforms)
          .map((row) => mapRow(row as PromptSettingRow));
      }

      return db
        .prepare(
          `SELECT platform, prompt_template, default_template, updated_at, version
           FROM platform_prompt_settings
           ORDER BY CASE platform
             WHEN 'wechat_article' THEN 1
             WHEN 'xiaohongshu' THEN 2
             WHEN 'twitter' THEN 3
             WHEN 'video_script' THEN 4
           END`,
        )
        .all()
        .map((row) => mapRow(row as PromptSettingRow));
    },

    update(platform: PlatformType, promptTemplate: string) {
      const updatedAt = new Date().toISOString();

      db.prepare(
        `UPDATE platform_prompt_settings
         SET prompt_template = ?, updated_at = ?
         WHERE platform = ?`,
      ).run(promptTemplate, updatedAt, platform);

      return this.getByPlatform(platform);
    },

    reset(platform: PlatformType) {
      const row = db
        .prepare(
          `SELECT default_template
           FROM platform_prompt_settings
           WHERE platform = ?`,
        )
        .get(platform) as { default_template: string } | undefined;

      if (!row) {
        throw new Error(`Prompt setting not found for ${platform}`);
      }

      return this.update(platform, row.default_template);
    },

    getByPlatform(platform: PlatformType) {
      const row = db
        .prepare(
          `SELECT platform, prompt_template, default_template, updated_at, version
           FROM platform_prompt_settings
           WHERE platform = ?`,
        )
        .get(platform) as PromptSettingRow | undefined;

      if (!row) {
        throw new Error(`Prompt setting not found for ${platform}`);
      }

      return mapRow(row);
    },
  };
}

export function ensurePromptSettingsTable(
  db: Database.Database,
  defaults: PlatformPromptSetting[],
) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS platform_prompt_settings (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL UNIQUE,
      prompt_template TEXT NOT NULL,
      default_template TEXT NOT NULL,
      version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO platform_prompt_settings (
      id,
      platform,
      prompt_template,
      default_template,
      version,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();

  for (const setting of defaults) {
    insert.run(
      `prompt-setting-${setting.platform}`,
      setting.platform,
      setting.promptTemplate,
      setting.defaultTemplate,
      setting.version ?? null,
      now,
      setting.updatedAt,
    );
  }
}

function mapRow(row: PromptSettingRow): PlatformPromptSetting {
  return {
    platform: row.platform,
    promptTemplate: row.prompt_template,
    defaultTemplate: row.default_template,
    updatedAt: row.updated_at,
    version: row.version ?? undefined,
  };
}
