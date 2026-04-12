import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_BATCH_REWRITE_FILES,
  buildBatchRewriteFileKey,
  buildBatchRewriteSelectionMessage,
  createBatchRewriteFailedItem,
  createBatchRewriteReadyItem,
  planBatchRewriteFileSelection,
  resolveSelectedPlatformsForRewriteMode,
  type BatchRewriteFileLike,
  type BatchRewriteItem,
} from "../rewrite/batch-rewrite.ts";

test("resolveSelectedPlatformsForRewriteMode forces wechat in batch mode", () => {
  assert.deepEqual(
    resolveSelectedPlatformsForRewriteMode("batch", ["twitter", "xiaohongshu"]),
    ["wechat_article"],
  );
  assert.deepEqual(
    resolveSelectedPlatformsForRewriteMode("single", ["twitter", "wechat_article"]),
    ["twitter", "wechat_article"],
  );
});

test("planBatchRewriteFileSelection rejects duplicate files by name, size, and lastModified", () => {
  const existingItems: BatchRewriteItem[] = [
    {
      id: "item-1",
      fileName: "sample.docx",
      fileSize: 1200,
      lastModified: 1710000000000,
      fileKey: "sample.docx::1200::1710000000000",
      parseStatus: "ready",
      runStatus: "pending",
      charCount: 1280,
      rewriteSource: {
        kind: "uploaded_file",
        sourceName: "sample.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extractedText: "原文内容",
        charCount: 1280,
      },
    },
  ];

  const incomingFiles: BatchRewriteFileLike[] = [
    createFile("sample.docx", 1200, 1710000000000),
    createFile("second.md", 200, 1710000000100),
  ];

  const result = planBatchRewriteFileSelection({
    existingItems,
    incomingFiles,
  });

  assert.equal(result.acceptedFiles.length, 1);
  assert.equal(result.acceptedFiles[0]?.name, "second.md");
  assert.equal(result.rejectedFiles.length, 1);
  assert.equal(result.rejectedFiles[0]?.reason, "duplicate");
  assert.match(result.rejectedFiles[0]?.message ?? "", /重复素材/);
});

test("planBatchRewriteFileSelection enforces the 10 file limit", () => {
  const existingItems = Array.from({ length: MAX_BATCH_REWRITE_FILES - 1 }, (_, index) =>
    createExistingItem(index),
  );

  const incomingFiles: BatchRewriteFileLike[] = [
    createFile("accept.txt", 100, 1710000001000),
    createFile("overflow.txt", 101, 1710000001001),
  ];

  const result = planBatchRewriteFileSelection({
    existingItems,
    incomingFiles,
  });

  assert.equal(result.acceptedFiles.length, 1);
  assert.equal(result.acceptedFiles[0]?.name, "accept.txt");
  assert.equal(result.rejectedFiles.length, 1);
  assert.equal(result.rejectedFiles[0]?.reason, "limit_exceeded");
  assert.match(result.rejectedFiles[0]?.message ?? "", /最多上传 10 篇/);
});

test("buildBatchRewriteSelectionMessage summarizes duplicate and limit rejections", () => {
  const message = buildBatchRewriteSelectionMessage([
    {
      fileName: "duplicate.docx",
      reason: "duplicate",
      message: "duplicate",
    },
    {
      fileName: "overflow.docx",
      reason: "limit_exceeded",
      message: "overflow",
    },
  ]);

  assert.match(message ?? "", /重复素材/);
  assert.match(message ?? "", /最多上传 10 篇/);
});

test("createBatchRewrite item helpers preserve per-file parse outcomes without creating run results", () => {
  const file = createFile("article.txt", 256, 1710000002000);
  const readyItem = createBatchRewriteReadyItem(
    file,
    {
      kind: "uploaded_file",
      sourceName: file.name,
      mimeType: "text/plain",
      extractedText: "正文内容",
      charCount: 4,
    },
  );
  const failedItem = createBatchRewriteFailedItem(file, "解析失败");

  assert.equal(readyItem.parseStatus, "ready");
  assert.equal(readyItem.runStatus, "pending");
  assert.equal(readyItem.charCount, 4);
  assert.equal(readyItem.resultRecordId, undefined);

  assert.equal(failedItem.parseStatus, "failed");
  assert.equal(failedItem.runStatus, "pending");
  assert.equal(failedItem.parseError, "解析失败");
  assert.equal(failedItem.resultRecordId, undefined);
});

test("buildBatchRewriteFileKey uses name, size, and lastModified", () => {
  const file = createFile("story.md", 888, 1710000003000);
  assert.equal(
    buildBatchRewriteFileKey(file),
    "story.md::888::1710000003000",
  );
});

function createFile(
  name: string,
  size: number,
  lastModified: number,
): BatchRewriteFileLike {
  return {
    name,
    size,
    lastModified,
    type: "text/plain",
    async arrayBuffer() {
      return new TextEncoder().encode("正文").buffer;
    },
  };
}

function createExistingItem(index: number): BatchRewriteItem {
  const file = createFile(`existing-${index}.txt`, 100 + index, 1710000000000 + index);
  return createBatchRewriteReadyItem(file, {
    kind: "uploaded_file",
    sourceName: file.name,
    mimeType: "text/plain",
    extractedText: `正文${index}`,
    charCount: 3,
  });
}
