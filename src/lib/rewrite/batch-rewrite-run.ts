import type { BatchRewriteItem } from "./batch-rewrite.ts";

export type BatchRewriteProgress = {
  total: number;
  currentIndex: number | null;
  successCount: number;
  failedCount: number;
  activeFileName: string | null;
};

export function getNextBatchRewriteReadyItem(items: BatchRewriteItem[]) {
  return items.find(
    (item) =>
      item.parseStatus === "ready" &&
      item.runStatus === "pending" &&
      item.rewriteSource,
  );
}

export function markBatchRewriteGenerating(
  items: BatchRewriteItem[],
  itemId: string,
) {
  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          runStatus: "generating" as const,
          runError: undefined,
        }
      : item,
  );
}

export function markBatchRewriteRunSucceeded(
  items: BatchRewriteItem[],
  input: {
    itemId: string;
    recordId: string;
    recordTitle: string;
  },
) {
  return items.map((item) =>
    item.id === input.itemId
      ? {
          ...item,
          runStatus: "succeeded" as const,
          resultRecordId: input.recordId,
          resultTitle: input.recordTitle,
          runError: undefined,
        }
      : item,
  );
}

export function markBatchRewriteRunFailed(
  items: BatchRewriteItem[],
  input: {
    itemId: string;
    errorMessage: string;
  },
) {
  return items.map((item) =>
    item.id === input.itemId
      ? {
          ...item,
          runStatus: "failed" as const,
          runError: input.errorMessage,
        }
      : item,
  );
}

export function buildBatchRewriteProgress(
  items: BatchRewriteItem[],
): BatchRewriteProgress {
  const generatingIndex = items.findIndex((item) => item.runStatus === "generating");

  return {
    total: items.length,
    currentIndex: generatingIndex >= 0 ? generatingIndex + 1 : null,
    successCount: items.filter((item) => item.runStatus === "succeeded").length,
    failedCount: items.filter((item) => item.runStatus === "failed").length,
    activeFileName: generatingIndex >= 0 ? items[generatingIndex]?.fileName ?? null : null,
  };
}
