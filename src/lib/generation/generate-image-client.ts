import type { PlatformType } from "../types/platform.ts";

type GenerateImagePayload = {
  platform: PlatformType;
  noteTitle: string;
  noteCaption: string;
  noteTags: string[];
  suggestion: {
    id: string;
    index: number;
    title: string;
    description: string;
  };
};

type GenerateImageSuccess = {
  image: {
    suggestionId: string;
    imageUrl: string;
    imagePrompt: string;
    imageModel: string;
    generatedAt: string;
  };
};

type GenerateImageErrorCode =
  | "missing_openrouter_image_config"
  | "image_quality_failed"
  | "generation_failed"
  | "generation_timeout";

type GenerateImageErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    failureReason?:
      | "failed_ratio_check"
      | "failed_text_ui_check"
      | "failed_upstream_generation";
  };
};

export const DEFAULT_IMAGE_GENERATION_TIMEOUT_MS = 120_000;

export class GenerateImageRequestError extends Error {
  code: GenerateImageErrorCode;
  failureReason?:
    | "failed_ratio_check"
    | "failed_text_ui_check"
    | "failed_upstream_generation";

  constructor(
    code: GenerateImageErrorCode,
    message: string,
    failureReason?:
      | "failed_ratio_check"
      | "failed_text_ui_check"
      | "failed_upstream_generation",
  ) {
    super(message);
    this.name = "GenerateImageRequestError";
    this.code = code;
    this.failureReason = failureReason;
  }
}

export async function requestGeneratedImage(
  fetcher: typeof fetch,
  payload: GenerateImagePayload,
  options: { timeoutMs?: number } = {},
): Promise<GenerateImageSuccess> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_IMAGE_GENERATION_TIMEOUT_MS,
  );

  try {
    const response = await fetcher("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await parseGenerateImageErrorPayload(response);
      const errorCode = errorPayload.error?.code;
      const errorMessage = errorPayload.error?.message?.trim();

      throw new GenerateImageRequestError(
        isGenerateImageErrorCode(errorCode)
          ? errorCode
          : "generation_failed",
        errorMessage || "Unexpected image generation error",
        errorPayload.error?.failureReason,
      );
    }

    return (await response.json()) as GenerateImageSuccess;
  } catch (error) {
    if (error instanceof GenerateImageRequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GenerateImageRequestError(
        "generation_timeout",
        "Image generation request timed out",
      );
    }

    throw new GenerateImageRequestError(
      "generation_failed",
      error instanceof Error ? error.message : "Unexpected image generation error",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildGenerateImageErrorMessage(
  error: GenerateImageRequestError,
) {
  if (error.code === "missing_openrouter_image_config") {
    return "当前未配置图片生成模型，暂时无法生成这张配图。";
  }

  if (error.code === "generation_timeout") {
    return "图片生成超时，请稍后重试。";
  }

  if (error.code === "image_quality_failed") {
    return "图片未通过质量检查，请重试。";
  }

  const normalizedMessage = error.message.toLowerCase();

  if (
    normalizedMessage.includes("401") ||
    normalizedMessage.includes("authentication")
  ) {
    return "OpenRouter 鉴权失败，请检查 API Key 配置后重试。";
  }

  return "图片生成失败，请稍后重试。";
}

async function parseGenerateImageErrorPayload(response: Response) {
  const payloadText = await response.text();

  if (!payloadText) {
    return {};
  }

  try {
    return JSON.parse(payloadText) as GenerateImageErrorPayload;
  } catch {
    return {
      error: {
        code: "generation_failed",
        message: payloadText,
      },
    } satisfies GenerateImageErrorPayload;
  }
}

function isGenerateImageErrorCode(
  value: string | undefined,
): value is GenerateImageErrorCode {
  return (
    value === "missing_openrouter_image_config" ||
    value === "image_quality_failed" ||
    value === "generation_failed" ||
    value === "generation_timeout"
  );
}
