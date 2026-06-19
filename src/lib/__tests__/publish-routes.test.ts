import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import {
  handleFeishuPublishRequest,
  handleWechatAccountsRequest,
  handleWechatPublishRequest,
  handleXiaohongshuPublishRequest,
} from "../publish/publish-route-handlers.ts";
import {
  createPublishSettingsRepository,
  ensurePublishSettingsTable,
} from "../settings/publish-settings-repository.ts";
import { getDefaultPublishCredentialSettings } from "../settings/publish-settings-server.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);

  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("wechat accounts route returns missing_credentials when sqlite settings are empty", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);

  const response = await handleWechatAccountsRequest();
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "missing_credentials");
});

test("wechat publish route returns missing_credentials when sqlite settings are empty", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);

  const response = await handleWechatPublishRequest();
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "missing_credentials");
});

test("wechat publish route returns validation_error when snapshot payload is invalid", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);
  ensurePublishSettingsTable(db, getDefaultPublishCredentialSettings());
  const repository = createPublishSettingsRepository(db);
  repository.update("wechat_publish_api_key", "wechat-key");
  repository.update("wechat_publish_base_url", "https://example.com");

  const response = await handleWechatPublishRequest({
    accountId: "account-1",
    publishType: "article",
    snapshot: {
      schemaVersion: "v1",
      platform: "wechat_article",
      recordId: "record-1",
      title: "",
      blocks: [],
    },
  });
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "validation_error");
});

test("xiaohongshu publish route returns missing_credentials when sqlite settings are empty", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);

  const response = await handleXiaohongshuPublishRequest();
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "missing_credentials");
});

test("xiaohongshu publish route returns missing_images when snapshot has no generated images", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);
  ensurePublishSettingsTable(db, getDefaultPublishCredentialSettings());
  const repository = createPublishSettingsRepository(db);
  repository.update("xiaohongshu_publish_api_key", "xhs-key");
  repository.update("xiaohongshu_publish_base_url", "https://example.com");

  const response = await handleXiaohongshuPublishRequest(
    {
      snapshot: {
        schemaVersion: "v1",
        platform: "xiaohongshu",
        recordId: "record-1",
        title: "标题",
        caption: "正文",
        tags: [],
        images: [],
      },
    },
    "https://app.example.com",
  );
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "missing_images");
});

test("feishu publish route returns missing_credentials when sqlite settings are empty", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);

  const response = await handleFeishuPublishRequest();
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, "missing_credentials");
});

test("feishu publish route returns validation_error when snapshot payload is invalid", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);
  ensurePublishSettingsTable(db, getDefaultPublishCredentialSettings());
  const repository = createPublishSettingsRepository(db);
  repository.update("feishu_app_id", "cli_app_id");
  repository.update("feishu_app_secret", "app-secret");

  const response = await handleFeishuPublishRequest({
    snapshot: {
      schemaVersion: "v1",
      platform: "wechat_article",
      recordId: "record-1",
      title: "",
      blocks: [],
    },
  });
  const payload = response.body as {
    error: { code: string; message: string };
  };

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "validation_error");
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-publish-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}
