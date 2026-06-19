import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBatchRewriteProgress,
  getNextBatchRewriteReadyItem,
  markBatchRewriteGenerating,
  markBatchRewriteRunFailed,
  markBatchRewriteRunSucceeded,
} from "../rewrite/batch-rewrite-run.ts";
import type { BatchRewriteItem } from "../rewrite/batch-rewrite.ts";

test("getNextBatchRewriteReadyItem returns the next pending ready item only", () => {
  const items = [
    createItem("failed-parse", {
      parseStatus: "failed",
      parseError: "解析失败",
    }),
    createItem("pending-ready"),
    createItem("already-done", { runStatus: "succeeded" }),
  ];

  const next = getNextBatchRewriteReadyItem(items);

  assert.equal(next?.id, "pending-ready");
});

test("markBatchRewriteGenerating only updates the targeted item", () => {
  const items = [
    createItem("first"),
    createItem("second"),
  ];

  const next = markBatchRewriteGenerating(items, "second");

  assert.equal(next[0]?.runStatus, "pending");
  assert.equal(next[1]?.runStatus, "generating");
});

test("markBatchRewriteRunSucceeded records result metadata without disturbing others", () => {
  const items = [
    createItem("first", { runStatus: "generating" }),
    createItem("second"),
  ];

  const next = markBatchRewriteRunSucceeded(items, {
    itemId: "first",
    recordId: "record-1",
    recordTitle: "生成结果",
  });

  assert.equal(next[0]?.runStatus, "succeeded");
  assert.equal(next[0]?.resultRecordId, "record-1");
  assert.equal(next[0]?.resultTitle, "生成结果");
  assert.equal(next[1]?.runStatus, "pending");
});

test("markBatchRewriteRunFailed preserves explicit error message on the item", () => {
  const items = [
    createItem("first", { runStatus: "generating" }),
  ];

  const next = markBatchRewriteRunFailed(items, {
    itemId: "first",
    errorMessage: "OpenRouter 鉴权失败，请检查 API Key 配置后重试。",
  });

  assert.equal(next[0]?.runStatus, "failed");
  assert.equal(next[0]?.runError, "OpenRouter 鉴权失败，请检查 API Key 配置后重试。");
});

test("buildBatchRewriteProgress summarizes current index and success/failure counts", () => {
  const items: BatchRewriteItem[] = [
    createItem("first", { runStatus: "succeeded" }),
    createItem("second", { runStatus: "failed", runError: "超时" }),
    createItem("third", { runStatus: "generating" }),
    createItem("fourth"),
  ];

  const progress = buildBatchRewriteProgress(items);

  assert.equal(progress.total, 4);
  assert.equal(progress.currentIndex, 3);
  assert.equal(progress.successCount, 1);
  assert.equal(progress.failedCount, 1);
  assert.equal(progress.activeFileName, "third.docx");
});

function createItem(
  id: string,
  overrides: Partial<BatchRewriteItem> = {},
): BatchRewriteItem {
  return {
    id,
    fileName: `${id}.docx`,
    fileSize: 100,
    lastModified: 1710000000000,
    fileKey: `${id}.docx::100::1710000000000`,
    charCount: 1200,
    rewriteSource: {
      kind: "uploaded_file",
      sourceName: `${id}.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extractedText: "正文内容",
      charCount: 1200,
    },
    parseStatus: "ready",
    runStatus: "pending",
    ...overrides,
  };
}
