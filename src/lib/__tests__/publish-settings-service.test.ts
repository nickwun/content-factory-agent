import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import { openSqliteDatabase } from "../db/sqlite.ts";
import {
  createPublishSettingsRepository,
  ensurePublishSettingsTable,
} from "../settings/publish-settings-repository.ts";
import {
  createPublishSettingsService,
  getDefaultPublishCredentialSettings,
} from "../settings/publish-settings-server.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("publish settings service lists all credential keys and updates a single value", () => {
  const db = createTempDb();
  ensurePublishSettingsTable(db, getDefaultPublishCredentialSettings());
  const repository = createPublishSettingsRepository(db);
  const service = createPublishSettingsService(repository);

  const allSettings = service.listPublishSettings();
  assert.deepEqual(
    allSettings.map((setting) => setting.key),
    [
      "wechat_publish_api_key",
      "wechat_publish_base_url",
      "xiaohongshu_publish_api_key",
      "xiaohongshu_publish_base_url",
      "feishu_app_id",
      "feishu_app_secret",
    ],
  );

  const updated = service.updatePublishSetting(
    "wechat_publish_api_key",
    "test-wechat-key",
  );
  assert.equal(updated.value, "test-wechat-key");

  const nextSettings = service.listPublishSettings();
  assert.equal(
    nextSettings.find((setting) => setting.key === "wechat_publish_api_key")
      ?.value,
    "test-wechat-key",
  );
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-publish-settings-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}
