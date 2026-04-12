import type { PlatformType } from "../types/platform.ts";

export type PlatformPromptSetting = {
  id?: string;
  platform: PlatformType;
  name?: string;
  promptTemplate: string;
  defaultTemplate: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt: string;
  version?: string;
};

export type PromptPresetIdByPlatform = Partial<Record<PlatformType, string>>;

export type PlatformPromptPresetGroup = {
  platform: PlatformType;
  presets: PlatformPromptSetting[];
};
