import { PublishServiceError } from "./publish-errors.ts";
import {
  FetchTimeoutError,
  fetchWithTimeout,
} from "./fetch-with-timeout.ts";

export type FeishuAppCredentials = {
  appId: string;
  appSecret: string;
};

type TenantAccessTokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

type ResolveFeishuTenantAccessTokenOptions = {
  fetcher?: typeof fetch;
  now?: number;
  requestTimeoutMs?: number;
};

type CreateFeishuTenantAccessTokenResolverOptions = {
  safetyWindowMs?: number;
  requestTimeoutMs?: number;
};

const DEFAULT_TENANT_TOKEN_TIMEOUT_MS = 10_000;

export function createFeishuTenantAccessTokenResolver(
  options: CreateFeishuTenantAccessTokenResolverOptions = {},
) {
  const safetyWindowMs = options.safetyWindowMs ?? 60_000;
  const defaultRequestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_TENANT_TOKEN_TIMEOUT_MS;
  const cache = new Map<string, TenantAccessTokenCacheEntry>();

  return async function resolveFeishuTenantAccessToken(
    credentials: FeishuAppCredentials,
    resolveOptions: ResolveFeishuTenantAccessTokenOptions = {},
  ) {
    const fetcher = resolveOptions.fetcher ?? fetch;
    const now = resolveOptions.now ?? Date.now();
    const cacheKey = `${credentials.appId}:${credentials.appSecret}`;
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > now + safetyWindowMs) {
      return cached.accessToken;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        fetcher,
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            app_id: credentials.appId,
            app_secret: credentials.appSecret,
          }),
        },
        {
          label: "feishu tenant token",
          timeoutMs: resolveOptions.requestTimeoutMs ?? defaultRequestTimeoutMs,
        },
      );
    } catch (error) {
      if (error instanceof FetchTimeoutError) {
        throw new PublishServiceError(
          "upstream_timeout",
          error.message,
          504,
        );
      }
      throw error;
    }

    const payload = (await response.json().catch(() => undefined)) as
      | {
          code?: number;
          msg?: string;
          tenant_access_token?: string;
          expire?: number;
        }
      | undefined;

    if (!response.ok || payload?.code !== 0 || !payload.tenant_access_token) {
      throw new PublishServiceError(
        response.status === 401 || payload?.code
          ? "invalid_api_key"
          : "upstream_publish_failed",
        payload?.msg?.trim() || "飞书鉴权失败，请检查 App ID 与 App Secret。",
        response.status >= 400 ? response.status : 401,
      );
    }

    const ttlSeconds = Math.max(payload.expire ?? 0, 120);
    const expiresAt = now + ttlSeconds * 1000;
    cache.set(cacheKey, {
      accessToken: payload.tenant_access_token,
      expiresAt,
    });

    return payload.tenant_access_token;
  };
}

export const resolveFeishuTenantAccessToken =
  createFeishuTenantAccessTokenResolver();
