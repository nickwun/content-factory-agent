import type { PublishResult } from "../publish/types.ts";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type PublishResultStoreOptions = {
  storage?: StorageLike;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "content-agent-publish-results";

export function createPublishResultStore(
  options: PublishResultStoreOptions = {},
) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  return {
    async list() {
      return readAll(options.storage, storageKey);
    },

    async append(result: PublishResult) {
      const results = readAll(options.storage, storageKey);
      writeAll(options.storage, storageKey, [result, ...results]);
      return result;
    },

    async listByRecordId(recordId: string) {
      return readAll(options.storage, storageKey).filter(
        (result) => result.recordId === recordId,
      );
    },

    async getLatestByRecordId(recordId: string) {
      return (
        readAll(options.storage, storageKey).find(
          (result) => result.recordId === recordId,
        ) ?? null
      );
    },
  };
}

function readAll(storageOverride: StorageLike | undefined, storageKey: string) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return [] as PublishResult[];
  }

  const raw = storage.getItem(storageKey);

  if (!raw) {
    return [] as PublishResult[];
  }

  return [...(JSON.parse(raw) as PublishResult[])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function writeAll(
  storageOverride: StorageLike | undefined,
  storageKey: string,
  results: PublishResult[],
) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return;
  }

  const sorted = [...results].sort((left, right) =>
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
