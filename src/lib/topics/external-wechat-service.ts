import { createHash } from "node:crypto";

import type {
  ExternalWechatArticle,
  ExternalWechatTimeWindow,
} from "./external-wechat-types.ts";

type ExternalWechatClient = {
  searchArticles: (payload: {
    mode: 1;
    keyword: string;
    search_type: 1;
    publish_time_type: 0 | 1 | 2 | 3;
    sort_type: 2;
    currentPage: 1;
    offset: 0;
    cookies_buffer: "";
    key: string;
    verifycode: string;
  }) => Promise<Record<string, unknown>>;
  fetchArticleDetail: (payload: {
    url: string;
    key: string;
    verifycode: string;
    mode: 2;
  }) => Promise<Record<string, unknown>>;
};

type CredentialsProvider = () =>
  | {
      apiKey: string;
      verifyCode?: string;
    }
  | null;

type ExternalWechatServiceOptions = {
  client: ExternalWechatClient;
  credentialsProvider: CredentialsProvider;
  now?: () => string;
};

export class ExternalWechatSearchError extends Error {
  readonly code:
    | "invalid_keyword"
    | "invalid_time_window"
    | "missing_credentials"
    | "upstream_error";

  constructor(
    code:
      | "invalid_keyword"
      | "invalid_time_window"
      | "missing_credentials"
      | "upstream_error",
    message: string,
  ) {
    super(message);
    this.name = "ExternalWechatSearchError";
    this.code = code;
  }
}

const TIME_WINDOW_MAP: Record<ExternalWechatTimeWindow, 0 | 1 | 2 | 3> = {
  all: 0,
  "1d": 1,
  "7d": 2,
  "6m": 3,
};

export function createExternalWechatService(
  options: ExternalWechatServiceOptions,
) {
  const { client, credentialsProvider } = options;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async searchExternalWechatArticles(input: {
      keyword: string;
      timeWindow: ExternalWechatTimeWindow;
    }) {
      const keyword = input.keyword.trim();

      if (!keyword) {
        throw new ExternalWechatSearchError(
          "invalid_keyword",
          "关键词不能为空。",
        );
      }

      const publishTimeType = TIME_WINDOW_MAP[input.timeWindow];

      if (publishTimeType === undefined) {
        throw new ExternalWechatSearchError(
          "invalid_time_window",
          "不支持的时间范围。",
        );
      }

      const credentials = credentialsProvider();

      if (!credentials?.apiKey.trim()) {
        throw new ExternalWechatSearchError(
          "missing_credentials",
          "未配置外部公众号抓取凭证。",
        );
      }

      let payload: Record<string, unknown>;

      try {
        payload = await client.searchArticles({
          mode: 1,
          keyword,
          search_type: 1,
          publish_time_type: publishTimeType,
          sort_type: 2,
          currentPage: 1,
          offset: 0,
          cookies_buffer: "",
          key: credentials.apiKey.trim(),
          verifycode: credentials.verifyCode?.trim() ?? "",
        });
      } catch (error) {
        throw new ExternalWechatSearchError(
          "upstream_error",
          error instanceof Error ? error.message : "外部公众号文章抓取失败。",
        );
      }

      const articleItems = collectArticleItems(payload);

      return articleItems.map((item) =>
        normalizeArticleItem(item, {
          keyword,
          timeWindow: input.timeWindow,
          fetchedAt: now(),
        }),
      );
    },

    async fetchExternalWechatArticleContents(input: {
      articles: ExternalWechatArticle[];
    }) {
      const credentials = credentialsProvider();

      if (!credentials?.apiKey.trim()) {
        throw new ExternalWechatSearchError(
          "missing_credentials",
          "未配置外部公众号抓取凭证。",
        );
      }

      return mapWithConcurrency(input.articles, 3, async (article) => {
        if (!article.url?.trim()) {
          return {
            ...article,
            contentFetchStatus: "failed" as const,
            contentFetchError: "文章缺少可用链接，暂时无法补正文。",
          };
        }

        try {
          const payload = await client.fetchArticleDetail({
            url: article.url,
            key: credentials.apiKey.trim(),
            verifycode: credentials.verifyCode?.trim() ?? "",
            mode: 2,
          });

          const code =
            typeof payload.code === "number"
              ? payload.code
              : typeof payload.errcode === "number"
                ? payload.errcode
                : null;

          if (code !== null && code !== 0) {
            return {
              ...article,
              contentFetchStatus: "failed" as const,
              contentFetchError: normalizeArticleDetailError(code),
            };
          }

          const content = normalizeOptionalText(payload.content);

          if (!content) {
            return {
              ...article,
              contentFetchStatus: "failed" as const,
              contentFetchError: "正文内容为空，暂时无法用于后续分析。",
            };
          }

          const publishTime = resolveDetailPublishTime(payload) ?? article.publishTime;
          const accountName =
            normalizeOptionalText(payload.nick_name) ?? article.accountName;
          const title = normalizeOptionalText(payload.title) ?? article.title;
          const url = normalizeOptionalText(payload.url) ?? article.url;

          return {
            ...article,
            title,
            accountName,
            ...(publishTime ? { publishTime } : {}),
            ...(url ? { url } : {}),
            content,
            contentFetchStatus: "success" as const,
            contentFetchError: undefined,
          };
        } catch {
          return {
            ...article,
            contentFetchStatus: "failed" as const,
            contentFetchError: "正文补拉失败，请稍后重试。",
          };
        }
      });
    },
  };
}

