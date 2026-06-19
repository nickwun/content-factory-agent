import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import {
  createPromptSettingsRepository as createLegacyPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "../settings/prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "../settings/prompt-preset-repository.ts";
import { getDefaultPromptTemplates } from "../settings/prompt-settings-service.ts";
import { listPromptPresetGroups } from "../settings/prompt-settings-server.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("prompt settings server cleans old rewrite profile tables without removing preset corpus", () => {
  const db = createTempDb();
  const promptRepository = createPromptPresetRepository(db);
  const now = new Date().toISOString();

  const preset = promptRepository.create({
    id: "preset-existing",
    platform: "wechat_article",
    name: "跑步长文",
    promptTemplate: "现有 preset prompt",
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  });

  assert.ok(preset?.id);

  const corpus = promptRepository.createCorpusFile({
    id: "preset-corpus-1",
    fileName: "preset.txt",
    mimeType: "text/plain",
    extractedText: "当前 preset 语料正文",
    summary: {
      tone: ["克制"],
      structure: ["问题起手"],
      lengthHint: "整体篇幅偏中等。",
      reusablePhrases: ["先说结论"],
    },
    createdAt: now,
    updatedAt: now,
  });

  assert.ok(corpus?.id);
  promptRepository.bindCorpusFile(preset.id, corpus.id, now);

  createLegacyRewriteProfileTables(db);
  assert.equal(tableExists(db, "rewrite_profiles"), true);
  assert.equal(tableExists(db, "rewrite_profile_corpus_files"), true);
  assert.equal(tableExists(db, "rewrite_corpus_files"), true);

  const groups = listPromptPresetGroups(["wechat_article"]);
  const presets = groups[0]?.presets ?? [];
  const existing = presets.find((item) => item.id === "preset-existing");

  assert.ok(existing);
  assert.equal(existing.hasCorpus, true);
  assert.deepEqual(existing.corpusFileIds, ["preset-corpus-1"]);
  assert.equal(tableExists(db, "rewrite_profiles"), false);
  assert.equal(tableExists(db, "rewrite_profile_corpus_files"), false);
  assert.equal(tableExists(db, "rewrite_corpus_files"), true);
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-prompt-settings-server-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  const db = openSqliteDatabase(filename);
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createLegacyPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  setAppDatabaseForTesting(db);
  return db;
}

function createLegacyRewriteProfileTables(db: ReturnType<typeof openSqliteDatabase>) {
  db.prepare(
    `CREATE TABLE rewrite_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE rewrite_profile_corpus_files (
      profile_id TEXT NOT NULL,
      file_id TEXT NOT NULL
    )`,
  ).run();
}

function tableExists(db: ReturnType<typeof openSqliteDatabase>, tableName: string) {
  const row = db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = ?`,
    )
    .get(tableName) as { name: string } | undefined;

  return Boolean(row);
}
