import type {
  ExecutionEntityType,
  ExecutionEvent,
} from "./types.ts";
import type {
  FeishuCoverSyncStatus,
  PublishDestination,
} from "../publish/types.ts";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ExecutionEventStoreOptions = {
  storage?: StorageLike;
  storageKey?: string;
};

type RunIdKind = "generation" | "publish";

const DEFAULT_STORAGE_KEY = "content-agent-observability-events";

export function createRunId(
  kind: RunIdKind,
  input: {
    now?: () => string;
    randomId?: () => string;
  } = {},
) {
  const now = input.now ?? (() => new Date().toISOString());
  const randomId = input.randomId ?? createRandomId;
  return `${kind}-${now()}-${randomId()}`;
}

export function createRecordCreatedEvent(input: {
  runId: string;
  recordId: string;
  createdAt: string;
  platform?: string;
  modelName?: string;
  randomId?: () => string;
}): ExecutionEvent {
  const randomId = input.randomId ?? createRandomId;

  return {
    id: randomId(),
    runId: input.runId,
    entityType: "history_record",
    entityId: input.recordId,
    stage: "record_created",
    status: "success",
    message: "已创建内容记录",
    createdAt: input.createdAt,
    details: {
      ...(input.platform
        ? { platform: input.platform }
        : {}),
      ...(input.modelName ? { modelName: input.modelName } : {}),
    },
  };
}

export function createDraftGeneratedEvent(input: {
  runId: string;
  recordId: string;
  createdAt: string;
  platform?: string;
  modelName?: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createHistoryRecordEvent({
    ...input,
    stage: "draft_generated",
    status: "success",
    message: "初稿生成完成",
  });
}

export function createFinalizationCompletedEvent(input: {
  runId: string;
  recordId: string;
  createdAt: string;
  platform?: string;
  modelName?: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createHistoryRecordEvent({
    ...input,
    stage: "finalization_completed",
    status: "success",
    message: "成稿收束已完成",
  });
}

export function createCoverGenerationSucceededEvent(input: {
  runId: string;
  recordId: string;
  createdAt: string;
  platform?: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createHistoryRecordEvent({
    ...input,
    stage: "cover_generation_succeeded",
    status: "success",
    message: "头图生成成功",
  });
}

export function createCoverGenerationFailedEvent(input: {
  runId: string;
  recordId: string;
  createdAt: string;
  platform?: string;
  errorCode?: string;
  message: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createHistoryRecordEvent({
    ...input,
    stage: "cover_generation_failed",
    status: "error",
    details: {
      ...(input.platform
        ? { platform: input.platform }
        : {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    },
  });
}

export function createPublishStartedEvent(input: {
  runId: string;
  publishResultId: string;
  destination: PublishDestination;
  createdAt: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createPublishEvent({
    ...input,
    stage: "publish_started",
    status: "info",
    message: "开始发布",
  });
}

export function createPublishSucceededEvent(input: {
  runId: string;
  publishResultId: string;
  destination: PublishDestination;
  createdAt: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createPublishEvent({
    ...input,
    stage: "publish_succeeded",
    status: "success",
    message: "发布成功",
  });
}

export function createPublishPartiallySucceededEvent(input: {
  runId: string;
  publishResultId: string;
  destination: PublishDestination;
  createdAt: string;
  coverSyncStatus?: FeishuCoverSyncStatus;
  message: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createPublishEvent({
    ...input,
    stage: "publish_partially_succeeded",
    status: "warning",
    message: input.message,
    details: {
      destination: input.destination,
      ...(input.coverSyncStatus
        ? { coverSyncStatus: input.coverSyncStatus }
        : {}),
    },
  });
}

export function createPublishFailedEvent(input: {
  runId: string;
  publishResultId: string;
  destination: PublishDestination;
  createdAt: string;
  errorCode?: string;
  message: string;
  randomId?: () => string;
}): ExecutionEvent {
  return createPublishEvent({
    ...input,
    stage: "publish_failed",
    status: "error",
    message: input.message,
    details: {
      destination: input.destination,
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    },
  });
}

function createRandomId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createHistoryRecordEvent(input: {
  runId: string;
  recordId: string;
  createdAt: string;
  platform?: string;
  modelName?: string;
  stage: ExecutionEvent["stage"];
  status: ExecutionEvent["status"];
  message: string;
  details?: ExecutionEvent["details"];
  randomId?: () => string;
}): ExecutionEvent {
  const randomId = input.randomId ?? createRandomId;

  return {
    id: randomId(),
    runId: input.runId,
    entityType: "history_record",
    entityId: input.recordId,
    stage: input.stage,
    status: input.status,
    message: input.message,
    createdAt: input.createdAt,
    details:
      input.details ??
      {
        ...(input.platform
          ? { platform: input.platform }
          : {}),
        ...(input.modelName ? { modelName: input.modelName } : {}),
      },
  };
}

function createPublishEvent(input: {
  runId: string;
  publishResultId: string;
  destination: PublishDestination;
  createdAt: string;
  stage: ExecutionEvent["stage"];
  status: ExecutionEvent["status"];
  message: string;
  details?: ExecutionEvent["details"];
  randomId?: () => string;
}): ExecutionEvent {
  const randomId = input.randomId ?? createRandomId;

  return {
    id: randomId(),
    runId: input.runId,
    entityType: "publish_result",
    entityId: input.publishResultId,
    stage: input.stage,
    status: input.status,
    message: input.message,
    createdAt: input.createdAt,
    details: input.details ?? {
      destination: input.destination,
    },
  };
}

export function createExecutionEventStore(
  options: ExecutionEventStoreOptions = {},
) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  return {
    async list() {
      return readAll(options.storage, storageKey);
    },

    async append(event: ExecutionEvent) {
      const events = readAll(options.storage, storageKey);
      writeAll(options.storage, storageKey, [event, ...events]);
      return event;
    },

    async listByEntity(entityType: ExecutionEntityType, entityId: string) {
      return readAll(options.storage, storageKey).filter(
        (event) => event.entityType === entityType && event.entityId === entityId,
      );
    },

    async listByRunId(runId: string) {
      return readAll(options.storage, storageKey).filter(
        (event) => event.runId === runId,
      );
    },
  };
}

function readAll(storageOverride: StorageLike | undefined, storageKey: string) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return [] as ExecutionEvent[];
  }

  const raw = storage.getItem(storageKey);

  if (!raw) {
    return [] as ExecutionEvent[];
  }

  return [...(JSON.parse(raw) as ExecutionEvent[])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function writeAll(
  storageOverride: StorageLike | undefined,
  storageKey: string,
  events: ExecutionEvent[],
) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return;
  }

  const sorted = [...events].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  storage.setItem(storageKey, JSON.stringify(sorted));
}

function getStorage(storageOverride?: StorageLike) {
  if (storageOverride) {
    return storageOverride;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
