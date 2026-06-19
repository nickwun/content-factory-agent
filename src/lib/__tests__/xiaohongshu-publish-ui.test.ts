import assert from "node:assert/strict";
import test from "node:test";

import type { HistoryRecord } from "../types/history.ts";
import {
  buildXiaohongshuPublishPreviewChecks,
  createXiaohongshuPublishSnapshot,
} from "../publish/xiaohongshu-publish-ui.ts";

const record: HistoryRecord = {
  id: "record-1",
  schemaVersion: 1,
  autoTitle: "小红书标题",
  title: "小红书标题",
  isCustomTitle: false,
  userPrompt: "写一篇小红书",
  selectedPlatforms: ["xiaohongshu"],
  createdAt: "2026-04-05T10:00:00.000Z",
  updatedAt: "2026-04-05T10:00:00.000Z",
  generation: {
    generatorVersion: "v1",
    modelProvider: "openrouter",
    modelName: "openai/gpt-5-nano",
    generatedAt: "2026-04-05T10:00:00.000Z",
    selectedPlatformsSnapshot: ["xiaohongshu"],
    promptSnapshotByPlatform: {},
  },
  content: {
    xiaohongshu: {
      platform: "xiaohongshu",
      title: "小红书标题",
      caption: "正文",
      tags: ["效率"],
      imageSuggestions: [
        {
          id: "img-1",
          index: 1,
          title: "封面",
          description: "封面图",
          status: "generated",
          imageUrl: "/api/generated-images/asset-1",
        },
        {
          id: "img-2",
          index: 2,
          title: "正文图",
          description: "正文图",
          status: "generated",
          imageUrl: "/api/generated-images/asset-2",
        },
      ],
    },
  },
  workspace: {
    activePlatform: "xiaohongshu",
    platformOrder: ["xiaohongshu"],
    lastViewedAt: "2026-04-05T10:00:00.000Z",
  },
};

test("buildXiaohongshuPublishPreviewChecks passes when note has content and generated images", () => {
  const preview = buildXiaohongshuPublishPreviewChecks(record);
  assert.equal(preview.ready, true);
});

test("createXiaohongshuPublishSnapshot marks first generated image as cover", () => {
  const snapshot = createXiaohongshuPublishSnapshot(record);
  assert.equal(snapshot.images.length, 2);
  assert.equal(snapshot.images[0]?.isCover, true);
  assert.equal(snapshot.images[1]?.isCover, false);
});
