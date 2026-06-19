import type { WechatBlock } from "../types/history.ts";

type GenerateWechatCoverPayload = {
  articleTitle: string;
  articleBlocks: WechatBlock[];
};

type GenerateWechatCoverSuccess = {
  image: {
    imageUrl: string;
    prompt: string;
    model: string;
    generatedAt: string;
  };
};

type GenerateWechatCoverErrorCode =
  | "missing_openrouter_image_config"
  | "missing_public_image_storage_config"
  | "generation_failed"
  | "generation_timeout"
  | "public_image_upload_failed";

type GenerateWechatCoverErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export const DEFAULT_WECHAT_COVER_GENERATION_TIMEOUT_MS = 120_000;

export class GenerateWechatCoverRequestError extends Error {
  code: GenerateWechatCoverErrorCode;

  constructor(code: GenerateWechatCoverErrorCode, message: string) {
    super(message);
    this.name = "GenerateWechatCoverRequestError";
    this.code = code;
  }
}

export async function requestGeneratedWechatCover(
  fetcher: typeof fetch,
  payload: GenerateWechatCoverPayload,
  options: { timeoutMs?: number } = {},
): Promise<GenerateWechatCoverSuccess> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_WECHAT_COVER_GENERATION_TIMEOUT_MS,
  );

  try {
    const response = await fetcher("/api/generate-wechat-cover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await parseGenerateWechatCoverErrorPayload(response);
      const errorCode = errorPayload.error?.code;
      const errorMessage = errorPayload.error?.message?.trim();

      throw new GenerateWechatCoverRequestError(
        isGenerateWechatCoverErrorCode(errorCode)
          ? errorCode
          : "generation_failed",
        errorMessage || "Unexpected wechat cover generation error",
      );
    }

    return (await response.json()) as GenerateWechatCoverSuccess;
  } catch (error) {
    if (error instanceof GenerateWechatCoverRequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GenerateWechatCoverRequestError(
        "generation_timeout",
        "Wechat cover generation request timed out",
      );
    }

    throw new GenerateWechatCoverRequestError(
      "generation_failed",
      error instanceof Error
        ? error.message
        : "Unexpected wechat cover generation error",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildGenerateWechatCoverErrorMessage(
  error: GenerateWechatCoverRequestError,
) {
  if (error.code === "missing_openrouter_image_config") {
    return "当前未配置图片生成模型，暂时无法生成公众号头图。";
  }

  if (error.code === "missing_public_image_storage_config") {
    return "当前未配置公众号头图公网存储，暂时无法生成可发布的头图。";
  }

  if (error.code === "generation_timeout") {
    return "公众号头图生成超时，请稍后重试。";
  }

  if (error.code === "public_image_upload_failed") {
    return "公众号头图已生成，但上传到公网存储失败，请检查存储配置后重试。";
  }

  const normalizedMessage = error.message.toLowerCase();

  if (
    normalizedMessage.includes("401") ||
    normalizedMessage.includes("authentication")
  ) {
    return "OpenRouter 鉴权失败，请检查 API Key 配置后重试。";
  }

  return "公众号头图生成失败，请稍后重试。";
}

async function parseGenerateWechatCoverErrorPayload(response: Response) {
  const payloadText = await response.text();

  if (!payloadText) {
    return {};
  }

  try {
    return JSON.parse(payloadText) as GenerateWechatCoverErrorPayload;
  } catch {
    return {
      error: {
        code: "generation_failed",
        message: payloadText,
      },
    } satisfies GenerateWechatCoverErrorPayload;
  }
}

function isGenerateWechatCoverErrorCode(
  value: string | undefined,
): value is GenerateWechatCoverErrorCode {
  return (
    value === "missing_openrouter_image_config" ||
    value === "missing_public_image_storage_config" ||
    value === "generation_failed" ||
    value === "generation_timeout" ||
    value === "public_image_upload_failed"
  );
}
