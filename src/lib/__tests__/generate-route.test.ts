import assert from "node:assert/strict";
import test from "node:test";

import {
  GenerateRequestValidationError,
  parseGenerateRequestPayload,
  prepareRewriteGeneration,
} from "../generation/generate-route.ts";
import { MAX_REWRITE_SOURCE_CHARS } from "../rewrite/rewrite-source.ts";

test("generate route parser keeps invalid request behavior unchanged when rewriteSource is absent", () => {
  assert.throws(
    () =>
      parseGenerateRequestPayload({
        userPrompt: "",
        selectedPlatforms: ["wechat_article"],
      }),
    (error: unknown) =>
      error instanceof GenerateRequestValidationError &&
      error.message === "userPrompt and selectedPlatforms are required",
  );
});

test("generate route parser rejects rewriteSource when extracted text becomes empty after cleaning", () => {
  assert.throws(
    () =>
      parseGenerateRequestPayload({
        userPrompt: "请仿写",
        selectedPlatforms: ["wechat_article"],
        rewriteSource: {
          kind: "pasted_text",
          extractedText: " \n\n\t ",
          charCount: 4,
        },
      }),
    (error: unknown) =>
      error instanceof GenerateRequestValidationError &&
      /正文为空/.test(error.message),
  );
});

test("generate route parser rejects rewriteSource that exceeds the configured max length", () => {
  assert.throws(
    () =>
      parseGenerateRequestPayload({
        userPrompt: "请仿写",
        selectedPlatforms: ["wechat_article"],
        rewriteSource: {
          kind: "pasted_text",
          extractedText: "A".repeat(MAX_REWRITE_SOURCE_CHARS + 1),
          charCount: MAX_REWRITE_SOURCE_CHARS + 1,
        },
      }),
    (error: unknown) =>
      error instanceof GenerateRequestValidationError &&
      /长度超过当前上限/.test(error.message),
  );
});

test("generate route parser returns rewriteSource unchanged when payload is valid", () => {
  const parsed = parseGenerateRequestPayload({
    userPrompt: "请按更口语化的语气仿写",
    selectedPlatforms: ["wechat_article", "twitter"],
    selectedPromptPresetByPlatform: {
      wechat_article: "preset-1",
    },
    wechatFinalization: {
      enabled: true,
      targetMinWords: 1100,
      targetMaxWords: 1300,
      oneSentencePerParagraph: true,
      keepSectionStructure: true,
    },
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "sample.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "原文第一段\n\n原文第二段",
      charCount: 20,
    },
  });

  assert.equal(parsed.userPrompt, "请按更口语化的语气仿写");
  assert.deepEqual(parsed.selectedPlatforms, ["wechat_article", "twitter"]);
  assert.deepEqual(parsed.selectedPromptPresetByPlatform, {
    wechat_article: "preset-1",
  });
  assert.deepEqual(parsed.wechatFinalization, {
    enabled: true,
    targetMinWords: 1100,
    targetMaxWords: 1300,
    oneSentencePerParagraph: true,
    keepSectionStructure: true,
  });
  assert.deepEqual(parsed.rewriteSource, {
    kind: "uploaded_file",
    sourceName: "sample.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extractedText: "原文第一段\n\n原文第二段",
    charCount: 20,
  });
});

test("generate route parser rejects invalid selectedPromptPresetByPlatform payloads", () => {
  assert.throws(
    () =>
      parseGenerateRequestPayload({
        userPrompt: "请生成",
        selectedPlatforms: ["wechat_article"],
        selectedPromptPresetByPlatform: {
          wechat_article: "",
        },
      }),
    (error: unknown) =>
      error instanceof GenerateRequestValidationError &&
      /selectedPromptPresetByPlatform\.wechat_article/.test(error.message),
  );
});

test("generate route parser rejects invalid wechatFinalization payloads", () => {
  assert.throws(
    () =>
      parseGenerateRequestPayload({
        userPrompt: "请生成",
        selectedPlatforms: ["wechat_article"],
        wechatFinalization: {
          enabled: true,
          targetMinWords: "1100",
        },
      }),
    (error: unknown) =>
      error instanceof GenerateRequestValidationError &&
      /wechatFinalization/.test(error.message),
  );
});

