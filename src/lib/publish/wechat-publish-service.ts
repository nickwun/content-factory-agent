import { PublishServiceError } from "./publish-errors.ts";
import type {
  WechatPublishAccount,
  WechatPublishRequest,
  WechatPublishSnapshot,
} from "./types.ts";

const WECHAT_ACCOUNTS_CACHE_TTL_MS = 5 * 60 * 1000;

type WechatCredentials = {
  apiKey: string;
  baseUrl: string;
};

type CachedWechatAccountsEntry = {
  expiresAt: number;
  accounts: WechatPublishAccount[];
};

const wechatAccountsCache = new Map<string, CachedWechatAccountsEntry>();

export function buildWechatAccountsCacheKey(credentials: WechatCredentials) {
  return `wechat-accounts:${credentials.baseUrl}:${credentials.apiKey}`;
}

export function getCachedWechatAccounts(credentials: WechatCredentials) {
  const entry = wechatAccountsCache.get(buildWechatAccountsCacheKey(credentials));

  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }

  return entry.accounts;
}

export function setCachedWechatAccounts(
  credentials: WechatCredentials,
  accounts: WechatPublishAccount[],
) {
  wechatAccountsCache.set(buildWechatAccountsCacheKey(credentials), {
    accounts,
    expiresAt: Date.now() + WECHAT_ACCOUNTS_CACHE_TTL_MS,
  });
}

export function parseWechatPublishRequestPayload(
  payload: unknown,
): WechatPublishRequest {
  if (!payload || typeof payload !== "object") {
    throw new PublishServiceError("validation_error", "发布请求格式无效。", 400);
  }

  const request = payload as Partial<WechatPublishRequest>;

  if (!request.accountId?.trim()) {
    throw new PublishServiceError("validation_error", "缺少目标公众号。", 400);
  }

  if (request.publishType !== "article" && request.publishType !== "xiaolvshu") {
    throw new PublishServiceError(
      "unsupported_publish_type",
      "当前发布类型暂不支持。",
      400,
    );
  }

  const snapshot = request.snapshot as Partial<WechatPublishSnapshot> | undefined;

  if (
    !snapshot ||
    snapshot.platform !== "wechat_article" ||
    !snapshot.schemaVersion?.trim() ||
    !snapshot.recordId?.trim() ||
    !snapshot.title?.trim() ||
    !Array.isArray(snapshot.blocks) ||
    snapshot.blocks.length === 0
  ) {
    throw new PublishServiceError("validation_error", "公众号发布快照无效。", 400);
  }

  const relatedXiaohongshu = snapshot.relatedXiaohongshu
    ? {
        title:
          typeof snapshot.relatedXiaohongshu.title === "string"
            ? snapshot.relatedXiaohongshu.title.trim()
            : "",
        caption:
          typeof snapshot.relatedXiaohongshu.caption === "string"
            ? snapshot.relatedXiaohongshu.caption.trim()
            : "",
        tags: Array.isArray(snapshot.relatedXiaohongshu.tags)
          ? snapshot.relatedXiaohongshu.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.replace(/^#/, "").trim())
              .filter(Boolean)
          : [],
        imageUrls: Array.isArray(snapshot.relatedXiaohongshu.imageUrls)
          ? snapshot.relatedXiaohongshu.imageUrls
              .filter((url): url is string => typeof url === "string")
              .map((url) => url.trim())
              .filter(Boolean)
          : [],
      }
    : undefined;

  if (
    request.publishType === "xiaolvshu" &&
    (!relatedXiaohongshu ||
      !relatedXiaohongshu.title ||
      !relatedXiaohongshu.caption ||
      relatedXiaohongshu.imageUrls.length === 0)
  ) {
    throw new PublishServiceError(
      "missing_required_asset",
      "小绿书模式需要小红书内容和至少 1 张已生成图片。",
      400,
    );
  }

  return {
    accountId: request.accountId.trim(),
    publishType: request.publishType,
    snapshot: {
      schemaVersion: snapshot.schemaVersion.trim(),
      platform: "wechat_article",
      recordId: snapshot.recordId.trim(),
      title: snapshot.title.trim(),
      blocks: snapshot.blocks,
      relatedXiaohongshu,
    },
  };
}
