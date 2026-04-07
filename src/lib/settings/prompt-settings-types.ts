import type { PlatformType } from "../types/platform.ts";

export type PlatformPromptSetting = {
  platform: PlatformType;
  promptTemplate: string;
  defaultTemplate: string;
  updatedAt: string;
  version?: string;
};
