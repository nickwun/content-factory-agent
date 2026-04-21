import type {
  ExternalWechatArticle,
  ExternalTopicInsight,
  ExternalWechatQueryState,
} from "./external-wechat-types.ts";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ExternalWechatStoreOptions = {
  storage?: StorageLike;
  storageKey?: string;
};

const DEFAULT_STORAGE_KEY = "content-agent-external-wechat";

export function createExternalWechatStore(
  options: ExternalWechatStoreOptions = {},
) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  return {
    async getLatestQueryState() {
      const storage = getStorage(options.storage);

      if (!storage) {
        return null;
      }

      const raw = storage.getItem(storageKey);

      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as ExternalWechatQueryState;
    },

    async saveLatestQueryState(input: {
      keyword: string;
      timeWindow: ExternalWechatQueryState["timeWindow"];
      articles: ExternalWechatArticle[];
      latestInsight?: ExternalTopicInsight;
      updatedAt?: string;
    }) {
      const storage = getStorage(options.storage);

      if (!storage) {
        return null;
      }

      const nextState: ExternalWechatQueryState = {
        keyword: input.keyword,
        timeWindow: input.timeWindow,
        articles: input.articles,
        ...(input.latestInsight ? { latestInsight: input.latestInsight } : {}),
        updatedAt: input.updatedAt ?? new Date().toISOString(),
      };

      storage.setItem(storageKey, JSON.stringify(nextState));
      return nextState;
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

function getStorage(storageOverride?: StorageLike) {
  if (storageOverride) {
    return storageOverride;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
