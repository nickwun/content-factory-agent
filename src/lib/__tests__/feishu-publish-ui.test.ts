import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFeishuPublishPreviewChecks,
  createFeishuPublishSnapshot,
} from "../publish/feishu-publish-ui.ts";
import type { HistoryRecord } from "../types/history.ts";

const record: HistoryRecord = {
  id: "record-1",
  schemaVersion: 1,
  autoTitle: "跑步之后，脑子会慢慢亮起来",
  title: "跑步之后，脑子会慢慢亮起来",
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
      title: "跑步之后，脑子会慢慢亮起来",
      markdownBody: "## 小标题\n\n正文内容",
      coverImage: {
        status: "generated",
        imageUrl: "/api/generated-images/cover.jpg",
      },
      blocks: [{ id: "p1", type: "paragraph", text: "正文内容" }],
    },
  },
  workspace: {
    activePlatform: "wechat_article",
    platformOrder: ["wechat_article"],
    lastViewedAt: "2026-04-05T00:00:00.000Z",
  },
};

test("buildFeishuPublishPreviewChecks passes when wechat article markdown is ready", () => {
  const checks = buildFeishuPublishPreviewChecks(record);

  assert.equal(checks.ready, true);
  assert.equal(checks.items.every((item) => item.passed), true);
});

test("createFeishuPublishSnapshot keeps markdownBody and explicit cover image url", () => {
  const snapshot = createFeishuPublishSnapshot(record);

  assert.equal(snapshot.platform, "wechat_article");
  assert.equal(snapshot.title, "跑步之后，脑子会慢慢亮起来");
  assert.equal(snapshot.markdownBody, "## 小标题\n\n正文内容");
  assert.equal(snapshot.coverImageUrl, "/api/generated-images/cover.jpg");
});
