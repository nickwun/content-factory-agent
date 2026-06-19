import type { PlatformType } from "../types/platform.ts";
import type {
  PlatformPromptPresetGroup,
  PromptPresetIdByPlatform,
} from "./prompt-settings-types.ts";

export function buildSelectedPromptPresetByPlatform(input: {
  selectedPlatforms: PlatformType[];
  presetGroups: PlatformPromptPresetGroup[];
  selectedPresetIds: PromptPresetIdByPlatform;
}) {
  const nextSelection: PromptPresetIdByPlatform = {};

  for (const platform of input.selectedPlatforms) {
    const group = input.presetGroups.find((item) => item.platform === platform);
    if (!group || group.presets.length === 0) {
      return {
        ok: false as const,
        errorMessage: `当前平台缺少可用提示词预设，请先到设置页补充。`,
      };
    }

    const selectedPresetId = input.selectedPresetIds[platform];
    if (selectedPresetId) {
      const selectedPreset = group.presets.find((preset) => preset.id === selectedPresetId);
      if (!selectedPreset) {
        return {
          ok: false as const,
          errorMessage: `当前选择的提示词预设已失效，请重新选择后再试。`,
        };
      }

      nextSelection[platform] = selectedPreset.id;
      continue;
    }

    const defaultPreset = group.presets.find((preset) => preset.isDefault);
    if (!defaultPreset) {
      return {
        ok: false as const,
        errorMessage: `当前平台缺少默认提示词预设，请先到设置页设置默认项。`,
      };
    }

    nextSelection[platform] = defaultPreset.id;
  }

  return {
    ok: true as const,
    selectedPromptPresetByPlatform: nextSelection,
  };
}
