import type {
  XiaohongshuPublishPayload,
  XiaohongshuPublishResponse,
} from "./types.ts";
import { PublishServiceError } from "./publish-errors.ts";
import { buildXiaohongshuPublishContent } from "./xiaohongshu-publish-mapper.ts";

type XiaohongshuPublishCredentials = {
  apiKey: string;
  baseUrl: string;
};

function buildXiaohongshuUpstreamUrl(baseUrl: string, pathname: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(pathname.replace(/^\//, ""), normalizedBaseUrl);
}

export async function publishXiaohongshuNote(
  credentials: XiaohongshuPublishCredentials,
  payload: XiaohongshuPublishPayload,
  fetcher: typeof fetch = fetch,
): Promise<XiaohongshuPublishResponse> {
  const response = await fetcher(
    buildXiaohongshuUpstreamUrl(credentials.baseUrl, "publish"),
    {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: payload.title,
      content: buildXiaohongshuPublishContent(payload),
      images: [payload.coverImageUrl, ...payload.bodyImageUrls],
    }),
  });

  if (!response.ok) {
    throw await buildXiaohongshuPublishError(response);
  }

  const responsePayload = (await response.json()) as {
    publish_url?: string;
    url?: string;
    qrcode_url?: string;
    qrcode?: string;
  };

  const publishUrl = responsePayload.publish_url ?? responsePayload.url;
  const qrcodeUrl = responsePayload.qrcode_url ?? responsePayload.qrcode;

  if (!publishUrl || !qrcodeUrl) {
    throw new PublishServiceError(
      "upstream_publish_failed",
      "小红书发布接口未返回可用的发布链接或二维码。",
      502,
    );
  }

  return {
    publishUrl,
    qrcodeUrl,
  };
}

async function buildXiaohongshuPublishError(response: Response) {
  const payloadText = await response.text();
  const message = parseErrorMessage(payloadText);

  if (response.status === 400 && /image|url|图片/i.test(message)) {
    return new PublishServiceError(
      "invalid_image_url",
      message || "小红书图片地址无效。",
      400,
    );
  }

  if (response.status === 400) {
    return new PublishServiceError(
      "validation_error",
      message || "小红书发布参数未通过校验。",
      400,
    );
  }

  return new PublishServiceError(
    "upstream_publish_failed",
    message || "小红书发布服务暂时不可用。",
    response.status >= 400 ? response.status : 502,
  );
}

function parseErrorMessage(payloadText: string) {
  if (!payloadText) {
    return "";
  }

  try {
    const payload = JSON.parse(payloadText) as {
      error?: { message?: string };
      message?: string;
    };

    return payload.error?.message?.trim() || payload.message?.trim() || payloadText;
  } catch {
    return payloadText.trim();
  }
}
