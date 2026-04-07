import type { PlatformType } from "../types/platform.ts";
import {
  getDefaultPromptSetting,
  getDefaultPromptSettings,
} from "../generation/default-prompts.ts";
import type { PlatformPromptSetting } from "./prompt-settings-types.ts";

type PromptSettingsRepository = {
  list(platforms?: PlatformType[]): PlatformPromptSetting[];
  update(platform: PlatformType, promptTemplate: string): PlatformPromptSetting;
  reset(platform: PlatformType): PlatformPromptSetting;
};

export function createPromptSettingsService(
  repository: PromptSettingsRepository,
) {
  return {
    listPromptSettings(platforms?: PlatformType[]) {
      return repository.list(platforms);
    },

    updatePromptSetting(platform: PlatformType, promptTemplate: string) {
      return repository.update(platform, promptTemplate);
    },

    resetPromptSetting(platform: PlatformType) {
      return repository.reset(platform);
    },
  };
}

export function getDefaultPromptTemplates() {
  return getDefaultPromptSettings([
    "wechat_article",
    "xiaohongshu",
    "twitter",
    "video_script",
  ]);
}

export function getDefaultPromptTemplate(platform: PlatformType) {
  return getDefaultPromptSetting(platform);
}
