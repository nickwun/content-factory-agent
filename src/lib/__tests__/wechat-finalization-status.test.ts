import assert from "node:assert/strict";
import test from "node:test";

import { resolveWechatFinalizationStatus } from "../workspace/wechat-finalization-status.ts";

test("resolveWechatFinalizationStatus returns null when wechat finalization was never tracked", () => {
  assert.equal(
    resolveWechatFinalizationStatus({
      generatorVersion: "v1",
      modelProvider: "openrouter",
      modelName: "model",
      generatedAt: "2026-04-09T12:00:00.000Z",
      selectedPlatformsSnapshot: ["wechat_article"],
      promptSnapshotByPlatform: {},
    }),
    null,
  );
});

test("resolveWechatFinalizationStatus returns enabled state, applied state, and target range", () => {
  assert.deepEqual(
    resolveWechatFinalizationStatus({
      generatorVersion: "v1",
      modelProvider: "openrouter",
      modelName: "model",
      generatedAt: "2026-04-09T12:00:00.000Z",
      wechatFinalizationEnabled: true,
      wechatFinalizationApplied: false,
      wechatFinalizationTargetMinWords: 1100,
      wechatFinalizationTargetMaxWords: 1200,
      selectedPlatformsSnapshot: ["wechat_article"],
      promptSnapshotByPlatform: {},
    }),
    {
      enabled: true,
      applied: false,
      targetRangeLabel: "1100-1200 字",
    },
  );
});
