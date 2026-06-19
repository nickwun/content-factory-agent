import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMeaningfulVideoScript,
  extractVideoScriptJsonPayload,
  normalizeVideoScriptOutput,
} from "../generation/video-script-output.ts";

test("normalizeVideoScriptOutput normalizes title duration and scenes into bounded structured content", () => {
  const content = normalizeVideoScriptOutput({
    title: "  3 个提高效率的方法  ",
    duration: "",
    scenes: [
      {
        shot: "\n镜头一：桌面凌乱。\n\n",
        voiceover: "  你是不是也经常忙了一天，却说不清推进了什么？  ",
      },
      {
        shot: "镜头二：开始整理任务清单。\n\n\n切到番茄钟。",
        voiceover:
          "先别急着更努力，真正有效的第一步，是先判断什么最值得做。\n\n然后再进入深度工作。",
      },
    ],
  });

  assert.equal(content.platform, "video_script");
  assert.equal(content.title, "3 个提高效率的方法");
  assert.equal(content.duration, "60-90 秒");
  assert.equal(content.scenes.length, 3);
  assert.deepEqual(
    content.scenes.map((scene) => scene.index),
    [1, 2, 3],
  );
  assert.equal(content.scenes[0].shot, "镜头一：桌面凌乱。");
  assert.equal(
    content.scenes[1].voiceover,
    "先别急着更努力，真正有效的第一步，是先判断什么最值得做。\n然后再进入深度工作。",
  );
});

test("normalizeVideoScriptOutput limits scene count to 8 and truncates overly long text", () => {
  const longLine = "很长的镜头描述".repeat(40);
  const scenes = Array.from({ length: 10 }, (_, index) => ({
    shot: `${index + 1}-${longLine}`,
    voiceover: `${index + 1}-${longLine}`,
  }));

  const content = normalizeVideoScriptOutput({
    title: "脚本",
    duration: "1 分钟左右",
    scenes,
  });

  assert.equal(content.scenes.length, 8);
  assert.match(content.scenes[0].shot, /…$/);
  assert.match(content.scenes[0].voiceover, /…$/);
  assert.equal(content.duration, "1 分钟左右");
});

test("assertMeaningfulVideoScript rejects fully placeholder content", () => {
  const content = normalizeVideoScriptOutput({
    title: "",
    duration: "",
    scenes: [],
  });

  assert.throws(
    () => assertMeaningfulVideoScript(content),
    /meaningful content/i,
  );
});

test("assertMeaningfulVideoScript accepts content with at least one real scene", () => {
  const content = normalizeVideoScriptOutput({
    title: "",
    duration: "",
    scenes: [
      {
        shot: "主持人站在镜头前开场",
        voiceover: "",
      },
    ],
  });

  assert.doesNotThrow(() => assertMeaningfulVideoScript(content));
});

test("extractVideoScriptJsonPayload reads fenced json payloads", () => {
  const parsed = extractVideoScriptJsonPayload(
    [
      "```json",
      '{"title":"测试脚本","duration":"60-90 秒","scenes":[{"shot":"镜头","voiceover":"旁白"}]}',
      "```",
    ].join("\n"),
  );

  assert.equal(parsed.title, "测试脚本");
});
