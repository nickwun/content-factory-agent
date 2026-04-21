import assert from "node:assert/strict";
import test from "node:test";

import { buildContentTraceSummary } from "../observability/trace-summary.ts";
import type { ExecutionEvent } from "../observability/types.ts";
import type { PublishResult } from "../publish/types.ts";
import type { HistoryRecord } from "../types/history.ts";

function createRecord(
  traceContext?: HistoryRecord["traceContext"],
): Pick<HistoryRecord, "id" | "traceContext"> {
  return {
    id: "record-1",
    ...(traceContext ? { traceContext } : {}),
  };
}

function createEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    id: overrides.id ?? "event-1",
    runId: overrides.runId ?? "generation-2026-04-15T09:00:00.000Z-seq-1",
    entityType: overrides.entityType ?? "history_record",
    entityId: overrides.entityId ?? "record-1",
    stage: overrides.stage ?? "draft_generated",
    status: overrides.status ?? "success",
    message: overrides.message ?? "初稿生成完成",
    createdAt: overrides.createdAt ?? "2026-04-15T09:00:00.000Z",
    ...(overrides.details ? { details: overrides.details } : {}),
  };
}

function createPublishResult(overrides: Partial<PublishResult> = {}): PublishResult {
  return {
    id: overrides.id ?? "publish-result-1",
    runId: overrides.runId ?? "publish-2026-04-15T10:00:00.000Z-seq-1",
    recordId: overrides.recordId ?? "record-1",
    destination: overrides.destination ?? "feishu_doc",
    status: overrides.status ?? "partial_success",
    message: overrides.message ?? "飞书文档已创建，正文已发布，头图未同步。",
    warningMessage: overrides.warningMessage ?? "文档已创建，正文已发布，头图未同步。",
    createdAt: overrides.createdAt ?? "2026-04-15T10:00:00.000Z",
    ...(overrides.resultUrl ? { resultUrl: overrides.resultUrl } : {}),
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  };
}

test("buildContentTraceSummary supports rewrite-task source and latest issue", () => {
  const summary = buildContentTraceSummary({
    record: createRecord({
      sourceKind: "rewrite_task",
      topicClusterId: "cluster-1",
      topicClusterTitle: "跑步训练：配速与恢复",
      rewriteTaskId: "task-1",
      representativeArticleIds: ["article-1", "article-2"],
      createdFromPlatform: "wechat_article",
    }),
    publishResults: [
      createPublishResult({
        resultUrl: "https://feishu.cn/docx/abc",
        metadata: {
          documentId: "abc",
          coverSyncStatus: "failed",
        },
      }),
    ],
    executionEvents: [
      createEvent(),
      createEvent({
        id: "event-2",
        stage: "finalization_completed",
        message: "成稿收束完成",
        createdAt: "2026-04-15T09:05:00.000Z",
      }),
      createEvent({
        id: "event-3",
        stage: "cover_generation_failed",
        status: "warning",
        message: "头图生成失败",
        createdAt: "2026-04-15T09:06:00.000Z",
      }),
    ],
  });

  assert.equal(summary.source.sourceKind, "rewrite_task");
  assert.equal(summary.source.topicClusterTitle, "跑步训练：配速与恢复");
  assert.equal(summary.source.representativeArticleCount, 2);
  assert.equal(summary.generation.draftStatus, "success");
  assert.equal(summary.generation.finalizationStatus, "success");
  assert.equal(summary.generation.coverStatus, "failed");
  assert.equal(summary.latestPublish?.destination, "feishu_doc");
  assert.equal(summary.latestPublish?.status, "partial_success");
  assert.equal(summary.latestIssue?.type, "warning");
  assert.equal(summary.latestIssue?.message, "头图生成失败");
});

