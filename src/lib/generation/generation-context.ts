import type { PlatformType } from "../types/platform";
import type { RewriteSource } from "../rewrite/rewrite-source";
import type { RewriteBrief } from "../rewrite/rewrite-brief-types";
import type { PlatformPromptSetting } from "../settings/prompt-settings-types";
import type { WechatFinalizationOptions } from "./wechat-finalization";

export type RewriteMode = "none" | "short_source" | "long_source";

export type BuildGenerationContextInput = {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  promptSettings: PlatformPromptSetting[];
  rewriteSource?: RewriteSource;
  rewriteMode?: RewriteMode;
  rewriteBrief?: RewriteBrief;
  rewriteChunkCount?: number;
  wechatFinalization?: WechatFinalizationOptions;
  now: string;
  generatorVersion: string;
};

export type GenerationContext = {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  promptSettings: Partial<Record<PlatformType, PlatformPromptSetting>>;
  rewriteSource?: RewriteSource;
  rewriteMode: RewriteMode;
  rewriteBrief?: RewriteBrief;
  rewriteChunkCount?: number;
  wechatFinalization?: WechatFinalizationOptions;
  now: string;
  generatorVersion: string;
};

export function buildGenerationContext(
  input: BuildGenerationContextInput,
): GenerationContext {
  const promptSettings = Object.fromEntries(
    input.promptSettings.map((setting) => [setting.platform, setting]),
  ) as Partial<Record<PlatformType, PlatformPromptSetting>>;

  return {
    userPrompt: input.userPrompt.trim(),
    selectedPlatforms: [...input.selectedPlatforms],
    promptSettings,
    rewriteSource: input.rewriteSource,
    rewriteMode: input.rewriteMode ?? (input.rewriteSource ? "short_source" : "none"),
    rewriteBrief: input.rewriteBrief,
    rewriteChunkCount: input.rewriteChunkCount,
    wechatFinalization: input.wechatFinalization,
    now: input.now,
    generatorVersion: input.generatorVersion,
  };
}
