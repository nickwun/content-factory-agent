import type { PlatformType } from "../types/platform.ts";
import {
  getDefaultPromptSetting,
  getDefaultPromptSettings,
} from "../generation/default-prompts.ts";
import type {
  PromptPresetCorpusSummary,
  PromptPresetCorpusFile,
  PlatformPromptPresetGroup,
  PlatformPromptSetting,
  PromptPresetIdByPlatform,
} from "./prompt-settings-types.ts";
import type { PromptPresetInput } from "../rewrite/prompt-preset-input.ts";
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

    attachPromptPresetCorpusFile(
      presetId: string,
      input: {
        fileName: string;
        mimeType: PromptPresetCorpusFile["mimeType"];
        extractedText: string;
        summary?: PromptPresetCorpusFile["summary"];
      },
    ) {
      return presetService.attachPromptPresetCorpusFile(presetId, input);
    },

    listPromptPresetCorpusFiles(presetId: string) {
      return presetService.listPromptPresetCorpusFiles(presetId);
    },

    replacePromptPresetCorpusFile(
      presetId: string,
      replaceFileId: string,
      input: {
        fileName: string;
        mimeType: PromptPresetCorpusFile["mimeType"];
        extractedText: string;
        summary?: PromptPresetCorpusFile["summary"];
      },
    ) {
      return presetService.replacePromptPresetCorpusFile(
        presetId,
        replaceFileId,
        input,
      );
    },

    deletePromptPresetCorpusFile(presetId: string, fileId: string) {
      return presetService.deletePromptPresetCorpusFile(presetId, fileId);
    },

    buildPromptPresetInput(presetId: string): PromptPresetInput {
      const preset = presetService.resolvePromptSettings(["wechat_article"], {
        wechat_article: presetId,
      })[0];

      const corpusFiles = preset.corpusFiles ?? [];
      const corpusSummary = mergeCorpusSummaries(corpusFiles);

      return {
        presetId: preset.id ?? presetId,
        name: preset.name ?? "默认",
        platform: "wechat_article",
        promptTemplate: preset.promptTemplate,
        corpusCount: corpusFiles.length,
        hasCorpus: corpusFiles.length > 0,
        corpusSummary,
      };
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

function mergeCorpusSummaries(corpusFiles: PromptPresetCorpusFile[]): PromptPresetCorpusSummary {
  const tone = mergeStringArrays(corpusFiles.map((file) => file.summary?.tone));
  const structure = mergeStringArrays(
    corpusFiles.map((file) => file.summary?.structure),
  );
  const reusablePhrases = mergeStringArrays(
    corpusFiles.map((file) => file.summary?.reusablePhrases),
  );
  const lengthHint =
    corpusFiles.find((file) => file.summary?.lengthHint)?.summary?.lengthHint ??
    undefined;

  return {
    ...(tone.length ? { tone } : {}),
    ...(structure.length ? { structure } : {}),
    ...(lengthHint ? { lengthHint } : {}),
    ...(reusablePhrases.length ? { reusablePhrases } : {}),
  };
}

function mergeStringArrays(values: Array<string[] | undefined>) {
  const merged: string[] = [];

  for (const items of values) {
    if (!items) {
      continue;
    }

    for (const item of items) {
      const normalized = item.trim();
      if (normalized && !merged.includes(normalized)) {
        merged.push(normalized);
      }
    }
  }

  return merged;
}
