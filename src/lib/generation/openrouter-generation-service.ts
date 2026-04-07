import { MissingOpenRouterConfigError, getOpenRouterConfig } from "../env/openrouter.ts";
import type {
  TwitterContent,
  VideoScriptContent,
  WechatArticleContent,
  XiaohongshuContent,
} from "../types/history.ts";
import type { GenerationContext } from "./generation-context.ts";
import {
  assertMeaningfulXiaohongshuContent,
  extractXiaohongshuJsonPayload,
  normalizeXiaohongshuOutput,
} from "./xiaohongshu-output.ts";
import {
  assertMeaningfulTwitterContent,
  extractTwitterJsonPayload,
  normalizeTwitterOutput,
} from "./twitter-output.ts";
import {
  assertMeaningfulWechatArticle,
  extractWechatArticleJsonPayload,
  normalizeWechatArticleOutput,
} from "./wechat-output.ts";
import {
  assertMeaningfulVideoScript,
  extractVideoScriptJsonPayload,
  normalizeVideoScriptOutput,
} from "./video-script-output.ts";

const DEFAULT_SYSTEM_PROMPT =
  "你是一名擅长中文公众号创作的资深内容策划，请输出结构清晰、适合长期阅读的深度文章。";
const DEFAULT_TWITTER_SYSTEM_PROMPT =
  "你是一名擅长中文 Twitter/X 内容创作的资深作者，请输出观点清晰、节奏紧凑、适合社交传播的内容草稿。";
const DEFAULT_XIAOHONGSHU_SYSTEM_PROMPT =
  "你是一名擅长中文小红书图文创作的资深作者，请输出更适合种草、经验分享和生活方式表达的内容草稿。";
const DEFAULT_VIDEO_SCRIPT_SYSTEM_PROMPT =
  "你是一名擅长中文短视频脚本创作的资深编导，请输出分镜清楚、口播自然、适合短视频拍摄的结构化脚本。";

export const OPENROUTER_REQUEST_TIMEOUT_MS = 35_000;
export const OPENROUTER_MAX_ATTEMPTS = 2;
const OPENROUTER_RETRY_DELAY_MS = 250;

export class OpenRouterGenerationError extends Error {
  code: "missing_openrouter_config" | "generation_failed" | "generation_timeout";

  constructor(
    code: "missing_openrouter_config" | "generation_failed" | "generation_timeout",
    message: string,
  ) {
    super(message);
    this.name = "OpenRouterGenerationError";
    this.code = code;
  }
}

export async function generateWechatArticleWithOpenRouter(
  context: GenerationContext,
): Promise<WechatArticleContent> {
  const config = getValidatedOpenRouterConfig();

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.wechat_article?.promptTemplate.trim() ||
            DEFAULT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildWechatUserPrompt(context.userPrompt),
        },
      ]),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractWechatArticleJsonPayload(payload);
    const article = normalizeWechatArticleOutput(parsed);
    assertMeaningfulWechatArticle(article);
    return article;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export async function generateTwitterDraftWithOpenRouter(
  context: GenerationContext,
): Promise<TwitterContent> {
  const config = getValidatedOpenRouterConfig();

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.twitter?.promptTemplate.trim() ||
            DEFAULT_TWITTER_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildTwitterUserPrompt(context.userPrompt),
        },
      ]),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractTwitterJsonPayload(payload);
    const twitterDraft = normalizeTwitterOutput(parsed);
    assertMeaningfulTwitterContent(twitterDraft);
    return twitterDraft;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export async function generateXiaohongshuDraftWithOpenRouter(
  context: GenerationContext,
): Promise<XiaohongshuContent> {
  const config = getValidatedOpenRouterConfig();

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.xiaohongshu?.promptTemplate.trim() ||
            DEFAULT_XIAOHONGSHU_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildXiaohongshuUserPrompt(context.userPrompt),
        },
      ]),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractXiaohongshuJsonPayload(payload);
    const xiaohongshuDraft = normalizeXiaohongshuOutput(parsed);
    assertMeaningfulXiaohongshuContent(xiaohongshuDraft);
    return xiaohongshuDraft;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export async function generateVideoScriptWithOpenRouter(
  context: GenerationContext,
): Promise<VideoScriptContent> {
  const config = getValidatedOpenRouterConfig();

  try {
    const completion = await runOpenRouterRequest(() =>
      requestOpenRouterChatCompletion(config, [
        {
          role: "system",
          content:
            context.promptSettings.video_script?.promptTemplate.trim() ||
            DEFAULT_VIDEO_SCRIPT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildVideoScriptUserPrompt(context.userPrompt),
        },
      ]),
    );

    const content = completion.choices?.[0]?.message?.content;
    const payload = extractTextContent(content);

    if (!payload) {
      throw new Error("Empty response payload");
    }

    const parsed = extractVideoScriptJsonPayload(payload);
    const videoScript = normalizeVideoScriptOutput(parsed);
    assertMeaningfulVideoScript(videoScript);
    return videoScript;
  } catch (error) {
    if (error instanceof OpenRouterGenerationError) {
      throw error;
    }

    throw new OpenRouterGenerationError(
      "generation_failed",
      error instanceof Error ? error.message : "OpenRouter generation failed",
    );
  }
}

