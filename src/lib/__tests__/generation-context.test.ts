import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerationContext,
  type BuildGenerationContextInput,
} from "../generation/generation-context.ts";

test("buildGenerationContext normalizes selected platform settings into snapshot-ready context", () => {
  const input: BuildGenerationContextInput = {
    userPrompt: "写一篇关于如何提高工作效率的内容",
    selectedPlatforms: ["wechat_article", "twitter"],
    now: "2026-03-31T12:00:00.000Z",
    generatorVersion: "mock-v1",
    promptSettings: [
      {
        platform: "wechat_article",
        promptTemplate: "wechat prompt",
        defaultTemplate: "wechat default",
        updatedAt: "2026-03-31T11:00:00.000Z",
        version: "wechat-v1",
      },
      {
        platform: "twitter",
        promptTemplate: "twitter prompt",
        defaultTemplate: "twitter default",
        updatedAt: "2026-03-31T11:30:00.000Z",
        version: "twitter-v2",
      },
    ],
  };

  const context = buildGenerationContext(input);

  assert.equal(context.userPrompt, input.userPrompt);
  assert.deepEqual(context.selectedPlatforms, ["wechat_article", "twitter"]);
  assert.equal(context.now, input.now);
  assert.equal(context.generatorVersion, "mock-v1");
  assert.equal(
    context.promptSettings.wechat_article?.promptTemplate,
    "wechat prompt",
  );
  assert.equal(context.promptSettings.twitter?.version, "twitter-v2");
});
