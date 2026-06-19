import {
  parseRewriteSourcePayload,
  RewriteSourceParseError,
  type RewriteSource,
} from "../rewrite/rewrite-source.ts";
import { buildRewriteBrief } from "../rewrite/rewrite-brief.ts";
import {
  countParagraphGroups,
  chunkRewriteSourceText,
  type RewriteChunk,
} from "../rewrite/rewrite-chunking.ts";
import type { RewriteBrief } from "../rewrite/rewrite-brief-types.ts";
import { isPlatformType, type PlatformType } from "../types/platform.ts";
import {
  isContentProcessingMode,
  type ContentProcessingMode,
  type PlatformPromptSetting,
  type PromptPresetIdByPlatform,
} from "../settings/prompt-settings-types.ts";
import type { RewriteMode } from "./generation-context.ts";
import {
  parseWechatFinalizationPayload,
  type WechatFinalizationOptions,
} from "./wechat-finalization.ts";
import type { GenerateRequestSource } from "../rewrite/article-source-ui.ts";

type GenerateRequestBody = {
  requestSource?: unknown;
  processingMode?: unknown;
  userPrompt?: unknown;
  selectedPlatforms?: unknown;
  rewriteSource?: unknown;
  selectedPromptPresetByPlatform?: unknown;
  wechatFinalization?: unknown;
};

export type ParsedGenerateRequest = {
  requestSource?: GenerateRequestSource;
  processingMode: ContentProcessingMode;
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  rewriteSource?: RewriteSource;
  selectedPromptPresetByPlatform?: PromptPresetIdByPlatform;
  wechatFinalization?: WechatFinalizationOptions;
};

export type PreparedRewriteGeneration = {
  rewriteSource?: RewriteSource;
  rewriteMode: RewriteMode;
  rewriteBrief?: RewriteBrief;
  rewriteChunkCount?: number;
  usedLongformRewrite: boolean;
};

export type RewriteBriefExtractorInput = {
  chunks: RewriteChunk[];
  rewriteSource: RewriteSource;
};

export type RewriteBriefExtractor = (
  input: RewriteBriefExtractorInput,
) => Promise<RewriteBrief>;

export const LONGFORM_REWRITE_CHAR_THRESHOLD = 4_000;
export const LONGFORM_REWRITE_PARAGRAPH_GROUP_THRESHOLD = 12;

export class GenerateRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerateRequestValidationError";
  }
}

export function parseGenerateRequestPayload(
  body: GenerateRequestBody,
): ParsedGenerateRequest {
  const requestSource = parseRequestSource(body.requestSource);
  const processingMode = parseProcessingMode(body.processingMode, requestSource);
  const userPrompt =
    typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";
  const selectedPlatforms = Array.isArray(body.selectedPlatforms)
    ? body.selectedPlatforms.filter(
        (platform): platform is PlatformType =>
          typeof platform === "string" && isPlatformType(platform),
      )
    : [];

  if (requestSource !== "composer_rewrite" && (!userPrompt || selectedPlatforms.length === 0)) {
    throw new GenerateRequestValidationError(
      "userPrompt and selectedPlatforms are required",
    );
  }

  let rewriteSource: RewriteSource | undefined;
  let selectedPromptPresetByPlatform: PromptPresetIdByPlatform | undefined;
  let wechatFinalization: WechatFinalizationOptions | undefined;

  if (body.rewriteSource !== undefined) {
    try {
      rewriteSource = parseRewriteSourcePayload(body.rewriteSource);
    } catch (error) {
      if (error instanceof RewriteSourceParseError) {
        throw new GenerateRequestValidationError(error.message);
      }

      throw error;
    }
  }

  if (body.selectedPromptPresetByPlatform !== undefined) {
    if (
      !body.selectedPromptPresetByPlatform ||
      typeof body.selectedPromptPresetByPlatform !== "object" ||
      Array.isArray(body.selectedPromptPresetByPlatform)
    ) {
      throw new GenerateRequestValidationError(
        "selectedPromptPresetByPlatform must be an object",
      );
    }

    selectedPromptPresetByPlatform = Object.fromEntries(
      Object.entries(body.selectedPromptPresetByPlatform).flatMap(([platform, value]) => {
        if (!isPlatformType(platform)) {
          return [];
        }

        if (typeof value !== "string" || !value.trim()) {
          throw new GenerateRequestValidationError(
            `selectedPromptPresetByPlatform.${platform} must be a non-empty string`,
          );
        }

        return [[platform, value.trim()]];
      }),
    ) as PromptPresetIdByPlatform;
  }

  if (body.wechatFinalization !== undefined) {
    try {
      wechatFinalization = parseWechatFinalizationPayload(body.wechatFinalization);
    } catch (error) {
      throw new GenerateRequestValidationError(
        error instanceof Error
          ? error.message
          : "wechatFinalization payload is invalid",
      );
    }
  }

  if (requestSource !== "composer_rewrite" && !rewriteSource) {
    throw new GenerateRequestValidationError(
      "当前已下线无素材直接生成，请先提供素材并选择提示词预设。",
    );
  }

  if (requestSource === "composer_rewrite") {
    if (selectedPlatforms.length === 0) {
      throw new GenerateRequestValidationError(
        "新建内容页仿写请求必须至少选择一个输出平台。",
      );
    }

    if (userPrompt) {
      throw new GenerateRequestValidationError(
        "新建内容页不再支持前台手写仿写要求，请直接选择提示词预设后开始仿写。",
      );
    }

    if (!rewriteSource) {
      throw new GenerateRequestValidationError(
        "新建内容页仿写请求必须先提供素材。",
      );
    }

    if (!selectedPromptPresetByPlatform) {
      throw new GenerateRequestValidationError(
        "新建内容页仿写请求必须先选择提示词预设。",
      );
    }

    for (const platform of selectedPlatforms) {
      if (!selectedPromptPresetByPlatform[platform]) {
        throw new GenerateRequestValidationError(
          `新建内容页仿写请求缺少 ${platform} 的提示词预设。`,
        );
      }
    }
  }

  return {
    requestSource,
    processingMode,
    userPrompt,
    selectedPlatforms,
    rewriteSource,
    selectedPromptPresetByPlatform,
    wechatFinalization,
  };
}

