import type Database from "better-sqlite3";

import type { PlatformType } from "../types/platform.ts";
import { getDefaultPromptTemplate } from "./prompt-settings-service.ts";
import type {
  PlatformPromptPresetGroup,
  PlatformPromptSetting,
  PromptPresetIdByPlatform,
} from "./prompt-settings-types.ts";

type PromptPresetRow = {
  id: string;
  platform: PlatformType;
  name: string;
  prompt_template: string;
  is_default: number;
  version: string | null;
  created_at: string;
  updated_at: string;
};

type LegacyPromptSetting = {
  platform: PlatformType;
  promptTemplate: string;
  version?: string;
};

export function createPromptPresetRepository(db: Database.Database) {
  return {
    list(platforms?: PlatformType[]) {
      const rows = platforms && platforms.length > 0
        ? db
            .prepare(
              `SELECT id, platform, name, prompt_template, is_default, version, created_at, updated_at
               FROM platform_prompt_presets
               WHERE platform IN (${platforms.map(() => "?").join(", ")})
               ORDER BY CASE platform
                 WHEN 'wechat_article' THEN 1
                 WHEN 'xiaohongshu' THEN 2
                 WHEN 'twitter' THEN 3
                 WHEN 'video_script' THEN 4
               END, is_default DESC, updated_at DESC, name COLLATE NOCASE ASC`,
            )
            .all(...platforms)
        : db
            .prepare(
              `SELECT id, platform, name, prompt_template, is_default, version, created_at, updated_at
               FROM platform_prompt_presets
               ORDER BY CASE platform
                 WHEN 'wechat_article' THEN 1
                 WHEN 'xiaohongshu' THEN 2
                 WHEN 'twitter' THEN 3
                 WHEN 'video_script' THEN 4
               END, is_default DESC, updated_at DESC, name COLLATE NOCASE ASC`,
            )
            .all();

      return (rows as PromptPresetRow[]).map((row) => mapRow(row));
    },

    getById(id: string) {
      const row = db
        .prepare(
          `SELECT id, platform, name, prompt_template, is_default, version, created_at, updated_at
           FROM platform_prompt_presets
           WHERE id = ?`,
        )
        .get(id) as PromptPresetRow | undefined;

      return row ? mapRow(row) : null;
    },

    getDefaultByPlatform(platform: PlatformType) {
      const row = db
        .prepare(
          `SELECT id, platform, name, prompt_template, is_default, version, created_at, updated_at
           FROM platform_prompt_presets
           WHERE platform = ? AND is_default = 1`,
        )
        .get(platform) as PromptPresetRow | undefined;

      return row ? mapRow(row) : null;
    },

    create(input: {
      id: string;
      platform: PlatformType;
      name: string;
      promptTemplate: string;
      isDefault: boolean;
      version?: string;
      createdAt: string;
      updatedAt: string;
    }) {
      db.prepare(
        `INSERT INTO platform_prompt_presets (
          id,
          platform,
          name,
          prompt_template,
          is_default,
          version,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.platform,
        input.name,
        input.promptTemplate,
        input.isDefault ? 1 : 0,
        input.version ?? null,
        input.createdAt,
        input.updatedAt,
      );

      return this.getById(input.id);
    },

    update(id: string, input: { name?: string; promptTemplate?: string; updatedAt: string }) {
      const current = this.getById(id);

      if (!current) {
        return null;
      }

      db.prepare(
        `UPDATE platform_prompt_presets
         SET name = ?, prompt_template = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        input.name ?? current.name,
        input.promptTemplate ?? current.promptTemplate,
        input.updatedAt,
        id,
      );

      return this.getById(id);
    },

    delete(id: string) {
      return db
        .prepare(`DELETE FROM platform_prompt_presets WHERE id = ?`)
        .run(id).changes;
    },

    countByPlatform(platform: PlatformType) {
      const row = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM platform_prompt_presets
           WHERE platform = ?`,
        )
        .get(platform) as { count: number };

      return row.count;
    },

    setDefault(id: string, platform: PlatformType, updatedAt: string) {
      const transaction = db.transaction(() => {
        db.prepare(
          `UPDATE platform_prompt_presets
           SET is_default = 0, updated_at = ?
           WHERE platform = ?`,
        ).run(updatedAt, platform);

        db.prepare(
          `UPDATE platform_prompt_presets
           SET is_default = 1, updated_at = ?
           WHERE id = ?`,
        ).run(updatedAt, id);
      });

      transaction();
      return this.getById(id);
    },

    listGroups(platforms?: PlatformType[]): PlatformPromptPresetGroup[] {
      const presets = this.list(platforms);
      const platformList = platforms ?? [
        "wechat_article",
        "xiaohongshu",
        "twitter",
        "video_script",
      ];

      return platformList.map((platform) => ({
        platform,
        presets: presets.filter((preset) => preset.platform === platform),
      }));
    },

    resolveSelected(
      platforms: PlatformType[],
      selectedPresetIds: PromptPresetIdByPlatform = {},
    ) {
      return platforms.map((platform) => {
        const selectedPresetId = selectedPresetIds[platform];
        if (selectedPresetId) {
          const selectedPreset = this.getById(selectedPresetId);
          if (!selectedPreset || selectedPreset.platform !== platform) {
            return null;
          }
          return selectedPreset;
        }

        return this.getDefaultByPlatform(platform);
      });
    },
  };
}

export function ensurePromptPresetsTable(
  db: Database.Database,
  legacySettings: LegacyPromptSetting[],
) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS platform_prompt_presets (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt_template TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_presets_platform_name
     ON platform_prompt_presets(platform, name)`,
  ).run();

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_presets_platform_default
     ON platform_prompt_presets(platform)
     WHERE is_default = 1`,
  ).run();

  const rowCount = db
    .prepare(`SELECT COUNT(*) as count FROM platform_prompt_presets`)
    .get() as { count: number };

  if (rowCount.count > 0) {
    return;
  }

  const insert = db.prepare(
    `INSERT INTO platform_prompt_presets (
      id,
      platform,
      name,
      prompt_template,
      is_default,
      version,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = new Date().toISOString();

  for (const setting of legacySettings) {
    insert.run(
      `prompt-preset-${setting.platform}-default`,
      setting.platform,
      "默认",
      setting.promptTemplate,
      1,
      setting.version ?? null,
      now,
      now,
    );
  }
}

function mapRow(row: PromptPresetRow): PlatformPromptSetting {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    promptTemplate: row.prompt_template,
    defaultTemplate: getDefaultPromptTemplate(row.platform),
    isDefault: row.is_default === 1,
    version: row.version ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
