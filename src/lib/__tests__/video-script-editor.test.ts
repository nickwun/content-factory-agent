import assert from "node:assert/strict";
import test from "node:test";

import {
  formatVideoScriptSceneLabel,
  getVideoScriptOverviewSummary,
} from "../workspace/video-script-editor.ts";

test("formatVideoScriptSceneLabel returns a chapter-like label", () => {
  assert.equal(formatVideoScriptSceneLabel(1), "SCENE 01");
  assert.equal(formatVideoScriptSceneLabel(9), "SCENE 09");
  assert.equal(formatVideoScriptSceneLabel(12), "SCENE 12");
});

test("getVideoScriptOverviewSummary keeps scene count and duration compact", () => {
  assert.equal(
    getVideoScriptOverviewSummary(6, "60-90 秒"),
    "6 个镜头 · 60-90 秒",
  );
});
