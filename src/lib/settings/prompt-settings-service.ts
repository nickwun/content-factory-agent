import type { PlatformType } from "../types/platform.ts";
import {
  getDefaultPromptSetting,
  getDefaultPromptSettings,
} from "../generation/default-prompts.ts";
import type {
  PlatformPromptPresetGroup,
  PlatformPromptSetting,
  PromptPresetIdByPlatform,
} from "./prompt-settings-types.ts";
import { createPromptPresetService } from "./prompt-preset-service.ts";

type PromptPresetRepository = Parameters<typeof createPromptPresetService>[0];

export { PromptPresetError } from "./prompt-preset-service.ts";

export function createPromptSettingsService(repository: PromptPresetRepository) {
  const presetService = createPromptPresetService(repository);

  return {
    listPromptSettings(
      platforms?: PlatformType[],
      selectedPresetIds?: PromptPresetIdByPlatform,
    ): PlatformPromptSetting[] {
      if (!platforms || platforms.length === 0) {
        return presetService
          .listPromptPresetGroups()
          .flatMap((group) =>
            group.presets.filter((preset) => preset.isDefault),
          );
      }

      return presetService.resolvePromptSettings(platforms, selectedPresetIds);
    },

    listPromptPresetGroups(platforms?: PlatformType[]): PlatformPromptPresetGroup[] {
      return presetService.listPromptPresetGroups(platforms);
    },

    createPromptPreset(input: {
      platform: PlatformType;
      name: string;
      promptTemplate: string;
    }) {
      return presetService.createPromptPreset(input);
    },

    updatePromptPreset(
      id: string,
      input: {
        name?: string;
        promptTemplate?: string;
      },
    ) {
      return presetService.updatePromptPreset(id, input);
    },

    duplicatePromptPreset(id: string) {
      return presetService.duplicatePromptPreset(id);
    },

    deletePromptPreset(id: string) {
      return presetService.deletePromptPreset(id);
    },

    setDefaultPromptPreset(id: string) {
      return presetService.setDefaultPromptPreset(id);
    },

    updatePromptSetting(platform: PlatformType, promptTemplate: string) {
      return presetService.updateDefaultPromptSetting(platform, promptTemplate);
    },

    resetPromptSetting(platform: PlatformType) {
      return presetService.resetDefaultPromptSetting(platform);
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
  return getDefaultPromptSetting(platform).promptTemplate;
}
