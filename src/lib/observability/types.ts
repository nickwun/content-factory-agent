import type { PublishDestination } from "../publish/types.ts";

export type RecordTracePlatform = "wechat_article";

export type ExecutionEntityType =
  | "rewrite_task"
  | "history_record"
  | "publish_result";

export type ExecutionEventStage =
  | "rewrite_task_created"
  | "rewrite_task_started"
  | "rewrite_task_failed"
  | "record_created"
  | "draft_generated"
  | "finalization_completed"
  | "cover_generation_succeeded"
  | "cover_generation_failed"
  | "publish_started"
  | "publish_succeeded"
  | "publish_partially_succeeded"
  | "publish_failed";

export type ExecutionEventStatus =
  | "info"
  | "success"
  | "warning"
  | "error";

export type ExecutionEvent = {
  id: string;
  runId: string;
  entityType: ExecutionEntityType;
  entityId: string;
  stage: ExecutionEventStage;
  status: ExecutionEventStatus;
  message: string;
  details?: {
    platform?: string;
    modelName?: string;
    destination?: PublishDestination;
    errorCode?: string;
    coverSyncStatus?: "synced" | "failed" | "skipped";
    publishResultId?: string;
  };
  createdAt: string;
};

export type ContentTraceSummary = {
  source: {
    sourceKind: "direct_create" | "rewrite_task" | "external_rewrite_task";
    processingMode?: "rewrite" | "translate_to_zh_article";
    topicClusterTitle?: string;
    rewriteTaskId?: string;
    externalKeyword?: string;
    externalRewriteTaskId?: string;
    representativeArticleCount?: number;
  };
  generation: {
    draftStatus?: "success" | "failed" | "unknown";
    finalizationStatus?:
      | "success"
      | "failed"
      | "not_executed"
      | "skipped"
      | "unknown";
    coverStatus?:
      | "success"
      | "failed"
      | "not_executed"
      | "skipped"
      | "unknown";
  };
  latestPublish?: {
    destination: PublishDestination;
    status: "success" | "partial_success" | "failed";
    resultUrl?: string;
    warningMessage?: string;
    createdAt: string;
  };
  latestIssue?: {
    type: "warning" | "error";
    message: string;
  };
};
