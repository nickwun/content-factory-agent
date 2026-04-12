import assert from "node:assert/strict";
import test from "node:test";

import {
  canOpenBatchRewriteResult,
  resolveBatchRewriteResultLabel,
} from "../rewrite/batch-rewrite-results.ts";
import type { BatchRewriteItem } from "../rewrite/batch-rewrite.ts";

test("canOpenBatchRewriteResult only allows succeeded items with a record id", () => {
  assert.equal(
    canOpenBatchRewriteResult(createItem({ runStatus: "succeeded", resultRecordId: "record-1" })),
    true,
  );
  assert.equal(
    canOpenBatchRewriteResult(createItem({ runStatus: "succeeded" })),
    false,
  );
  assert.equal(
    canOpenBatchRewriteResult(createItem({ runStatus: "failed", resultRecordId: "record-1" })),
    false,
  );
});

test("resolveBatchRewriteResultLabel prefers generated record title and falls back to file name", () => {
  assert.equal(
    resolveBatchRewriteResultLabel(
      createItem({ resultTitle: "生成结果标题", fileName: "source-1.docx" }),
    ),
    "生成结果标题",
  );
  assert.equal(
    resolveBatchRewriteResultLabel(createItem({ fileName: "source-2.docx" })),
    "source-2.docx",
  );
});

function createItem(overrides: Partial<BatchRewriteItem> = {}): BatchRewriteItem {
  return {
    id: "item-1",
    fileName: "source.docx",
    fileSize: 100,
    lastModified: 1710000000000,
    fileKey: "source.docx::100::1710000000000",
    parseStatus: "ready",
    runStatus: "pending",
    ...overrides,
  };
}
