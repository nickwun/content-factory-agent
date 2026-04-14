import { PublishServiceError } from "./publish-errors.ts";

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
};

type CreateFeishuTenantAccessTokenResolverOptions = {
  safetyWindowMs?: number;
};

export function createFeishuTenantAccessTokenResolver(
  options: CreateFeishuTenantAccessTokenResolverOptions = {},
) {
  const safetyWindowMs = options.safetyWindowMs ?? 60_000;
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

    const response = await fetcher(
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
    );

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
