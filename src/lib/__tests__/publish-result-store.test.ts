import assert from "node:assert/strict";
import test from "node:test";

import { createPublishResultStore } from "../observability/publish-result-store.ts";
import type { PublishResult } from "../publish/types.ts";

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

function createPublishResult(overrides: Partial<PublishResult> = {}): PublishResult {
  return {
    id: overrides.id ?? "publish-result-1",
    runId: overrides.runId ?? "publish-2026-04-15T11:00:00.000Z-seq-1",
    recordId: overrides.recordId ?? "record-1",
    destination: overrides.destination ?? "feishu_doc",
    status: overrides.status ?? "success",
    message: overrides.message ?? "飞书文档已创建，正文已发布。",
    createdAt: overrides.createdAt ?? "2026-04-15T11:00:00.000Z",
    ...(overrides.resultId ? { resultId: overrides.resultId } : {}),
    ...(overrides.resultUrl ? { resultUrl: overrides.resultUrl } : {}),
    ...(overrides.warningMessage ? { warningMessage: overrides.warningMessage } : {}),
    ...(overrides.errorCode ? { errorCode: overrides.errorCode } : {}),
    ...(overrides.errorMessage ? { errorMessage: overrides.errorMessage } : {}),
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  };
}

test("publish result store keeps multiple publish attempts for one record", async () => {
  const storage = createMemoryStorage();
  const store = createPublishResultStore({ storage });
  const first = createPublishResult({
    id: "publish-result-1",
    runId: "publish-2026-04-15T11:00:00.000Z-seq-1",
    destination: "wechat_article",
    resultUrl: "https://mp.weixin.qq.com/draft/1",
    createdAt: "2026-04-15T11:00:00.000Z",
  });
  const second = createPublishResult({
    id: "publish-result-2",
    runId: "publish-2026-04-15T12:00:00.000Z-seq-2",
    destination: "feishu_doc",
    resultUrl: "https://feishu.cn/docx/abc",
    createdAt: "2026-04-15T12:00:00.000Z",
  });

  await store.append(first);
  await store.append(second);

  assert.deepEqual(
    (await store.listByRecordId("record-1")).map((item) => item.id),
    ["publish-result-2", "publish-result-1"],
  );
  assert.equal((await store.getLatestByRecordId("record-1"))?.id, "publish-result-2");
});
