import assert from "node:assert/strict";
import test from "node:test";

import {
  createRecordCreatedEvent,
  createExecutionEventStore,
  createRunId,
} from "../observability/execution-event-store.ts";
import type { ExecutionEvent } from "../observability/types.ts";

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function createMemoryStorage(): MemoryStorage {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    id: overrides.id ?? "event-1",
    runId: overrides.runId ?? "generation-2026-04-15T00:00:00.000Z-seq-1",
    entityType: overrides.entityType ?? "history_record",
    entityId: overrides.entityId ?? "record-1",
    stage: overrides.stage ?? "draft_generated",
    status: overrides.status ?? "success",
    message: overrides.message ?? "初稿生成完成",
    createdAt: overrides.createdAt ?? "2026-04-15T00:00:00.000Z",
    ...(overrides.details ? { details: overrides.details } : {}),
  };
}

test("createRunId creates prefixed ids and never reuses record ids directly", () => {
  const generationRunId = createRunId("generation", {
    now: () => "2026-04-15T09:00:00.000Z",
    randomId: () => "seq-1",
  });
  const publishRunId = createRunId("publish", {
    now: () => "2026-04-15T09:05:00.000Z",
    randomId: () => "seq-2",
  });

  assert.equal(generationRunId, "generation-2026-04-15T09:00:00.000Z-seq-1");
  assert.equal(publishRunId, "publish-2026-04-15T09:05:00.000Z-seq-2");
  assert.notEqual(generationRunId, "record-1");
  assert.notEqual(publishRunId, "record-1");
});

test("execution event store appends events and reads them by record and run", async () => {
  const storage = createMemoryStorage();
  const store = createExecutionEventStore({ storage });
  const first = createEvent();
  const second = createEvent({
    id: "event-2",
    runId: "publish-2026-04-15T10:00:00.000Z-seq-3",
    entityType: "publish_result",
    entityId: "publish-1",
    stage: "publish_started",
    status: "info",
    message: "开始发布到飞书文档",
    createdAt: "2026-04-15T10:00:00.000Z",
  });

  await store.append(first);
  await store.append(second);

  assert.deepEqual((await store.list()).map((item) => item.id), ["event-2", "event-1"]);
  assert.deepEqual(
    (await store.listByEntity("history_record", "record-1")).map((item) => item.id),
    ["event-1"],
  );
  assert.deepEqual(
    (await store.listByRunId("publish-2026-04-15T10:00:00.000Z-seq-3")).map(
      (item) => item.id,
    ),
    ["event-2"],
  );
});

test("createRecordCreatedEvent builds a minimal history-record event payload", () => {
  const event = createRecordCreatedEvent({
    runId: "generation-2026-04-15T11:00:00.000Z-seq-4",
    recordId: "record-2",
    createdAt: "2026-04-15T11:00:00.000Z",
    platform: "wechat_article",
    modelName: "openai/gpt-5-mini",
    randomId: () => "event-3",
  });

  assert.deepEqual(event, {
    id: "event-3",
    runId: "generation-2026-04-15T11:00:00.000Z-seq-4",
    entityType: "history_record",
    entityId: "record-2",
    stage: "record_created",
    status: "success",
    message: "已创建内容记录",
    details: {
      platform: "wechat_article",
      modelName: "openai/gpt-5-mini",
    },
    createdAt: "2026-04-15T11:00:00.000Z",
  });
});
