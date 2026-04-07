import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import {
  createPublishSettingsRepository,
  ensurePublishSettingsTable,
} from "../settings/publish-settings-repository.ts";
import { getDefaultPublishCredentialSettings } from "../settings/publish-settings-server.ts";
import {
  buildWechatAccountsCacheKey,
  parseWechatPublishRequestPayload,
} from "../publish/wechat-publish-service.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);

  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("parseWechatPublishRequestPayload validates article publish request shape", () => {
  const parsed = parseWechatPublishRequestPayload({
    accountId: "account-1",
    publishType: "article",
    snapshot: {
      schemaVersion: "v1",
      platform: "wechat_article",
      recordId: "record-1",
      title: "高效工作的 5 个方法",
      blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
    },
  });

  assert.equal(parsed.publishType, "article");
  assert.equal(parsed.snapshot.platform, "wechat_article");
  assert.equal(parsed.snapshot.blocks.length, 1);
});

test("parseWechatPublishRequestPayload validates xiaolvshu publish request shape", () => {
  const parsed = parseWechatPublishRequestPayload({
    accountId: "account-1",
    publishType: "xiaolvshu",
    snapshot: {
      schemaVersion: "v1",
      platform: "wechat_article",
      recordId: "record-1",
      title: "公众号标题",
      blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
      relatedXiaohongshu: {
        title: "小绿书标题",
        caption: "一段更适合图文的文案",
        tags: ["效率", "桌面整理"],
        imageUrls: ["https://example.com/cover.jpg"],
      },
    },
  });

  assert.equal(parsed.publishType, "xiaolvshu");
  assert.equal(parsed.snapshot.relatedXiaohongshu?.imageUrls.length, 1);
});

test("parseWechatPublishRequestPayload rejects invalid snapshot payload", () => {
  assert.throws(() => {
    parseWechatPublishRequestPayload({
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
  }, (error: unknown) => {
    assert.equal(error instanceof Error, true);
    assert.equal((error as { code?: string }).code, "validation_error");
    return true;
  });
});

test("parseWechatPublishRequestPayload rejects xiaolvshu when related xiaohongshu assets are missing", () => {
  assert.throws(() => {
    parseWechatPublishRequestPayload({
      accountId: "account-1",
      publishType: "xiaolvshu",
      snapshot: {
        schemaVersion: "v1",
        platform: "wechat_article",
        recordId: "record-1",
        title: "公众号标题",
        blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
      },
    });
  }, (error: unknown) => {
    assert.equal(error instanceof Error, true);
    assert.equal((error as { code?: string }).code, "missing_required_asset");
    return true;
  });
});

test("buildWechatAccountsCacheKey keys short cache by base url and key", () => {
  const cacheKey = buildWechatAccountsCacheKey({
    apiKey: "wechat-key",
    baseUrl: "https://example.com",
  });

  assert.equal(typeof cacheKey, "string");
  assert.match(cacheKey, /^wechat-accounts:/);
});

test("publish credential repository can seed usable wechat values for service tests", () => {
  const db = createTempDb();
  ensurePublishSettingsTable(db, getDefaultPublishCredentialSettings());
  const repository = createPublishSettingsRepository(db);
  repository.update("wechat_publish_api_key", "wechat-key");
  repository.update("wechat_publish_base_url", "https://example.com");

  const settings = repository.list();

  assert.equal(
    settings.find((setting) => setting.key === "wechat_publish_api_key")?.value,
    "wechat-key",
  );
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-wechat-publish-service-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}
