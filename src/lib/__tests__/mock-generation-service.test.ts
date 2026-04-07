import test from "node:test";
import assert from "node:assert/strict";

import { buildGenerationContext } from "../generation/generation-context.ts";
import { generateMockDraft } from "../generation/mock-generation-service.ts";

test("generateMockDraft returns structured content for every selected platform", () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: [
      "wechat_article",
      "xiaohongshu",
      "twitter",
      "video_script",
    ],
    now: "2026-03-31T12:00:00.000Z",
    generatorVersion: "mock-v1",
    promptSettings: [
      {
        platform: "wechat_article",
        promptTemplate: "wechat prompt",
        defaultTemplate: "wechat default",
        updatedAt: "2026-03-31T11:00:00.000Z",
      },
      {
        platform: "xiaohongshu",
        promptTemplate: "xiaohongshu prompt",
        defaultTemplate: "xiaohongshu default",
        updatedAt: "2026-03-31T11:00:00.000Z",
      },
      {
        platform: "twitter",
        promptTemplate: "twitter prompt",
        defaultTemplate: "twitter default",
        updatedAt: "2026-03-31T11:00:00.000Z",
      },
      {
        platform: "video_script",
        promptTemplate: "video prompt",
        defaultTemplate: "video default",
        updatedAt: "2026-03-31T11:00:00.000Z",
      },
    ],
  });

  const draft = generateMockDraft(context);

  assert.equal(draft.autoTitle, "高效工作的 5 个底层逻辑");
  assert.ok(draft.content.wechat_article);
  assert.ok(draft.content.xiaohongshu);
  assert.ok(draft.content.twitter);
  assert.ok(draft.content.video_script);
  assert.equal(draft.content.xiaohongshu?.imageSuggestions.length, 9);
  assert.equal(draft.content.twitter?.mode, "thread");
  assert.equal(draft.content.twitter?.threadDraft.length, 10);
  assert.equal(draft.content.video_script?.scenes.length, 4);
});

test("generateMockDraft lightly reflects platform prompt settings in generated content", () => {
  const context = buildGenerationContext({
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: ["twitter", "xiaohongshu"],
    now: "2026-03-31T12:00:00.000Z",
    generatorVersion: "mock-v1",
    promptSettings: [
      {
        platform: "twitter",
        promptTemplate: "新的 Twitter 提示词：强调 thread 开头要更像观点钩子",
        defaultTemplate: "twitter default",
        updatedAt: "2026-03-31T11:00:00.000Z",
      },
      {
        platform: "xiaohongshu",
        promptTemplate: "新的小红书提示词：语气更像陪伴式经验分享",
        defaultTemplate: "xiaohongshu default",
        updatedAt: "2026-03-31T11:00:00.000Z",
      },
    ],
  });

  const draft = generateMockDraft(context);

  assert.match(draft.content.twitter?.threadDraft[0] ?? "", /观点钩子/);
  assert.match(draft.content.xiaohongshu?.caption ?? "", /陪伴式经验分享/);
});
