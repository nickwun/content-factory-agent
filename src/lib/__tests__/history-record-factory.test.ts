import assert from "node:assert/strict";
import test from "node:test";

import { createHistoryRecord } from "../history/history-record-factory.ts";
import type { PlatformPromptSetting } from "../settings/prompt-settings-types.ts";

const promptSettings: PlatformPromptSetting[] = [
  {
    platform: "wechat_article",
    promptTemplate: "wechat prompt",
    defaultTemplate: "wechat default",
    updatedAt: "2026-04-15T08:00:00.000Z",
    version: "wechat-v1",
  },
];

const generationInfo = {
  generatorVersion: "generator-v1",
  modelProvider: "openrouter",
  modelName: "openai/gpt-5-mini",
  generatedPlatforms: ["wechat_article"] as const,
  mockPlatforms: [] as const,
};

test("createHistoryRecord defaults traceContext to direct_create", () => {
  const record = createHistoryRecord({
    userPrompt: "写一篇公众号文章",
    selectedPlatforms: ["wechat_article"],
    now: "2026-04-15T09:00:00.000Z",
    autoTitle: "跑步与长期训练",
    content: {
      wechat_article: {
        platform: "wechat_article",
        title: "跑步与长期训练",
        markdownBody: "正文",
        blocks: [{ id: "p-1", type: "paragraph", text: "正文" }],
      },
    },
    promptSettings,
    generationInfo,
  });

  assert.deepEqual(record.traceContext, {
    sourceKind: "direct_create",
    createdFromPlatform: "wechat_article",
  });
});

test("createHistoryRecord keeps rewrite-task traceContext when explicitly provided", () => {
  const record = createHistoryRecord({
    userPrompt: "请把这些素材重构成公众号长文",
    selectedPlatforms: ["wechat_article"],
    now: "2026-04-15T09:10:00.000Z",
    autoTitle: "跑步训练：配速与恢复",
    content: {
      wechat_article: {
        platform: "wechat_article",
        title: "跑步训练：配速与恢复",
        markdownBody: "正文",
        blocks: [{ id: "p-1", type: "paragraph", text: "正文" }],
      },
    },
    promptSettings,
    generationInfo,
    traceContext: {
      sourceKind: "rewrite_task",
      topicClusterId: "cluster-1",
      topicClusterTitle: "跑步训练：配速与恢复",
      rewriteTaskId: "task-1",
      representativeArticleIds: ["article-1", "article-2"],
      createdFromPlatform: "wechat_article",
    },
  });

  assert.deepEqual(record.traceContext, {
    sourceKind: "rewrite_task",
    topicClusterId: "cluster-1",
    topicClusterTitle: "跑步训练：配速与恢复",
    rewriteTaskId: "task-1",
    representativeArticleIds: ["article-1", "article-2"],
    createdFromPlatform: "wechat_article",
  });
});

test("createHistoryRecord keeps external-rewrite-task traceContext when explicitly provided", () => {
  const record = createHistoryRecord({
    userPrompt: "请基于这些外部爆款文章重构一篇公众号长文",
    selectedPlatforms: ["wechat_article"],
    now: "2026-04-15T09:20:00.000Z",
    autoTitle: "第一次全马前一周，真正需要准备的是什么",
    content: {
      wechat_article: {
        platform: "wechat_article",
        title: "第一次全马前一周，真正需要准备的是什么",
        markdownBody: "正文",
        blocks: [{ id: "p-1", type: "paragraph", text: "正文" }],
      },
    },
    promptSettings,
    generationInfo,
    traceContext: {
      sourceKind: "external_rewrite_task",
      externalRewriteTaskId: "external-task-1",
      externalKeyword: "马拉松",
      representativeArticleIds: ["article-1", "article-2", "article-3"],
      externalArticleCount: 3,
      createdFromPlatform: "wechat_article",
    },
  });

  assert.deepEqual(record.traceContext, {
    sourceKind: "external_rewrite_task",
    externalRewriteTaskId: "external-task-1",
    externalKeyword: "马拉松",
    representativeArticleIds: ["article-1", "article-2", "article-3"],
    externalArticleCount: 3,
    createdFromPlatform: "wechat_article",
  });
});
