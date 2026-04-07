import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWechatPublishPreviewChecks,
  createWechatPublishSnapshot,
  getWechatPublishTypeAvailability,
} from "../publish/wechat-publish-ui.ts";
import type { HistoryRecord } from "../types/history.ts";

const record: HistoryRecord = {
  id: "record-1",
  schemaVersion: 1,
  autoTitle: "高效工作的 5 个方法",
  title: "高效工作的 5 个方法",
  isCustomTitle: false,
  userPrompt: "写一篇公众号文章",
  selectedPlatforms: ["wechat_article"],
  createdAt: "2026-04-05T00:00:00.000Z",
  updatedAt: "2026-04-05T00:00:00.000Z",
  generation: {
    generatorVersion: "v1",
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generatedAt: "2026-04-05T00:00:00.000Z",
    selectedPlatformsSnapshot: ["wechat_article"],
    promptSnapshotByPlatform: { wechat_article: "prompt" },
  },
  content: {
    wechat_article: {
      platform: "wechat_article",
      title: "高效工作的 5 个方法",
      blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
    },
  },
  workspace: {
    activePlatform: "wechat_article",
    platformOrder: ["wechat_article"],
    lastViewedAt: "2026-04-05T00:00:00.000Z",
  },
};

test("buildWechatPublishPreviewChecks passes when article content is ready", () => {
  const checks = buildWechatPublishPreviewChecks(record);

  assert.equal(checks.ready, true);
  assert.equal(checks.items.every((item) => item.passed), true);
});

test("createWechatPublishSnapshot builds minimal snapshot from active record", () => {
  const snapshot = createWechatPublishSnapshot(record);

  assert.equal(snapshot.platform, "wechat_article");
  assert.equal(snapshot.recordId, record.id);
  assert.equal(snapshot.blocks.length, 1);
});

test("getWechatPublishTypeAvailability reports why xiaolvshu is unavailable", () => {
  const availability = getWechatPublishTypeAvailability(record, {
    accountId: "gh_1",
    nickname: "测试号",
    status: "active",
    supportedPublishTypes: ["article"],
  });

  const xiaolvshu = availability.find((item) => item.value === "xiaolvshu");

  assert.equal(xiaolvshu?.enabled, false);
  assert.ok(xiaolvshu?.reasons.some((reason) => reason.includes("账号")));
});
