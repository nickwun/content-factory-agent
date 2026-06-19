import type { BatchRewriteItem } from "./batch-rewrite.ts";

export function canOpenBatchRewriteResult(item: BatchRewriteItem) {
  return item.runStatus === "succeeded" && Boolean(item.resultRecordId);
}

export function resolveBatchRewriteResultLabel(item: BatchRewriteItem) {
  return item.resultTitle?.trim() || item.fileName;
}