export function assertPromptPresetsMatchProcessingMode(input: {
  processingMode: ContentProcessingMode;
  selectedPlatforms: PlatformType[];
  promptSettings: PlatformPromptSetting[];
}) {
  for (const platform of input.selectedPlatforms) {
    const setting = input.promptSettings.find((item) => item.platform === platform);

    if (!setting) {
      continue;
    }

    if (setting.processingMode !== input.processingMode) {
      const platformLabel = PLATFORM_LABELS[platform] ?? platform;
      throw new GenerateRequestValidationError(
        `当前处理方式与 ${platformLabel} 的提示词预设不匹配，请重新选择匹配的预设。`,
      );
    }
  }
}

function parseRequestSource(value: unknown): GenerateRequestSource | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "composer_rewrite") {
    return value;
  }

  throw new GenerateRequestValidationError("requestSource is invalid");
}

function parseProcessingMode(
  value: unknown,
  requestSource: GenerateRequestSource | undefined,
): ContentProcessingMode {
  if (value === undefined) {
    if (requestSource === "composer_rewrite") {
      throw new GenerateRequestValidationError("新建内容页请求必须明确处理方式。");
    }

    return "rewrite";
  }

  if (isContentProcessingMode(value)) {
    return value;
  }

  throw new GenerateRequestValidationError("processingMode is invalid");
}

const PLATFORM_LABELS: Record<PlatformType, string> = {
  wechat_article: "公众号",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  video_script: "视频脚本",
};

export async function prepareRewriteGeneration(
  rewriteSource?: RewriteSource,
  options: {
    extractRewriteBrief?: RewriteBriefExtractor;
  } = {},
): Promise<PreparedRewriteGeneration> {
  if (!rewriteSource) {
    return {
      rewriteMode: "none",
      usedLongformRewrite: false,
    };
  }

  const paragraphGroups = countParagraphGroups(rewriteSource.extractedText);
  const shouldUseLongformRewrite =
    rewriteSource.extractedText.length > LONGFORM_REWRITE_CHAR_THRESHOLD ||
    paragraphGroups > LONGFORM_REWRITE_PARAGRAPH_GROUP_THRESHOLD;

  if (!shouldUseLongformRewrite) {
    return {
      rewriteSource,
      rewriteMode: "short_source",
      usedLongformRewrite: false,
    };
  }

  const chunks = chunkRewriteSourceText(rewriteSource.extractedText);
  const rewriteBrief = options.extractRewriteBrief
    ? await options.extractRewriteBrief({
        chunks,
        rewriteSource,
      })
    : buildRewriteBrief(chunks);

  return {
    rewriteSource,
    rewriteMode: "long_source",
    rewriteBrief,
    rewriteChunkCount: chunks.length,
    usedLongformRewrite: true,
  };
}
