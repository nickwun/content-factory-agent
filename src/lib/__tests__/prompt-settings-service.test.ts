import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "../settings/prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "../settings/prompt-preset-repository.ts";
import {
  createPromptSettingsService,
  getDefaultPromptTemplates,
} from "../settings/prompt-settings-service.ts";
import { openSqliteDatabase } from "../db/sqlite.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("prompt settings service lists all settings and filters selected platforms", () => {
  const db = createTempDb();
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  const repository = createPromptPresetRepository(db);
  const service = createPromptSettingsService(repository);

  const allSettings = service.listPromptSettings();
  assert.equal(allSettings.length, 4);

  const selected = service.listPromptSettings(["twitter", "video_script"]);
  assert.deepEqual(
    selected.map((setting) => setting.platform),
    ["twitter", "video_script"],
  );
});

test("prompt settings service updates and resets a single platform", () => {
  const db = createTempDb();
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  const repository = createPromptPresetRepository(db);
  const service = createPromptSettingsService(repository);

  const updated = service.updatePromptSetting("twitter", "new twitter prompt");
  assert.equal(updated.promptTemplate, "new twitter prompt");

  const reset = service.resetPromptSetting("twitter");
  assert.equal(reset.promptTemplate, reset.defaultTemplate);
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-prompt-settings-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}
