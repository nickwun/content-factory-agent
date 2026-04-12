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
import type { PromptPresetIdByPlatform } from "../settings/prompt-settings-types.ts";
import type { RewriteMode } from "./generation-context.ts";
import {
  parseWechatFinalizationPayload,
  type WechatFinalizationOptions,
} from "./wechat-finalization.ts";

type GenerateRequestBody = {
  userPrompt?: unknown;
  selectedPlatforms?: unknown;
  rewriteSource?: unknown;
  selectedPromptPresetByPlatform?: unknown;
  wechatFinalization?: unknown;
};

export type ParsedGenerateRequest = {
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
  const userPrompt =
    typeof body.userPrompt === "string" ? body.userPrompt.trim() : "";
  const selectedPlatforms = Array.isArray(body.selectedPlatforms)
    ? body.selectedPlatforms.filter(
        (platform): platform is PlatformType =>
          typeof platform === "string" && isPlatformType(platform),
      )
    : [];

  if (!userPrompt || selectedPlatforms.length === 0) {
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

  return {
    userPrompt,
    selectedPlatforms,
    rewriteSource,
    selectedPromptPresetByPlatform,
    wechatFinalization,
  };
}

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
