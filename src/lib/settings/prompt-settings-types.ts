import type { PlatformType } from "../types/platform.ts";

export type PromptPresetCorpusSummary = {
  tone?: string[];
  structure?: string[];
  lengthHint?: string;
  reusablePhrases?: string[];
};

export type PromptPresetCorpusFile = {
  id: string;
  fileName: string;
  mimeType:
    | "text/plain"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  extractedText: string;
  summary?: PromptPresetCorpusSummary;
  createdAt: string;
  updatedAt: string;
};

export type PlatformPromptSetting = {
  id?: string;
  platform: PlatformType;
  name?: string;
  promptTemplate: string;
  defaultTemplate: string;
  isDefault?: boolean;
  corpusFileIds?: string[];
  corpusFiles?: PromptPresetCorpusFile[];
  hasCorpus?: boolean;
  createdAt?: string;
  updatedAt: string;
  version?: string;
};

export type PromptPresetIdByPlatform = Partial<Record<PlatformType, string>>;

export type PlatformPromptPresetGroup = {
  platform: PlatformType;
  presets: PlatformPromptSetting[];
};
