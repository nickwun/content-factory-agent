import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGenerationContext,
  type BuildGenerationContextInput,
} from "../generation/generation-context.ts";
import type { RewriteBrief } from "../rewrite/rewrite-brief-types.ts";

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
  assert.equal(context.rewriteSource, undefined);
  assert.equal(context.rewriteMode, "none");
  assert.equal(context.rewriteBrief, undefined);
  assert.equal(context.rewriteChunkCount, undefined);
});

test("buildGenerationContext carries rewriteSource when provided", () => {
  const input: BuildGenerationContextInput = {
    userPrompt: "请按更口语化的风格仿写",
    selectedPlatforms: ["wechat_article"],
    now: "2026-04-07T09:00:00.000Z",
    generatorVersion: "phase3-rewrite-v1",
    promptSettings: [],
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "sample.md",
      mimeType: "text/markdown",
      extractedText: "这是原文第一段\n\n这是原文第二段",
      charCount: 17,
    },
  };

  const context = buildGenerationContext(input);

  assert.deepEqual(context.rewriteSource, input.rewriteSource);
  assert.equal(context.rewriteMode, "short_source");
});

test("buildGenerationContext carries wechatFinalization when provided", () => {
  const input: BuildGenerationContextInput = {
    userPrompt: "请生成可直接发布的公众号文章",
    selectedPlatforms: ["wechat_article"],
    now: "2026-04-09T09:00:00.000Z",
    generatorVersion: "phase8-wechat-finalization-v1",
    promptSettings: [],
    wechatFinalization: {
      enabled: true,
      targetMinWords: 1100,
      targetMaxWords: 1300,
      oneSentencePerParagraph: true,
      keepSectionStructure: true,
    },
  };

  const context = buildGenerationContext(input);

  assert.deepEqual(context.wechatFinalization, input.wechatFinalization);
});

test("buildGenerationContext carries longform rewrite fields when provided", () => {
  const rewriteBrief: RewriteBrief = {
    version: "v1",
    sourceStats: {
      totalChars: 5200,
      totalChunks: 5,
      estimatedParagraphGroups: 14,
    },
    theme: "写作如何帮助中年人维持认知活力",
    coreClaims: ["写作能迫使大脑持续组织信息"],
    mustKeepPoints: ["稳定写作比偶尔输出更重要"],
    reusableFacts: ["每天记录三百字也能形成持续感"],
    toneProfile: {
      overallTone: "分析型、解释型",
      pacing: "层层推进、逐步展开",
      rhetoricalMoves: ["开场提出主题", "中段转折推进"],
      emotionalTemperature: "温和鼓励",
    },
    structureFlow: [
      {
        index: 0,
        role: "intro",
        summary: "先提出写作与延缓衰老之间的关系",
        keyPoints: ["写作让人持续整理信息"],
        transitionToNext: "转入第一层论证",
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

  const input: BuildGenerationContextInput = {
    userPrompt: "请仿写成更适合公众号发布的版本",
    selectedPlatforms: ["wechat_article"],
    now: "2026-04-07T09:30:00.000Z",
    generatorVersion: "phase4-longform-rewrite-v1",
    promptSettings: [],
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: "longform.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "这是原文第一段\n\n这是原文第二段",
      charCount: 17,
    },
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteChunkCount: 5,
  };

  const context = buildGenerationContext(input);

  assert.equal(context.rewriteMode, "long_source");
  assert.deepEqual(context.rewriteBrief, rewriteBrief);
  assert.equal(context.rewriteChunkCount, 5);
});
