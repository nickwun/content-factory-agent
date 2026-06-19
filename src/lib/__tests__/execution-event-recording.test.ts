import assert from "node:assert/strict";
import test from "node:test";

import {
  createCoverGenerationFailedEvent,
  createCoverGenerationSucceededEvent,
  createDraftGeneratedEvent,
  createFinalizationCompletedEvent,
  createPublishFailedEvent,
  createPublishPartiallySucceededEvent,
  createPublishStartedEvent,
  createPublishSucceededEvent,
} from "../observability/execution-event-store.ts";

test("generation event helpers keep details minimal and scoped to history_record", () => {
  const draftEvent = createDraftGeneratedEvent({
    runId: "generation-2026-04-15T13:00:00.000Z-seq-1",
    recordId: "record-1",
    createdAt: "2026-04-15T13:00:00.000Z",
    platform: "wechat_article",
    modelName: "openai/gpt-5-mini",
    randomId: () => "event-1",
  });
  const finalizationEvent = createFinalizationCompletedEvent({
    runId: "generation-2026-04-15T13:00:00.000Z-seq-1",
    recordId: "record-1",
    createdAt: "2026-04-15T13:00:01.000Z",
    platform: "wechat_article",
    modelName: "openai/gpt-5-mini",
    randomId: () => "event-2",
  });
  const coverFailedEvent = createCoverGenerationFailedEvent({
    runId: "generation-2026-04-15T13:00:00.000Z-seq-1",
    recordId: "record-1",
    createdAt: "2026-04-15T13:00:02.000Z",
    platform: "wechat_article",
    errorCode: "generation_timeout",
    message: "公众号头图生成失败",
    randomId: () => "event-3",
  });
  const coverSucceededEvent = createCoverGenerationSucceededEvent({
    runId: "generation-2026-04-15T13:00:00.000Z-seq-1",
    recordId: "record-1",
    createdAt: "2026-04-15T13:00:03.000Z",
    platform: "wechat_article",
    randomId: () => "event-4",
  });

  assert.deepEqual(draftEvent.details, {
    platform: "wechat_article",
    modelName: "openai/gpt-5-mini",
  });
  assert.equal(draftEvent.entityType, "history_record");
  assert.equal(draftEvent.stage, "draft_generated");
  assert.equal(finalizationEvent.stage, "finalization_completed");
  assert.deepEqual(coverFailedEvent.details, {
    platform: "wechat_article",
    errorCode: "generation_timeout",
  });
  assert.equal(coverFailedEvent.status, "error");
  assert.equal(coverSucceededEvent.stage, "cover_generation_succeeded");
});

test("publish event helpers keep publish_result as entity owner", () => {
  const started = createPublishStartedEvent({
    runId: "publish-2026-04-15T13:10:00.000Z-seq-2",
    publishResultId: "publish-result-1",
    destination: "feishu_doc",
    createdAt: "2026-04-15T13:10:00.000Z",
    randomId: () => "event-5",
  });
  const partial = createPublishPartiallySucceededEvent({
    runId: "publish-2026-04-15T13:10:00.000Z-seq-2",
    publishResultId: "publish-result-1",
    destination: "feishu_doc",
    createdAt: "2026-04-15T13:10:03.000Z",
    coverSyncStatus: "failed",
    message: "飞书文档部分成功",
    randomId: () => "event-6",
  });
  const failed = createPublishFailedEvent({
    runId: "publish-2026-04-15T13:20:00.000Z-seq-3",
    publishResultId: "publish-result-2",
    destination: "wechat_article",
    createdAt: "2026-04-15T13:20:02.000Z",
    errorCode: "validation_error",
    message: "发布失败",
    randomId: () => "event-7",
  });
  const succeeded = createPublishSucceededEvent({
    runId: "publish-2026-04-15T13:30:00.000Z-seq-4",
    publishResultId: "publish-result-3",
    destination: "xiaohongshu_note",
    createdAt: "2026-04-15T13:30:02.000Z",
    randomId: () => "event-8",
  });

  assert.equal(started.entityType, "publish_result");
  assert.deepEqual(started.details, { destination: "feishu_doc" });
  assert.equal(partial.stage, "publish_partially_succeeded");
  assert.deepEqual(partial.details, {
    destination: "feishu_doc",
    coverSyncStatus: "failed",
  });
  assert.equal(failed.stage, "publish_failed");
  assert.deepEqual(failed.details, {
    destination: "wechat_article",
    errorCode: "validation_error",
  });
  assert.equal(succeeded.stage, "publish_succeeded");
});