type RawArticleItem = Record<string, unknown>;

function collectArticleItems(payload: unknown) {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  const results: RawArticleItem[] = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    if ("items" in current && Array.isArray(current.items)) {
      for (const item of current.items) {
        if (isRawArticleItem(item)) {
          results.push(item);
        }
      }
    }

    for (const value of Object.values(current)) {
      queue.push(value);
    }
  }

  return dedupeArticleItems(results);
}

function dedupeArticleItems(items: RawArticleItem[]) {
  const seen = new Set<string>();
  const deduped: RawArticleItem[] = [];

  for (const item of items) {
    const dedupeKey =
      normalizeOptionalText(item.docID) ??
      normalizeOptionalText(item.doc_url) ??
      normalizeOptionalText(item.title) ??
      JSON.stringify(item);

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(item);
  }

  return deduped;
}

function isRawArticleItem(value: unknown): value is RawArticleItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return "title" in value && typeof value.title === "string";
}

function normalizeArticleItem(
  item: RawArticleItem,
  input: {
    keyword: string;
    timeWindow: ExternalWechatTimeWindow;
    fetchedAt: string;
  },
): ExternalWechatArticle {
  const title = stripHighlightMarkup(normalizeOptionalText(item.title) ?? "未命名文章");
  const accountName = stripHighlightMarkup(resolveAccountName(item));
  const url = normalizeOptionalText(item.doc_url) ?? normalizeOptionalText(item.url);
  const publishTime = resolvePublishTime(item);
  const metrics = resolveMetrics(item);
  const stableSourceKey =
    normalizeOptionalText(item.docID) ??
    url ??
    [title, accountName, publishTime ?? ""].join("|");

  return {
    id: createStableExternalWechatArticleId(stableSourceKey),
    keyword: input.keyword,
    timeWindow: input.timeWindow,
    title,
    accountName,
    ...(publishTime ? { publishTime } : {}),
    ...(url ? { url } : {}),
    ...(metrics ? { metrics } : {}),
    contentFetchStatus: "pending",
    fetchedAt: input.fetchedAt,
  };
}

function createStableExternalWechatArticleId(sourceKey: string) {
  const digest = createHash("sha1").update(sourceKey).digest("hex").slice(0, 12);
  return `extwx-${digest}`;
}

function resolveAccountName(item: RawArticleItem) {
  if (
    item.source &&
    typeof item.source === "object" &&
    !Array.isArray(item.source) &&
    "title" in item.source &&
    typeof item.source.title === "string" &&
    item.source.title.trim()
  ) {
    return item.source.title.trim();
  }

  return (
    normalizeOptionalText(item.accountName) ??
    normalizeOptionalText(item.nickname) ??
    normalizeOptionalText(item.nick_name) ??
    "未知公众号"
  );
}

function resolvePublishTime(item: RawArticleItem) {
  const timestampValue =
    typeof item.timestamp === "number"
      ? item.timestamp
      : typeof item.date === "number"
        ? item.date
        : null;

  if (timestampValue === null) {
    return undefined;
  }

  return new Date(timestampValue * 1000).toISOString();
}

function resolveMetrics(item: RawArticleItem) {
  const read = toOptionalNumber(item.read_num ?? item.readNum);
  const like = toOptionalNumber(item.like_num ?? item.likeNum);
  const looking = toOptionalNumber(item.looking_num ?? item.lookingNum);

  if (
    typeof read !== "number" &&
    typeof like !== "number" &&
    typeof looking !== "number"
  ) {
    return undefined;
  }

  return {
    ...(typeof read === "number" ? { read } : {}),
    ...(typeof like === "number" ? { like } : {}),
    ...(typeof looking === "number" ? { looking } : {}),
  };
}

function resolveDetailPublishTime(payload: Record<string, unknown>) {
  if (typeof payload.pubtime === "number") {
    return new Date(payload.pubtime * 1000).toISOString();
  }

  return undefined;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function stripHighlightMarkup(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function normalizeArticleDetailError(code: number) {
  if (code === 101) {
    return "文章已删除、违规或公众号已迁移。";
  }

  if (code === 105 || code === 106 || code === 107) {
    return "正文解析失败，请稍后重试。";
  }

  return "正文补拉失败，请稍后重试。";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
