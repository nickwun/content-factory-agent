import type { PlatformType } from "../types/platform.ts";
import type { RewriteFileLike } from "./rewrite-file-parser.ts";
import type { RewriteSource } from "./rewrite-source.ts";

export const MAX_BATCH_REWRITE_FILES = 10;

export type RewriteComposerMode = "single" | "batch";

export type BatchRewriteFileLike = RewriteFileLike & {
  size: number;
  lastModified: number;
};

export type BatchRewriteRejectedFile = {
  fileName: string;
  reason: "duplicate" | "limit_exceeded";
  message: string;
};

export type BatchRewriteItem = {
  id: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  fileKey: string;
  charCount?: number;
  rewriteSource?: RewriteSource;
  parseStatus: "ready" | "failed";
  parseError?: string;
  runStatus: "pending" | "generating" | "succeeded" | "failed";
  resultRecordId?: string;
  resultTitle?: string;
  runError?: string;
};

export function resolveSelectedPlatformsForRewriteMode(
  mode: RewriteComposerMode,
  selectedPlatforms: PlatformType[],
): PlatformType[] {
  if (mode === "batch") {
    return ["wechat_article"];
  }

  return selectedPlatforms;
}

export function buildBatchRewriteFileKey(file: Pick<BatchRewriteFileLike, "name" | "size" | "lastModified">) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function planBatchRewriteFileSelection(input: {
  existingItems: BatchRewriteItem[];
  incomingFiles: BatchRewriteFileLike[];
  maxFiles?: number;
}) {
  const maxFiles = input.maxFiles ?? MAX_BATCH_REWRITE_FILES;
  const existingKeys = new Set(input.existingItems.map((item) => item.fileKey));
  const acceptedFiles: BatchRewriteFileLike[] = [];
  const rejectedFiles: BatchRewriteRejectedFile[] = [];
  let nextCount = input.existingItems.length;

  for (const file of input.incomingFiles) {
    const fileKey = buildBatchRewriteFileKey(file);

    if (existingKeys.has(fileKey)) {
      rejectedFiles.push({
        fileName: file.name,
        reason: "duplicate",
        message: `素材 ${file.name} 已在当前批次中，已跳过重复素材。`,
      });
      continue;
    }

    if (nextCount >= maxFiles) {
      rejectedFiles.push({
        fileName: file.name,
        reason: "limit_exceeded",
        message: `当前批量仿写最多上传 ${maxFiles} 篇素材。`,
      });
      continue;
    }

    existingKeys.add(fileKey);
    acceptedFiles.push(file);
    nextCount += 1;
  }

  return {
    acceptedFiles,
    rejectedFiles,
  };
}

export function buildBatchRewriteSelectionMessage(
  rejectedFiles: BatchRewriteRejectedFile[],
) {
  if (rejectedFiles.length === 0) {
    return null;
  }

  const hasDuplicate = rejectedFiles.some((item) => item.reason === "duplicate");
  const hasLimitExceeded = rejectedFiles.some(
    (item) => item.reason === "limit_exceeded",
  );
  const parts: string[] = [];

  if (hasDuplicate) {
    const duplicateCount = rejectedFiles.filter(
      (item) => item.reason === "duplicate",
    ).length;
    parts.push(`已跳过 ${duplicateCount} 篇重复素材`);
  }

  if (hasLimitExceeded) {
    parts.push(`当前批量仿写最多上传 ${MAX_BATCH_REWRITE_FILES} 篇素材`);
  }

  return `${parts.join("；")}。`;
}

export function createBatchRewriteReadyItem(
  file: BatchRewriteFileLike,
  rewriteSource: RewriteSource,
): BatchRewriteItem {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileSize: file.size,
    lastModified: file.lastModified,
    fileKey: buildBatchRewriteFileKey(file),
    charCount: rewriteSource.charCount,
    rewriteSource,
    parseStatus: "ready",
    runStatus: "pending",
  };
}

export function createBatchRewriteFailedItem(
  file: BatchRewriteFileLike,
  parseError: string,
): BatchRewriteItem {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileSize: file.size,
    lastModified: file.lastModified,
    fileKey: buildBatchRewriteFileKey(file),
    parseStatus: "failed",
    parseError,
    runStatus: "pending",
  };
}
