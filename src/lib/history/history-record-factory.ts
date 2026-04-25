import type { DraftGenerationInfo } from "../generation/generation-service.ts";
import type { RewriteSource } from "../rewrite/rewrite-source.ts";
import type {
  ContentProcessingMode,
  PlatformPromptSetting,
} from "../settings/prompt-settings-types.ts";
import type { HistoryRecord } from "../types/history.ts";
import type { PlatformType } from "../types/platform.ts";
import { createRandomId } from "../utils/create-random-id.ts";

export function createHistoryRecord(input: {
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  now: string;
  autoTitle: string;
  content: HistoryRecord["content"];
  promptSettings: PlatformPromptSetting[];
  generationInfo: DraftGenerationInfo;
  rewriteSource?: RewriteSource | null;
  traceContext?: HistoryRecord["traceContext"];
  processingMode?: ContentProcessingMode;
}): HistoryRecord {
  const settingsByPlatform = Object.fromEntries(
    input.promptSettings.map((setting) => [setting.platform, setting]),
  );

  return {
    id: createRandomId("history-record"),
    schemaVersion: 1,
    autoTitle: input.autoTitle,
    title: input.autoTitle,
    isCustomTitle: false,
    userPrompt: input.userPrompt,
    selectedPlatforms: input.selectedPlatforms,
    createdAt: input.now,
    updatedAt: input.now,
    generation: {
      generatorVersion: input.generationInfo.generatorVersion,
      modelProvider: input.generationInfo.modelProvider,
      modelName: input.generationInfo.modelName,
      generatedAt: input.now,
      processingMode: input.processingMode ?? "rewrite",
      hasRewriteSource: Boolean(input.rewriteSource),
      ...(input.rewriteSource
        ? {
            rewriteSourceKind: input.rewriteSource.kind,
            rewriteSourceName: input.rewriteSource.sourceName,
            rewriteSourceCharCount: input.rewriteSource.charCount,
            rewriteSourceTruncated: input.rewriteSource.truncated === true,
          }
        : {}),
      ...(input.generationInfo.rewriteMode
        ? {
            rewriteMode: input.generationInfo.rewriteMode,
            usedLongformRewrite: input.generationInfo.usedLongformRewrite === true,
            ...(typeof input.generationInfo.rewriteChunkCount === "number"
              ? { rewriteChunkCount: input.generationInfo.rewriteChunkCount }
              : {}),
            ...(input.generationInfo.rewriteBriefVersion
              ? { rewriteBriefVersion: input.generationInfo.rewriteBriefVersion }
              : {}),
          }
        : {}),
      ...(typeof input.generationInfo.wechatFinalizationEnabled === "boolean"
        ? {
            wechatFinalizationEnabled:
              input.generationInfo.wechatFinalizationEnabled,
            wechatFinalizationApplied:
              input.generationInfo.wechatFinalizationApplied === true,
            ...(typeof input.generationInfo.wechatFinalizationTargetMinWords ===
            "number"
              ? {
                  wechatFinalizationTargetMinWords:
                    input.generationInfo.wechatFinalizationTargetMinWords,
                }
              : {}),
            ...(typeof input.generationInfo.wechatFinalizationTargetMaxWords ===
            "number"
              ? {
                  wechatFinalizationTargetMaxWords:
                    input.generationInfo.wechatFinalizationTargetMaxWords,
                }
              : {}),
          }
        : {}),
      selectedPlatformsSnapshot: input.selectedPlatforms,
      promptSnapshotByPlatform: Object.fromEntries(
        input.selectedPlatforms.map((platform) => [
          platform,
          settingsByPlatform[platform]?.promptTemplate ?? "",
        ]),
      ),
      promptPresetIdByPlatform: Object.fromEntries(
        input.selectedPlatforms
          .filter((platform) => settingsByPlatform[platform]?.id)
          .map((platform) => [platform, settingsByPlatform[platform]?.id]),
      ),
      promptPresetNameByPlatform: Object.fromEntries(
        input.selectedPlatforms
          .filter((platform) => settingsByPlatform[platform]?.name)
          .map((platform) => [platform, settingsByPlatform[platform]?.name]),
      ),
      settingsVersionByPlatform: Object.fromEntries(
        input.selectedPlatforms
          .filter((platform) => settingsByPlatform[platform]?.version)
          .map((platform) => [platform, settingsByPlatform[platform]?.version]),
      ),
    },
    content: input.content,
    traceContext:
      input.traceContext ?? {
        sourceKind: "direct_create",
        ...(resolveCreatedFromPlatform(input.selectedPlatforms)
          ? {
              createdFromPlatform: resolveCreatedFromPlatform(
                input.selectedPlatforms,
              ),
            }
          : {}),
      },
    workspace: {
      activePlatform: input.selectedPlatforms[0] ?? "wechat_article",
      platformOrder: input.selectedPlatforms,
      lastViewedAt: input.now,
    },
  };
}

function resolveCreatedFromPlatform(selectedPlatforms: PlatformType[]) {
  return selectedPlatforms.includes("wechat_article")
    ? "wechat_article"
    : undefined;
}