test("prepareRewriteGeneration keeps rewriteMode none when rewriteSource is absent", async () => {
  const prepared = await prepareRewriteGeneration(undefined);

  assert.equal(prepared.rewriteMode, "none");
  assert.equal(prepared.rewriteSource, undefined);
  assert.equal(prepared.rewriteBrief, undefined);
  assert.equal(prepared.rewriteChunkCount, undefined);
});

test("prepareRewriteGeneration keeps short rewriteSource on the legacy path", async () => {
  const rewriteSource = {
    kind: "pasted_text" as const,
    extractedText: "这是一篇比较短的原文。\n\n它只有两三个段落，不需要走长文链路。",
    charCount: 31,
  };

  let extractorCalled = false;
  const prepared = await prepareRewriteGeneration(rewriteSource, {
    extractRewriteBrief: async () => {
      extractorCalled = true;
      throw new Error("should not be called");
    },
  });

  assert.equal(prepared.rewriteMode, "short_source");
  assert.deepEqual(prepared.rewriteSource, rewriteSource);
  assert.equal(prepared.rewriteBrief, undefined);
  assert.equal(extractorCalled, false);
});

test("prepareRewriteGeneration upgrades long rewriteSource to long_source mode", async () => {
  const longText = [
    "标题：写作为什么会延缓衰老",
    "",
    "写作不是为了立刻出作品，而是为了让大脑保持组织信息的状态。",
    "",
    "一、写作为什么会延缓衰老",
    "",
    "第一，写作会迫使你不断回忆、筛选和重组信息。",
    "",
    "第二，写作会让语言、判断和记忆同步运转。",
    "",
    "接下来讨论稳定输出的重要性。",
    "",
    "二、稳定输出如何改变日常节奏",
    "",
    "当一个人每天都写一点，他会更容易发现自己在想什么。",
    "",
    "比如每天记录三百字，也足够形成持续感。",
    "",
    "最后，不要把写作理解成创作压力，更像是给大脑做长期训练。",
    "",
    "补充段落一。".repeat(1200),
  ].join("\n");

  let extractorCalled = false;
  const prepared = await prepareRewriteGeneration({
    kind: "uploaded_file",
    sourceName: "longform.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extractedText: longText,
    charCount: longText.length,
  }, {
    extractRewriteBrief: async () => {
      extractorCalled = true;
      return {
        version: "v1",
        sourceStats: {
          totalChars: longText.length,
          totalChunks: 3,
          estimatedParagraphGroups: 4,
        },
        theme: "写作为什么会延缓衰老",
        coreClaims: ["写作会迫使人持续组织信息"],
        mustKeepPoints: ["写作应被理解为长期训练"],
        reusableFacts: ["每天写一点也能形成稳定节奏"],
        toneProfile: {
          overallTone: "分析型、解释型",
          pacing: "层层推进、逐步展开",
          rhetoricalMoves: ["开场提出主题"],
          emotionalTemperature: "温和鼓励",
        },
        structureFlow: [
          {
            index: 0,
            role: "intro",
            summary: "先提出写作和认知训练的关系",
            keyPoints: ["写作会迫使人持续组织信息"],
            transitionToNext: "转入主体论证",
            emphasis: "high",
          },
        ],
        argumentCadence: {
          openingMove: "先提出主题与问题意识",
          progressionPattern: "intro -> body -> conclusion",
          evidenceStyle: "以解释结合例子推进",
          endingMove: "回收观点并给出收束",
        },
      };
    },
  });

  assert.equal(prepared.rewriteMode, "long_source");
  assert.ok(prepared.rewriteBrief);
  assert.ok((prepared.rewriteChunkCount ?? 0) > 1);
  assert.equal(prepared.usedLongformRewrite, true);
  assert.equal(extractorCalled, true);
});