test("buildContentTraceSummary distinguishes skipped, not executed, and unknown generation states", () => {
  const skippedSummary = buildContentTraceSummary({
    record: {
      id: "record-wechat-disabled",
      traceContext: {
        sourceKind: "direct_create",
      },
      generation: {
        generatorVersion: "v1",
        modelProvider: "openrouter",
        modelName: "openai/gpt-5-mini",
        generatedAt: "2026-04-15T09:00:00.000Z",
        wechatFinalizationEnabled: false,
        selectedPlatformsSnapshot: ["wechat_article"],
        promptSnapshotByPlatform: {},
      },
      selectedPlatforms: ["wechat_article"],
      content: {
        wechat_article: {
          platform: "wechat_article",
          title: "标题",
          markdownBody: "正文",
          blocks: [],
          coverImage: {
            status: "idle",
          },
        },
      },
    },
    publishResults: [],
    executionEvents: [],
  });

  const unknownSummary = buildContentTraceSummary({
    record: {
      id: "record-legacy",
      traceContext: {
        sourceKind: "direct_create",
      },
      generation: {
        generatorVersion: "v1",
        modelProvider: "openrouter",
        modelName: "openai/gpt-5-mini",
        generatedAt: "2026-04-15T09:00:00.000Z",
        selectedPlatformsSnapshot: ["wechat_article"],
        promptSnapshotByPlatform: {},
      },
      selectedPlatforms: ["wechat_article"],
      content: {},
    },
    publishResults: [],
    executionEvents: [],
  });

  const nonWechatSummary = buildContentTraceSummary({
    record: {
      id: "record-xhs",
      traceContext: {
        sourceKind: "direct_create",
      },
      generation: {
        generatorVersion: "v1",
        modelProvider: "openrouter",
        modelName: "openai/gpt-5-mini",
        generatedAt: "2026-04-15T09:00:00.000Z",
        selectedPlatformsSnapshot: ["xiaohongshu"],
        promptSnapshotByPlatform: {},
      },
      selectedPlatforms: ["xiaohongshu"],
      content: {},
    },
    publishResults: [],
    executionEvents: [],
  });

  assert.equal(skippedSummary.generation.draftStatus, "success");
  assert.equal(skippedSummary.generation.finalizationStatus, "skipped");
  assert.equal(skippedSummary.generation.coverStatus, "not_executed");
  assert.equal(unknownSummary.generation.finalizationStatus, "unknown");
  assert.equal(unknownSummary.generation.coverStatus, "unknown");
  assert.equal(nonWechatSummary.generation.finalizationStatus, "skipped");
  assert.equal(nonWechatSummary.generation.coverStatus, "skipped");
});

test("buildContentTraceSummary only keeps the latest publish result", () => {
  const summary = buildContentTraceSummary({
    record: createRecord({
      sourceKind: "direct_create",
      createdFromPlatform: "wechat_article",
    }),
    publishResults: [
      createPublishResult({
        id: "publish-result-1",
        destination: "wechat_article",
        status: "success",
        createdAt: "2026-04-15T10:00:00.000Z",
      }),
      createPublishResult({
        id: "publish-result-2",
        destination: "feishu_doc",
        status: "partial_success",
        createdAt: "2026-04-15T11:00:00.000Z",
        resultUrl: "https://feishu.cn/docx/latest",
      }),
    ],
    executionEvents: [],
  });

  assert.equal(summary.latestPublish?.destination, "feishu_doc");
  assert.equal(summary.latestPublish?.resultUrl, "https://feishu.cn/docx/latest");
});

test("buildContentTraceSummary falls back safely for old records without trace context", () => {
  const summary = buildContentTraceSummary({
    record: createRecord(),
    publishResults: [],
    executionEvents: [],
  });

  assert.equal(summary.source.sourceKind, "direct_create");
  assert.equal(summary.generation.draftStatus, "unknown");
  assert.equal(summary.generation.finalizationStatus, "unknown");
  assert.equal(summary.generation.coverStatus, "unknown");
  assert.equal(summary.latestPublish, undefined);
  assert.equal(summary.latestIssue, undefined);
});

test("buildContentTraceSummary supports external rewrite task source", () => {
  const summary = buildContentTraceSummary({
    record: createRecord({
      sourceKind: "external_rewrite_task",
      externalRewriteTaskId: "external-task-1",
      externalKeyword: "马拉松",
      representativeArticleIds: ["article-1", "article-2", "article-3"],
      externalArticleCount: 3,
      createdFromPlatform: "wechat_article",
    }),
    publishResults: [],
    executionEvents: [],
  });

  assert.equal(summary.source.sourceKind, "external_rewrite_task");
  assert.equal(summary.source.externalKeyword, "马拉松");
  assert.equal(summary.source.externalRewriteTaskId, "external-task-1");
  assert.equal(summary.source.representativeArticleCount, 3);
});
