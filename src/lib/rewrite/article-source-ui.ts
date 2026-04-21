import type { PlatformType } from "../types/platform.ts";
import type { PromptPresetIdByPlatform } from "../settings/prompt-settings-types.ts";
import type { WechatFinalizationOptions } from "../generation/wechat-finalization.ts";
import {
  MAX_REWRITE_SOURCE_CHARS,
  RewriteSourceParseError,
  type RewriteSource,
} from "./rewrite-source.ts";

export type GenerateRequestSource = "composer_rewrite";

type BuildGenerateRequestPayloadInput = {
  requestSource?: GenerateRequestSource;
  userPrompt?: string;
  selectedPlatforms: PlatformType[];
  rewriteSource?: RewriteSource;
  selectedPromptPresetByPlatform?: PromptPresetIdByPlatform;
  wechatFinalization?: WechatFinalizationOptions;
};

export function buildGenerateRequestPayload(
  input: BuildGenerateRequestPayloadInput,
) {
  return {
    ...(input.requestSource ? { requestSource: input.requestSource } : {}),
    ...(typeof input.userPrompt === "string" && input.userPrompt.trim()
      ? { userPrompt: input.userPrompt.trim() }
      : {}),
    selectedPlatforms: input.selectedPlatforms,
    ...(input.rewriteSource ? { rewriteSource: input.rewriteSource } : {}),
    ...(input.selectedPromptPresetByPlatform
      ? { selectedPromptPresetByPlatform: input.selectedPromptPresetByPlatform }
      : {}),
    ...(input.wechatFinalization
      ? { wechatFinalization: input.wechatFinalization }
      : {}),
  };
}

export function buildArticleSourceSummary(source: RewriteSource) {
  return {
    sourceLabel:
      source.kind === "uploaded_file"
        ? source.sourceName || "上传文件"
        : source.sourceName || "直接粘贴文本",
    kindLabel: source.kind === "uploaded_file" ? "上传文件" : "粘贴文本",
    charCountLabel: `${source.charCount} 字`,
  };
}

export function buildRewriteSourceNotice(source: RewriteSource) {
  if (!source.truncated) {
    return null;
  }

  return `原文过长，已截取前 ${MAX_REWRITE_SOURCE_CHARS} 字用于本次仿写。`;
}

export function buildRewriteSourceErrorMessage(error: unknown) {
  if (error instanceof RewriteSourceParseError) {
    return error.message;
  }

  return "原文处理失败，请换一个文件或直接粘贴文本。";
}
