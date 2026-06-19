import type {
  WechatPublishAccount,
  WechatPublishRequest,
  WechatPublishResponse,
} from "./types.ts";
import { PublishServiceError } from "./publish-errors.ts";
import {
  mapWechatSnapshotToArticlePayload,
  mapWechatSnapshotToXiaolvshuPayload,
} from "./wechat-publish-mapper.ts";

type WechatPublishCredentials = {
  apiKey: string;
  baseUrl: string;
};

function buildWechatUpstreamUrl(baseUrl: string, pathname: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(pathname.replace(/^\//, ""), normalizedBaseUrl);
}

export async function fetchWechatPublishAccounts(
  credentials: WechatPublishCredentials,
  fetcher: typeof fetch = fetch,
): Promise<WechatPublishAccount[]> {
  const response = await fetcher(
    buildWechatUpstreamUrl(credentials.baseUrl, "wechat-accounts"),
    {
      method: "POST",
      headers: {
        "X-API-Key": credentials.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    throw await buildWechatPublishError(response);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: {
      accounts?: Array<{
        name?: string;
        wechatAppid?: string;
        username?: string;
        avatar?: string;
        type?: string;
        verified?: boolean;
        status?: string;
      }>;
    };
    error?: string;
    code?: string;
  };

  if (!payload.success) {
    throw buildWechatPublishErrorFromPayload(response.status, payload);
  }

  const accounts = (payload.data?.accounts ?? [])
    .map((item) => {
      if (!item.wechatAppid || !item.name) {
        return null;
      }

      return {
        accountId: item.wechatAppid,
        nickname: item.name,
        principalName: item.username,
        avatarUrl: item.avatar,
        verified: item.verified,
        status: mapWechatAccountStatus(item.status),
        supportedPublishTypes:
          item.status === "revoked" ? [] : ["article", "xiaolvshu"],
      } satisfies WechatPublishAccount;
    })
    .filter(Boolean) as WechatPublishAccount[];

  if (accounts.length === 0) {
    throw new PublishServiceError(
      "no_bound_accounts",
      "当前 API Key 下没有可用公众号。",
      404,
    );
  }

  return accounts;
}

export async function publishWechatArticle(
  credentials: WechatPublishCredentials,
  request: WechatPublishRequest,
  baseOrigin: string,
  fetcher: typeof fetch = fetch,
): Promise<WechatPublishResponse> {
  const requestBody =
    request.publishType === "xiaolvshu"
      ? {
          wechatAppid: request.accountId,
          ...mapWechatSnapshotToXiaolvshuPayload(request.snapshot),
        }
      : {
          wechatAppid: request.accountId,
          ...mapWechatSnapshotToArticlePayload(request.snapshot, baseOrigin),
        };

  const response = await fetcher(
    buildWechatUpstreamUrl(credentials.baseUrl, "wechat-publish"),
    {
      method: "POST",
      headers: {
        "X-API-Key": credentials.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    throw await buildWechatPublishError(response);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: {
      publicationId?: string;
      materialId?: string;
      mediaId?: string;
      status?: string;
      message?: string;
    };
    error?: string;
    code?: string;
  };

  if (!payload.success) {
    throw buildWechatPublishErrorFromPayload(response.status, payload);
  }

  return {
    success: true,
    publicationId: payload.data?.publicationId,
    materialId: payload.data?.materialId,
    status: payload.data?.status,
    message: payload.data?.message,
  };
}

async function buildWechatPublishError(response: Response) {
  const payloadText = await response.text();
  const payload = parseWechatErrorPayload(payloadText);
  const message = payload.message;

  if (payload.code) {
    return buildWechatPublishErrorFromPayload(response.status, payload);
  }

  if (response.status === 401 || /401|unauthorized/i.test(message)) {
    return new PublishServiceError(
      "invalid_api_key",
      "公众号发布鉴权失败，请检查 API Key。",
      401,
    );
  }

  if (response.status === 404) {
    return new PublishServiceError(
      "no_bound_accounts",
      message || "当前 API Key 下没有可用公众号。",
      404,
    );
  }

  if (response.status === 429) {
    return new PublishServiceError(
      "rate_limited",
      message || "公众号发布接口请求过于频繁。",
      429,
    );
  }

  return new PublishServiceError(
    response.status >= 500 ? "upstream_unavailable" : "upstream_publish_failed",
    message || "公众号发布服务暂时不可用。",
    response.status >= 400 ? response.status : 502,
  );
}

function parseWechatErrorPayload(payloadText: string) {
  if (!payloadText) {
    return { message: "", code: undefined as string | undefined };
  }

  try {
    const payload = JSON.parse(payloadText) as {
      message?: string;
      code?: string;
      success?: boolean;
      data?: unknown;
      error?: string | { message?: string };
    };

    return {
      code: typeof payload.code === "string" ? payload.code.trim() : undefined,
      message:
        (typeof payload.error === "string" ? payload.error : payload.error?.message)?.trim() ||
        payload.message?.trim() ||
        payloadText,
    };
  } catch {
    return { message: payloadText.trim(), code: undefined };
  }
}

function buildWechatPublishErrorFromPayload(
  status: number,
  payload: { code?: string; error?: string; message?: string },
) {
  const code = payload.code?.trim().toUpperCase();
  const message = payload.message?.trim() || payload.error?.trim() || "";

  if (code === "API_KEY_MISSING") {
    return new PublishServiceError(
      "missing_credentials",
      message || "未配置公众号发布凭证。",
      503,
    );
  }

  if (code === "API_KEY_INVALID") {
    return new PublishServiceError(
      "invalid_api_key",
      message || "公众号发布鉴权失败，请检查 API Key。",
      401,
    );
  }

  if (code === "ACCOUNT_NOT_FOUND" || code === "ACCOUNT_TOKEN_EXPIRED") {
    return new PublishServiceError(
      "account_not_found",
      message || "公众号不存在、未授权或授权已过期。",
      status || 404,
    );
  }

  if (code === "INVALID_PARAMETER") {
    return new PublishServiceError(
      "validation_error",
      message || "公众号发布参数未通过校验。",
      400,
    );
  }

  if (code === "NO_IMAGES" || code === "IMAGE_UPLOAD_FAILED") {
    return new PublishServiceError(
      "missing_required_asset",
      message || "公众号图文发布缺少可用图片素材。",
      400,
    );
  }

  if (code === "WECHAT_API_ERROR" || code === "INTERNAL_ERROR") {
    return new PublishServiceError(
      "upstream_publish_failed",
      message || "公众号发布服务暂时不可用。",
      status >= 400 ? status : 502,
    );
  }

  return new PublishServiceError(
    status >= 500 ? "upstream_unavailable" : "upstream_publish_failed",
    message || "公众号发布服务暂时不可用。",
    status >= 400 ? status : 502,
  );
}

function mapWechatAccountStatus(status?: string): WechatPublishAccount["status"] {
  if (status === "revoked") {
    return "invalid";
  }

  return "active";
}
