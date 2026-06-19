import type { PlatformType } from "../types/platform.ts";

export const CONTENT_PROCESSING_MODES = [
  "rewrite",
  "translate_to_zh_article",
] as const;

export type ContentProcessingMode = (typeof CONTENT_PROCESSING_MODES)[number];

export function isContentProcessingMode(
  value: unknown,
): value is ContentProcessingMode {
  return (
    typeof value === "string" &&
    CONTENT_PROCESSING_MODES.includes(value as ContentProcessingMode)
  );
}

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
  processingMode: ContentProcessingMode;
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
