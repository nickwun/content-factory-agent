import type Database from "better-sqlite3";

import type { PlatformType } from "../types/platform.ts";
import { getDefaultPromptTemplate } from "./prompt-settings-service.ts";
import type {
  PromptPresetCorpusFile,
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

const PROMPT_PRESET_COLUMNS =
  "id, platform, name, prompt_template, is_default, version, created_at, updated_at";

type LegacyPromptSetting = {
  platform: PlatformType;
  promptTemplate: string;
  version?: string;
};

type PromptPresetCorpusFileRow = {
  id: string;
  file_name: string;
  mime_type: PromptPresetCorpusFile["mimeType"];
  extracted_text: string;
  summary_json: string | null;
  created_at: string;
  updated_at: string;
};

export function createPromptPresetRepository(db: Database.Database) {
  return {
    list(platforms?: PlatformType[]) {
      const rows = platforms && platforms.length > 0
        ? db
            .prepare(
              `SELECT ${PROMPT_PRESET_COLUMNS}
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
              `SELECT ${PROMPT_PRESET_COLUMNS}
               FROM platform_prompt_presets
               ORDER BY CASE platform
                 WHEN 'wechat_article' THEN 1
                 WHEN 'xiaohongshu' THEN 2
                 WHEN 'twitter' THEN 3
                 WHEN 'video_script' THEN 4
               END, is_default DESC, updated_at DESC, name COLLATE NOCASE ASC`,
            )
            .all();

      return (rows as PromptPresetRow[]).map((row) => mapRow(db, row));
    },

    getById(id: string) {
      const row = db
        .prepare(
          `SELECT ${PROMPT_PRESET_COLUMNS}
           FROM platform_prompt_presets
           WHERE id = ?`,
        )
        .get(id) as PromptPresetRow | undefined;

      return row ? mapRow(db, row) : null;
    },

    getDefaultByPlatform(platform: PlatformType) {
      const row = db
        .prepare(
          `SELECT ${PROMPT_PRESET_COLUMNS}
           FROM platform_prompt_presets
           WHERE platform = ? AND is_default = 1`,
        )
        .get(platform) as PromptPresetRow | undefined;

      return row ? mapRow(db, row) : null;
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

    findByPlatformAndName(platform: PlatformType, name: string) {
      const row = db
        .prepare(
          `SELECT ${PROMPT_PRESET_COLUMNS}
           FROM platform_prompt_presets
           WHERE platform = ? AND name = ?`,
        )
        .get(platform, name) as PromptPresetRow | undefined;

      return row ? mapRow(db, row) : null;
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

    createCorpusFile(input: {
      id: string;
      fileName: string;
      mimeType: PromptPresetCorpusFile["mimeType"];
      extractedText: string;
      summary?: PromptPresetCorpusFile["summary"];
      createdAt: string;
      updatedAt: string;
    }) {
      db.prepare(
        `INSERT INTO rewrite_corpus_files (
          id, file_name, mime_type, extracted_text, summary_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.fileName,
        input.mimeType,
        input.extractedText,
        input.summary ? JSON.stringify(input.summary) : null,
        input.createdAt,
        input.updatedAt,
      );

      return this.getCorpusFileById(input.id);
    },

    getCorpusFileById(id: string) {
      const row = db
        .prepare(
          `SELECT id, file_name, mime_type, extracted_text, summary_json, created_at, updated_at
           FROM rewrite_corpus_files
           WHERE id = ?`,
        )
        .get(id) as PromptPresetCorpusFileRow | undefined;

      return row ? mapCorpusRow(row) : null;
    },

    bindCorpusFile(presetId: string, fileId: string, createdAt: string) {
      db.prepare(
        `INSERT OR IGNORE INTO prompt_preset_corpus_files (
          prompt_preset_id, corpus_file_id, created_at
        ) VALUES (?, ?, ?)`,
      ).run(presetId, fileId, createdAt);
    },

    listCorpusFileIdsByPreset(presetId: string) {
      const rows = db
        .prepare(
          `SELECT corpus_file_id
           FROM prompt_preset_corpus_files
           WHERE prompt_preset_id = ?
           ORDER BY created_at ASC, rowid ASC`,
        )
        .all(presetId) as Array<{ corpus_file_id: string }>;

      return rows.map((row) => row.corpus_file_id);
    },

    listCorpusFilesByPreset(presetId: string) {
      const rows = db
        .prepare(
          `SELECT f.id, f.file_name, f.mime_type, f.extracted_text, f.summary_json, f.created_at, f.updated_at
           FROM prompt_preset_corpus_files b
           INNER JOIN rewrite_corpus_files f ON f.id = b.corpus_file_id
           WHERE b.prompt_preset_id = ?
           ORDER BY b.created_at ASC, b.rowid ASC`,
        )
        .all(presetId) as PromptPresetCorpusFileRow[];

      return rows.map((row) => mapCorpusRow(row));
    },

    unbindCorpusFile(presetId: string, fileId: string) {
      return db
        .prepare(
          `DELETE FROM prompt_preset_corpus_files
           WHERE prompt_preset_id = ? AND corpus_file_id = ?`,
        )
        .run(presetId, fileId).changes;
    },

    countPresetsByCorpusFile(fileId: string) {
      const row = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM prompt_preset_corpus_files
           WHERE corpus_file_id = ?`,
        )
        .get(fileId) as { count: number };

      return row.count;
    },

    deleteCorpusFile(fileId: string) {
      return db
        .prepare(`DELETE FROM rewrite_corpus_files WHERE id = ?`)
        .run(fileId).changes;
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

  db.prepare(
    `CREATE TABLE IF NOT EXISTS rewrite_corpus_files (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      extracted_text TEXT NOT NULL,
      summary_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS prompt_preset_corpus_files (
      prompt_preset_id TEXT NOT NULL,
      corpus_file_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (prompt_preset_id, corpus_file_id),
      FOREIGN KEY (prompt_preset_id) REFERENCES platform_prompt_presets(id) ON DELETE CASCADE,
      FOREIGN KEY (corpus_file_id) REFERENCES rewrite_corpus_files(id) ON DELETE CASCADE
    )`,
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

export function cleanupLegacyRewriteProfileTables(db: Database.Database) {
  db.prepare(`DROP TABLE IF EXISTS rewrite_profile_corpus_files`).run();
  db.prepare(`DROP TABLE IF EXISTS rewrite_profiles`).run();
}

function mapRow(db: Database.Database, row: PromptPresetRow): PlatformPromptSetting {
  const repository = createPromptPresetRepository(db);
  const corpusFileIds = repository.listCorpusFileIdsByPreset(row.id);
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    promptTemplate: row.prompt_template,
    defaultTemplate: getDefaultPromptTemplate(row.platform),
    isDefault: row.is_default === 1,
    corpusFileIds,
    corpusFiles: repository.listCorpusFilesByPreset(row.id),
    hasCorpus: corpusFileIds.length > 0,
    version: row.version ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCorpusRow(row: PromptPresetCorpusFileRow): PromptPresetCorpusFile {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    extractedText: row.extracted_text,
    summary: row.summary_json
      ? (JSON.parse(row.summary_json) as PromptPresetCorpusFile["summary"])
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
