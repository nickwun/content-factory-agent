import { searchHistoryRecords } from "./history-search.ts";
import type { HistoryStorageAdapter } from "./history-storage.ts";
import type { HistoryRecord } from "../types/history.ts";
import { normalizeWechatArticleMarkdownBody } from "../workspace/wechat-markdown.ts";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type LocalHistoryStorageOptions = {
  storage?: StorageLike;
  storageKey?: string;
  now?: () => string;
};

const DEFAULT_STORAGE_KEY = "content-agent-history";

export function createLocalHistoryStorage(
  options: LocalHistoryStorageOptions = {},
): HistoryStorageAdapter {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async list() {
      return readAll(options.storage, storageKey);
    },

    async getById(id) {
      return readAll(options.storage, storageKey).find((record) => record.id === id) ?? null;
    },

    async create(record) {
      const records = readAll(options.storage, storageKey);
      writeAll(options.storage, storageKey, [record, ...records]);
    },

    async save(record) {
      const records = readAll(options.storage, storageKey);
      const nextRecords = [record, ...records.filter((item) => item.id !== record.id)];
      writeAll(options.storage, storageKey, nextRecords);
      return record;
    },

    async rename(id, title) {
      const records = readAll(options.storage, storageKey);
      const target = records.find((record) => record.id === id);

      if (!target) {
        return null;
      }

      const renamed: HistoryRecord = {
        ...target,
        title,
        isCustomTitle: true,
        updatedAt: now(),
      };

      writeAll(
        options.storage,
        storageKey,
        [renamed, ...records.filter((record) => record.id !== id)],
      );

      return renamed;
    },

    async remove(id) {
      const records = readAll(options.storage, storageKey);
      writeAll(
        options.storage,
        storageKey,
        records.filter((record) => record.id !== id),
      );
    },

    async search(query) {
      return searchHistoryRecords(readAll(options.storage, storageKey), query);
    },
  };
}

function readAll(storageOverride: StorageLike | undefined, storageKey: string) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return [] as HistoryRecord[];
  }

  const raw = storage.getItem(storageKey);

  if (!raw) {
    return [] as HistoryRecord[];
  }

  const parsed = JSON.parse(raw) as HistoryRecord[];
  return [...parsed].map(normalizeHistoryRecord).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function writeAll(
  storageOverride: StorageLike | undefined,
  storageKey: string,
  records: HistoryRecord[],
) {
  const storage = getStorage(storageOverride);

  if (!storage) {
    return;
  }

  const sorted = [...records].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  storage.setItem(storageKey, JSON.stringify(sorted));
}

function normalizeHistoryRecord(record: HistoryRecord): HistoryRecord {
  const wechatArticle = record.content.wechat_article;

  if (!wechatArticle) {
    return record;
  }

  return {
    ...record,
    content: {
      ...record.content,
      wechat_article: normalizeWechatArticleMarkdownBody(wechatArticle),
    },
  };
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
