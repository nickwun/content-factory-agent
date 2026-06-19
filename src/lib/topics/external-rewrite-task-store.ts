import type { ExternalRewriteTask } from "./external-wechat-types.ts";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ExternalRewriteTaskStoreOptions = {
  storage?: StorageLike;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "content-agent-external-rewrite-tasks";

export function createExternalRewriteTaskStore(
  options: ExternalRewriteTaskStoreOptions = {},
) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  return {
    async list() {
      return readAll(options.storage, storageKey);
    },

    async getById(id: string) {
      return readAll(options.storage, storageKey).find((task) => task.id === id) ?? null;
    },

    async upsert(task: ExternalRewriteTask) {
      const tasks = readAll(options.storage, storageKey);
      const nextTasks = [task, ...tasks.filter((item) => item.id !== task.id)];
      writeAll(options.storage, storageKey, nextTasks);
      return task;
    },

    async clear() {
      const storage = getStorage(options.storage);

      if (!storage) {
        return;
      }

      storage.removeItem(storageKey);
    },
  };
}

function readAll(storageOverride: StorageLike | undefined, storageKey: string) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return [] as ExternalRewriteTask[];
  }

  const raw = storage.getItem(storageKey);

  if (!raw) {
    return [] as ExternalRewriteTask[];
  }

  const parsed = JSON.parse(raw) as ExternalRewriteTask[];
  return [...parsed].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function writeAll(
  storageOverride: StorageLike | undefined,
  storageKey: string,
  tasks: ExternalRewriteTask[],
) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return;
  }

  storage.setItem(
    storageKey,
    JSON.stringify(
      [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    ),
  );
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