export function getValidatedOpenRouterConfig() {
  try {
    return getOpenRouterConfig();
  } catch (error) {
    if (error instanceof MissingOpenRouterConfigError) {
      throw new OpenRouterGenerationError("missing_openrouter_config", error.message);
    }

    throw error;
  }
}

export async function runOpenRouterRequest<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= OPENROUTER_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OpenRouterGenerationError) {
        throw error;
      }

      lastError = error;

      if (!shouldRetryOpenRouterError(error) || attempt === OPENROUTER_MAX_ATTEMPTS) {
        throw normalizeOpenRouterError(error);
      }

      await delay(OPENROUTER_RETRY_DELAY_MS);
    }
  }

  throw normalizeOpenRouterError(lastError);
}

function buildWechatUserPrompt(userPrompt: string) {
  return [
    "请根据下面的创作需求，生成一篇中文公众号文章。",
    "要求：",
    "1. 保持中文表达自然、结构清楚、适合公众号长文阅读。",
    "2. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。",
    "3. JSON 格式必须为：{\"title\":\"...\",\"blocks\":[...]}。",
    "4. blocks 仅使用 heading、paragraph、quote、divider、list。",
    "5. heading 必须包含 level(2 或 3) 和 text。",
    "6. paragraph 与 quote 必须包含 text。",
    "7. list 必须包含 items:string[]。",
    "8. 文章要有明确标题和完整正文结构，避免空字段。",
    "",
    `创作需求：${userPrompt}`,
  ].join("\n");
}

function buildTwitterUserPrompt(userPrompt: string) {
  return [
    "请根据下面的创作需求，生成一组适合 Twitter/X 的中文内容草稿。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"recommendedMode":"single|thread","singleDraft":"...","threadDraft":["..."]}。',
    "3. 你可以判断这次内容更适合 single 还是 thread，但如果给出 thread，threadDraft 至少要包含 2 条。",
    "4. singleDraft 应该像一条真实可发的推文，不要写成公众号摘要或长篇小作文。",
    "5. threadDraft 中每条都应该像独立 tweet，可连贯阅读，但不要重复。",
    "6. 用中文输出，表达简洁、观点明确、适合社交平台传播。",
    "",
    `创作需求：${userPrompt}`,
  ].join("\n");
}

function buildXiaohongshuUserPrompt(userPrompt: string) {
  return [
    "请根据下面的创作需求，生成一篇适合小红书发布的中文图文草稿。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","caption":"...","imageSuggestions":[{"title":"...","description":"..."}],"tags":["..."]}。',
    "3. 标题要有小红书感，但不要夸张失真。",
    "4. caption 要像可直接编辑的正文，不要写成公众号摘要，也不要过长。",
    "5. imageSuggestions 至少提供 3 条，最多 9 条，每条都要给出清晰的画面建议。",
    "6. tags 使用不带 # 的简短中文标签。",
    "7. 用中文输出，强调图文感、经验感和可读性。",
    "",
    `创作需求：${userPrompt}`,
  ].join("\n");
}

function buildVideoScriptUserPrompt(userPrompt: string) {
  return [
    "请根据下面的创作需求，生成一份适合短视频创作的中文结构化脚本。",
    "要求：",
    '1. 只返回一个 JSON 对象，不要输出任何额外解释、前言、后记或 markdown。',
    '2. JSON 格式必须为：{"title":"...","duration":"...","scenes":[{"shot":"...","voiceover":"..."}]}。',
    "3. duration 请用适合短视频的表达，例如“60-90 秒”或“1 分钟左右”。",
    "4. scenes 数量控制在 3 到 8 条之间，每条 scene 都必须包含 shot 和 voiceover。",
    "5. shot 要写清楚画面、镜头或动作，voiceover 要像可直接继续编辑的口播文案。",
    "6. 用中文输出，节奏明确，适合短视频内容创作，不要写成长文提纲。",
    "",
    `创作需求：${userPrompt}`,
  ].join("\n");
}

function extractTextContent(
  content: string | Array<{ type?: string; text?: string }> | null | undefined,
) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("");
  }

  return "";
}

type OpenRouterConfig = ReturnType<typeof getOpenRouterConfig>;

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

async function requestOpenRouterChatCompletion(
  config: OpenRouterConfig,
  messages: OpenRouterMessage[],
): Promise<OpenRouterChatCompletionResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `${response.status} ${extractOpenRouterErrorMessage(responseText)}`,
      );
    }

    return JSON.parse(responseText) as OpenRouterChatCompletionResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldRetryOpenRouterError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("401") ||
    message.includes("authentication") ||
    message.includes("missing_openrouter_config")
  ) {
    return false;
  }

  return isTimeoutLikeError(message);
}

function normalizeOpenRouterError(error: unknown) {
  const message = getErrorMessage(error);

  if (isTimeoutLikeError(message.toLowerCase())) {
    return new OpenRouterGenerationError(
      "generation_timeout",
      "OpenRouter request timed out",
    );
  }

  return new OpenRouterGenerationError("generation_failed", message);
}

function isTimeoutLikeError(message: string) {
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("abort")
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "OpenRouter generation failed";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOpenRouterErrorMessage(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string };
    };

    return parsed.error?.message?.trim() || responseText;
  } catch {
    return responseText;
  }
}
