import type { PlatformType } from "../types/platform";

export type PlatformPromptSetting = {
  platform: PlatformType;
  promptTemplate: string;
  defaultTemplate: string;
  updatedAt: string;
  version?: string;
};

export type BuildGenerationContextInput = {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  promptSettings: PlatformPromptSetting[];
  now: string;
  generatorVersion: string;
};

export type GenerationContext = {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  promptSettings: Partial<Record<PlatformType, PlatformPromptSetting>>;
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
    now: input.now,
    generatorVersion: input.generatorVersion,
  };
}
