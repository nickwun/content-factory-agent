import type {
  FeishuPublishRequest,
  FeishuPublishResponse,
  WechatPublishAccount,
  WechatPublishRequest,
  WechatPublishResponse,
  XiaohongshuPublishRequest,
  XiaohongshuPublishResponse,
} from "./types.ts";

type PublishErrorCode =
  | "missing_credentials"
  | "invalid_api_key"
  | "no_bound_accounts"
  | "upstream_unavailable"
  | "account_not_found"
  | "unsupported_publish_type"
  | "validation_error"
  | "missing_required_asset"
  | "missing_images"
  | "invalid_image_url"
  | "rate_limited"
  | "upstream_publish_failed"
  | "not_implemented";

export class PublishRequestError extends Error {
  code: PublishErrorCode;

  constructor(code: PublishErrorCode, message: string) {
    super(message);
    this.name = "PublishRequestError";
    this.code = code;
  }
}

export async function requestWechatPublishAccounts(fetcher: typeof fetch) {
  const response = await fetcher("/api/publish/wechat/accounts");

  if (!response.ok) {
    throw await parsePublishRequestError(response);
  }

  const payload = (await response.json()) as { accounts: WechatPublishAccount[] };
  return payload.accounts;
}

export async function requestWechatArticlePublish(
  fetcher: typeof fetch,
  request: WechatPublishRequest,
) {
  const response = await fetcher("/api/publish/wechat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw await parsePublishRequestError(response);
  }

  return (await response.json()) as WechatPublishResponse;
}

export async function requestXiaohongshuPublish(
  fetcher: typeof fetch,
  request: XiaohongshuPublishRequest,
) {
  const response = await fetcher("/api/publish/xiaohongshu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw await parsePublishRequestError(response);
  }

  return (await response.json()) as XiaohongshuPublishResponse;
}

export async function requestFeishuPublish(
  fetcher: typeof fetch,
  request: FeishuPublishRequest,
) {
  const response = await fetcher("/api/publish/feishu", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw await parsePublishRequestError(response);
  }

  return (await response.json()) as FeishuPublishResponse;
}

export function buildWechatPublishErrorMessage(error: PublishRequestError) {
  if (error.code === "missing_credentials") {
    return "当前未配置公众号发布凭证，请先去设置页补齐。";
  }

  if (error.code === "invalid_api_key") {
    return "公众号发布鉴权失败，请检查 API Key。";
  }

  if (error.code === "no_bound_accounts") {
    return "当前 API Key 下没有可用公众号。";
  }

  if (error.code === "account_not_found") {
    return error.message || "目标公众号不存在、未授权或授权已过期。";
  }

  if (error.code === "validation_error") {
    return error.message || "当前内容未通过公众号发布预检查。";
  }

  if (error.code === "missing_required_asset") {
    return error.message || "当前素材不足，暂时无法使用该发布模式。";
  }

  if (error.code === "rate_limited") {
    return "公众号发布请求过于频繁，请稍后重试。";
  }

  return error.message || "公众号发布失败，请稍后重试。";
}

export function buildXiaohongshuPublishErrorMessage(error: PublishRequestError) {
  if (error.code === "missing_credentials") {
    return "当前未配置小红书发布凭证，请先去设置页补齐。";
  }

  if (error.code === "missing_images") {
    return "当前笔记至少需要 1 张已生成图片后才能发布。";
  }

  if (error.code === "invalid_image_url") {
    return "当前图片地址无法用于小红书发布，请在部署环境中重试。";
  }

  if (error.code === "validation_error") {
    return error.message || "当前小红书内容未通过发布预检查。";
  }

  return error.message || "小红书发布失败，请稍后重试。";
}

export function buildFeishuPublishErrorMessage(error: PublishRequestError) {
  if (error.code === "missing_credentials") {
    return "当前未配置飞书文档发布凭证，请先去设置页补齐。";
  }

  if (error.code === "invalid_api_key") {
    return "飞书文档发布鉴权失败，请检查飞书 App ID / App Secret。";
  }

  if (error.code === "validation_error") {
    return error.message || "当前内容未通过飞书文档发布预检查。";
  }

  if (error.code === "rate_limited") {
    return "飞书文档发布请求过于频繁，请稍后重试。";
  }

  return error.message || "飞书文档发布失败，请稍后重试。";
}

async function parsePublishRequestError(response: Response) {
  const payloadText = await response.text();

  if (!payloadText) {
    return new PublishRequestError(
      "upstream_publish_failed",
      "Unexpected publish error",
    );
  }

  try {
    const payload = JSON.parse(payloadText) as {
      error?: { code?: string; message?: string };
    };

    return new PublishRequestError(
      isPublishErrorCode(payload.error?.code)
        ? payload.error.code
        : "upstream_publish_failed",
      payload.error?.message?.trim() || "Unexpected publish error",
    );
  } catch {
    return new PublishRequestError(
      "upstream_publish_failed",
      payloadText.trim(),
    );
  }
}

function isPublishErrorCode(value: string | undefined): value is PublishErrorCode {
  return (
    value === "missing_credentials" ||
    value === "invalid_api_key" ||
    value === "no_bound_accounts" ||
    value === "upstream_unavailable" ||
    value === "account_not_found" ||
    value === "unsupported_publish_type" ||
    value === "validation_error" ||
    value === "missing_required_asset" ||
    value === "missing_images" ||
    value === "invalid_image_url" ||
    value === "rate_limited" ||
    value === "upstream_publish_failed" ||
    value === "not_implemented"
  );
}
