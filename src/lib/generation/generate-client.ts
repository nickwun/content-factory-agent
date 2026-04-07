import type { GeneratedDraftResult } from "./generation-service.ts";
import type { PlatformPromptSetting } from "../settings/prompt-settings-types.ts";
import type { PlatformType } from "../types/platform.ts";

type GenerateRequestPayload = {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
};

type GenerateRequestSuccess = {
  draft: GeneratedDraftResult;
  promptSettings: PlatformPromptSetting[];
};

type GenerateErrorCode =
  | "missing_openrouter_config"
  | "generation_failed"
  | "generation_timeout";

type GenerateErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export const DEFAULT_GENERATION_TIMEOUT_MS = 80_000;

const REAL_GENERATION_PLATFORMS: PlatformType[] = [
  "wechat_article",
  "twitter",
  "xiaohongshu",
  "video_script",
];

const PLATFORM_LABELS: Record<PlatformType, string> = {
  wechat_article: "公众号",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  video_script: "视频脚本",
};

export class GenerateRequestError extends Error {
  code: GenerateErrorCode;

  constructor(code: GenerateErrorCode, message: string) {
    super(message);
    this.name = "GenerateRequestError";
    this.code = code;
  }
}

export async function requestGeneratedDraft(
  fetcher: typeof fetch,
  payload: GenerateRequestPayload,
  options: { timeoutMs?: number } = {},
): Promise<GenerateRequestSuccess> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS,
  );

  try {
    const response = await fetcher("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await parseGenerateErrorPayload(response);
      const errorCode = errorPayload.error?.code;
      const errorMessage = errorPayload.error?.message?.trim();

      throw new GenerateRequestError(
        isGenerateErrorCode(errorCode) ? errorCode : "generation_failed",
        errorMessage || "Unexpected generation error",
      );
    }

    return (await response.json()) as GenerateRequestSuccess;
  } catch (error) {
    if (error instanceof GenerateRequestError) {
      throw error;
    }

    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new GenerateRequestError(
        "generation_timeout",
        "Generation request timed out",
      );
    }

    throw new GenerateRequestError(
      "generation_failed",
      error instanceof Error ? error.message : "Unexpected generation error",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function buildGenerateErrorMessage(
  error: GenerateRequestError,
  selectedPlatforms: PlatformType[],
) {
  const selectedRealPlatforms = selectedPlatforms.filter((platform) =>
    REAL_GENERATION_PLATFORMS.includes(platform),
  );

  if (error.code === "missing_openrouter_config") {
    const realPlatformLabels = formatPlatformNames(
      selectedRealPlatforms,
    );

    if (realPlatformLabels) {
      return `当前未配置 OpenRouter 环境变量，暂时无法生成${realPlatformLabels}内容。`;
    }

    return "当前未配置 OpenRouter 环境变量，暂时无法生成所选平台内容。";
  }

  if (error.code === "generation_timeout") {
    return selectedRealPlatforms.length >= 2
      ? `生成请求超时。${formatPlatformNames(selectedRealPlatforms)} 同时走真实 AI 会更慢，建议先单平台生成。`
      : "生成请求超时，请稍后重试。";
  }

  const normalizedMessage = error.message.toLowerCase();
  if (
    normalizedMessage.includes("401") ||
    normalizedMessage.includes("authentication")
  ) {
    return "OpenRouter 鉴权失败，请检查 API Key 配置后重试。";
  }

  return "本次生成失败，请稍后重试。";
}

export function getGeneratePendingMessage(selectedPlatforms: PlatformType[]) {
  const selectedRealPlatforms = selectedPlatforms.filter((platform) =>
    REAL_GENERATION_PLATFORMS.includes(platform),
  );

  if (selectedRealPlatforms.length >= 2) {
    return `正在调用真实 AI 生成 ${formatPlatformNames(selectedRealPlatforms)} 内容，通常需要 30-60 秒。若想更快开始，建议先单平台生成。`;
  }

  if (selectedRealPlatforms.length === 1) {
    return `正在调用真实 AI 生成${formatPlatformNames(selectedRealPlatforms)}内容，请稍候。`;
  }

  return `已准备为 ${selectedPlatforms.length} 个平台生成草稿`;
}

async function parseGenerateErrorPayload(response: Response) {
  const payloadText = await response.text();

  if (!payloadText) {
    return {};
  }

  try {
    return JSON.parse(payloadText) as GenerateErrorPayload;
  } catch {
    return {
      error: {
        code: "generation_failed",
        message: payloadText,
      },
    } satisfies GenerateErrorPayload;
  }
}

function isGenerateErrorCode(value: string | undefined): value is GenerateErrorCode {
  return (
    value === "missing_openrouter_config" ||
    value === "generation_failed" ||
    value === "generation_timeout"
  );
}

function formatPlatformNames(platforms: PlatformType[]) {
  if (platforms.length === 0) {
    return "";
  }

  return platforms.map((platform) => PLATFORM_LABELS[platform]).join("、");
}
