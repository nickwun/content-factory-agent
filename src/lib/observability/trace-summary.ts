import type { PublishResult } from "../publish/types.ts";
import type { HistoryRecord } from "../types/history.ts";
import type { ContentTraceSummary, ExecutionEvent } from "./types.ts";

type BuildContentTraceSummaryInput = {
  record?:
    | (Pick<HistoryRecord, "id" | "traceContext"> &
        Partial<Pick<HistoryRecord, "generation" | "content" | "selectedPlatforms">>)
    | null;
  publishResults: PublishResult[];
  executionEvents: ExecutionEvent[];
};

export function buildContentTraceSummary(
  input: BuildContentTraceSummaryInput,
): ContentTraceSummary {
  const latestPublish = [...input.publishResults].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];
  const latestIssue = [...input.executionEvents]
    .filter((event) => event.status === "warning" || event.status === "error")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  return {
    source: {
      sourceKind: input.record?.traceContext?.sourceKind ?? "direct_create",
      processingMode: input.record?.generation?.processingMode ?? "rewrite",
      ...(input.record?.traceContext?.topicClusterTitle
        ? { topicClusterTitle: input.record.traceContext.topicClusterTitle }
        : {}),
      ...(input.record?.traceContext?.rewriteTaskId
        ? { rewriteTaskId: input.record.traceContext.rewriteTaskId }
        : {}),
      ...(input.record?.traceContext?.externalKeyword
        ? { externalKeyword: input.record.traceContext.externalKeyword }
        : {}),
      ...(input.record?.traceContext?.externalRewriteTaskId
        ? { externalRewriteTaskId: input.record.traceContext.externalRewriteTaskId }
        : {}),
      ...(input.record?.traceContext?.representativeArticleIds ||
      typeof input.record?.traceContext?.externalArticleCount === "number"
        ? {
            representativeArticleCount:
              typeof input.record.traceContext.externalArticleCount === "number"
                ? input.record.traceContext.externalArticleCount
                : (input.record.traceContext.representativeArticleIds?.length ?? 0),
          }
        : {}),
    },
    generation: {
      draftStatus: resolveDraftStatus(input.record, input.executionEvents),
      finalizationStatus: resolveFinalizationStatus(
        input.record,
        input.executionEvents,
      ),
      coverStatus: resolveCoverStatus(input.record, input.executionEvents),
    },
    ...(latestPublish
      ? {
          latestPublish: {
            destination: latestPublish.destination,
            status: latestPublish.status,
            createdAt: latestPublish.createdAt,
            ...(latestPublish.resultUrl ? { resultUrl: latestPublish.resultUrl } : {}),
            ...(latestPublish.warningMessage
              ? { warningMessage: latestPublish.warningMessage }
              : {}),
          },
        }
      : {}),
    ...(latestIssue
      ? {
          latestIssue: {
            type: toIssueType(latestIssue.status),
            message: latestIssue.message,
          },
        }
      : {}),
  };
}

function resolveDraftStatus(
  record: BuildContentTraceSummaryInput["record"],
  events: ExecutionEvent[],
) {
  if (events.some((event) => event.stage === "draft_generated")) {
    return "success";
  }

  if (record?.generation?.generatedAt) {
    return "success";
  }

  return "unknown";
}

function resolveFinalizationStatus(
  record: BuildContentTraceSummaryInput["record"],
  events: ExecutionEvent[],
) {
  if (events.some((event) => event.stage === "finalization_completed")) {
    return "success";
  }

  if (!record) {
    return "unknown";
  }

  const { selectedPlatforms, generation } = record;

  if (selectedPlatforms && !selectedPlatforms.includes("wechat_article")) {
    return "skipped";
  }

  if (generation?.wechatFinalizationEnabled === false) {
    return "skipped";
  }

  if (generation?.wechatFinalizationEnabled === true) {
    return "not_executed";
  }

  return "unknown";
}

function resolveCoverStatus(
  record: BuildContentTraceSummaryInput["record"],
  events: ExecutionEvent[],
) {
  const latestCoverEvent = [...events]
    .filter(
      (event) =>
        event.stage === "cover_generation_succeeded" ||
        event.stage === "cover_generation_failed",
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (latestCoverEvent) {
    return latestCoverEvent.stage === "cover_generation_succeeded"
      ? "success"
      : "failed";
  }

  if (!record) {
    return "unknown";
  }

  const { selectedPlatforms } = record;

  if (selectedPlatforms && !selectedPlatforms.includes("wechat_article")) {
    return "skipped";
  }

  const coverImage = record.content?.wechat_article?.coverImage;

  if (!coverImage) {
    return "unknown";
  }

  if (coverImage.status === "generated") {
    return "success";
  }

  if (coverImage.status === "failed") {
    return "failed";
  }

  if (coverImage.status === "idle") {
    return "not_executed";
  }

  return "unknown";
}

function toIssueType(status: ExecutionEvent["status"]): "warning" | "error" {
  return status === "error" ? "error" : "warning";
}
