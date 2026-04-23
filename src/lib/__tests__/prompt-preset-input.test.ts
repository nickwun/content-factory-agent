import assert from "node:assert/strict";
import test from "node:test";

import {
  buildComposerProcessingUserPrompt,
  buildComposerRewriteUserPrompt,
} from "../rewrite/prompt-preset-input.ts";
import type { PlatformPromptSetting } from "../settings/prompt-settings-types.ts";

const rewriteSource = {
  kind: "pasted_text" as const,
  extractedText: "This is an English transcript about running and focus.",
  charCount: 52,
};

test("composer processing prompt keeps rewrite instructions for rewrite mode", () => {
  const prompt = buildComposerRewriteUserPrompt({
    selectedPromptSettings: [buildPromptSetting({ processingMode: "rewrite" })],
    rewriteSource,
  });

  assert.match(prompt, /直接开始仿写/);
  assert.doesNotMatch(prompt, /翻译并整理成自然中文文章/);
});

test("composer processing prompt uses translation-and-article instructions for translation mode", () => {
  const prompt = buildComposerProcessingUserPrompt({
    processingMode: "translate_to_zh_article",
    selectedPromptSettings: [
      buildPromptSetting({
        id: "translate-preset",
        processingMode: "translate_to_zh_article",
        name: "YouTube 翻译整理",
      }),
    ],
    rewriteSource,
  });

  assert.match(prompt, /翻译并整理成自然中文文章/);
  assert.match(prompt, /不要逐句直译成字幕稿/);
  assert.match(prompt, /合并口语重复、整理结构和段落/);
  assert.doesNotMatch(prompt, /直接开始仿写/);
});

function buildPromptSetting(
  overrides: Partial<PlatformPromptSetting> = {},
): PlatformPromptSetting {
  return {
    id: "preset-1",
    platform: "wechat_article",
    processingMode: "rewrite",
    name: "测试预设",
    promptTemplate: "遵循当前预设的文章规则。",
    defaultTemplate: "默认提示词",
    isDefault: true,
    updatedAt: "2026-04-22T00:00:00.000Z",
    ...overrides,
  };
}
