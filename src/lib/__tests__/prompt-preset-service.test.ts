import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase } from "../db/sqlite.ts";
import {
  createPromptSettingsRepository as createLegacyPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "../settings/prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "../settings/prompt-preset-repository.ts";
import {
  createPromptPresetService,
  PromptPresetError,
} from "../settings/prompt-preset-service.ts";
import { getDefaultPromptTemplates } from "../settings/prompt-settings-service.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("prompt preset migration seeds one default preset per platform from legacy settings", () => {
  const db = createTempDb();
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createLegacyPromptSettingsRepository(db);
  legacyRepository.update("wechat_article", "迁移后的公众号提示词");

  ensurePromptPresetsTable(db, legacyRepository.list());

  const repository = createPromptPresetRepository(db);
  const service = createPromptPresetService(repository);
  const groups = service.listPromptPresetGroups();
  const wechatGroup = groups.find((group) => group.platform === "wechat_article");

  assert.ok(wechatGroup);
  assert.equal(wechatGroup.presets.length, 1);
  assert.equal(wechatGroup.presets[0]?.name, "默认");
  assert.equal(wechatGroup.presets[0]?.isDefault, true);
  assert.equal(wechatGroup.presets[0]?.promptTemplate, "迁移后的公众号提示词");
});

test("prompt preset service enforces unique names within a platform", () => {
  const service = createService();
  const created = service.createPromptPreset({
    platform: "wechat_article",
    name: "仿写增强版",
    promptTemplate: "更强调仿写展开",
  });

  assert.equal(created.name, "仿写增强版");

  assert.throws(
    () =>
      service.createPromptPreset({
        platform: "wechat_article",
        name: "仿写增强版",
        promptTemplate: "另一套内容",
      }),
    (error: unknown) =>
      error instanceof PromptPresetError && error.code === "duplicate_preset_name",
  );
});

test("setDefaultPromptPreset keeps exactly one default preset within a transaction", () => {
  const service = createService();
  const created = service.createPromptPreset({
    platform: "xiaohongshu",
    name: "经验感版",
    promptTemplate: "更强调经验分享",
  });

  const updated = service.setDefaultPromptPreset(created.id);
  const group = service
    .listPromptPresetGroups(["xiaohongshu"])
    .find((item) => item.platform === "xiaohongshu");

  assert.equal(updated.isDefault, true);
  assert.ok(group);
  assert.equal(group.presets.filter((preset) => preset.isDefault).length, 1);
  assert.equal(
    group.presets.find((preset) => preset.isDefault)?.id,
    created.id,
  );
});

test("deletePromptPreset rejects deleting the last preset in a platform", () => {
  const service = createService();
  const onlyPreset = service
    .listPromptPresetGroups(["twitter"])
    .find((group) => group.platform === "twitter")?.presets[0];

  assert.ok(onlyPreset);

  assert.throws(
    () => service.deletePromptPreset(onlyPreset.id),
    (error: unknown) =>
      error instanceof PromptPresetError && error.code === "last_preset_for_platform",
  );
});

test("resolvePromptSettings uses explicit preset ids, defaults otherwise, and rejects invalid ids", () => {
  const service = createService();
  const customWechat = service.createPromptPreset({
    platform: "wechat_article",
    name: "克制理性版",
    promptTemplate: "更克制、更理性",
  });

  const resolved = service.resolvePromptSettings(
    ["wechat_article", "xiaohongshu"],
    { wechat_article: customWechat.id },
  );

  assert.equal(
    resolved.find((setting) => setting.platform === "wechat_article")?.id,
    customWechat.id,
  );
  assert.equal(
    resolved.find((setting) => setting.platform === "xiaohongshu")?.isDefault,
    true,
  );

  assert.throws(
    () =>
      service.resolvePromptSettings(["wechat_article"], {
        wechat_article: "missing-preset-id",
      }),
    (error: unknown) =>
      error instanceof PromptPresetError && error.code === "invalid_preset_id",
  );
});

test("prompt preset service can attach, replace, and remove corpus for wechat presets", () => {
  const service = createService();
  const wechatPreset = service
    .listPromptPresetGroups(["wechat_article"])[0]
    ?.presets[0];

  assert.ok(wechatPreset?.id);

  const attached = service.attachPromptPresetCorpusFile(wechatPreset.id, {
    fileName: "runner-tone.txt",
    mimeType: "text/plain",
    extractedText: "这是主语料正文",
    summary: {
      tone: ["克制"],
      structure: ["结论前置"],
      lengthHint: "整体篇幅偏中等，适合完整展开一个问题。",
      reusablePhrases: ["先说结论"],
    },
  });

  assert.equal(attached.fileName, "runner-tone.txt");

  const replaced = service.replacePromptPresetCorpusFile(wechatPreset.id, attached.id, {
    fileName: "runner-tone-v2.txt",
    mimeType: "text/plain",
    extractedText: "新版主语料正文",
    summary: {
      tone: ["具体"],
      structure: ["问题起手"],
      lengthHint: "整体篇幅偏中等，适合完整展开一个问题。",
      reusablePhrases: ["先把问题说透"],
    },
  });

  assert.notEqual(replaced.id, attached.id);

  const listed = service.listPromptPresetCorpusFiles(wechatPreset.id);
  assert.deepEqual(listed.map((item) => item.id), [replaced.id]);

  service.deletePromptPresetCorpusFile(wechatPreset.id, replaced.id);
  assert.deepEqual(service.listPromptPresetCorpusFiles(wechatPreset.id), []);
});

test("prompt preset service rejects attaching corpus to unsupported platforms", () => {
  const service = createService();
  const xhsPreset = service.createPromptPreset({
    platform: "xiaohongshu",
    name: "小红书测试",
    promptTemplate: "小红书提示词",
  });

  assert.throws(
    () =>
      service.attachPromptPresetCorpusFile(xhsPreset.id, {
        fileName: "runner-tone.txt",
        mimeType: "text/plain",
        extractedText: "语料正文",
      }),
    (error: unknown) =>
      error instanceof PromptPresetError &&
      error.code === "unsupported_corpus_platform",
  );
});

function createService() {
  const db = createTempDb();
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createLegacyPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  const repository = createPromptPresetRepository(db);
  return createPromptPresetService(repository);
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-prompt-presets-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}
