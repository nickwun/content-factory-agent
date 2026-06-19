import assert from "node:assert/strict";
import test from "node:test";

import { buildSelectedPromptPresetByPlatform } from "../settings/prompt-preset-selection.ts";

test("buildSelectedPromptPresetByPlatform uses explicit preset ids and falls back to defaults", () => {
  const result = buildSelectedPromptPresetByPlatform({
    selectedPlatforms: ["wechat_article", "xiaohongshu"],
    presetGroups: [
      {
        platform: "wechat_article",
        presets: [
          {
            id: "wechat-default",
            platform: "wechat_article",
            name: "默认",
            promptTemplate: "默认",
            defaultTemplate: "默认",
            isDefault: true,
            updatedAt: "2026-04-08T00:00:00.000Z",
          },
          {
            id: "wechat-custom",
            platform: "wechat_article",
            name: "仿写增强版",
            promptTemplate: "增强",
            defaultTemplate: "默认",
            isDefault: false,
            updatedAt: "2026-04-08T00:00:00.000Z",
          },
        ],
      },
      {
        platform: "xiaohongshu",
        presets: [
          {
            id: "xhs-default",
            platform: "xiaohongshu",
            name: "默认",
            promptTemplate: "默认",
            defaultTemplate: "默认",
            isDefault: true,
            updatedAt: "2026-04-08T00:00:00.000Z",
          },
        ],
      },
    ],
    selectedPresetIds: {
      wechat_article: "wechat-custom",
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.selectedPromptPresetByPlatform, {
      wechat_article: "wechat-custom",
      xiaohongshu: "xhs-default",
    });
  }
});

test("buildSelectedPromptPresetByPlatform rejects stale preset ids", () => {
  const result = buildSelectedPromptPresetByPlatform({
    selectedPlatforms: ["wechat_article"],
    presetGroups: [
      {
        platform: "wechat_article",
        presets: [
          {
            id: "wechat-default",
            platform: "wechat_article",
            name: "默认",
            promptTemplate: "默认",
            defaultTemplate: "默认",
            isDefault: true,
            updatedAt: "2026-04-08T00:00:00.000Z",
          },
        ],
      },
    ],
    selectedPresetIds: {
      wechat_article: "missing-id",
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errorMessage, /已失效/);
  }
});
