import type { PlatformType } from "../types/platform.ts";
import { getAppDatabase } from "../db/sqlite.ts";
import {
  createPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "./prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "./prompt-preset-repository.ts";
import {
  createPromptSettingsService,
  PromptPresetError,
  getDefaultPromptTemplates,
} from "./prompt-settings-service.ts";
import type {
  PlatformPromptPresetGroup,
  PlatformPromptSetting,
  PromptPresetIdByPlatform,
} from "./prompt-settings-types.ts";

function getPromptSettingsService() {
  const db = getAppDatabase();
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  const repository = createPromptPresetRepository(db);
  return createPromptSettingsService(repository);
}

export function listPromptSettings(
  platforms?: PlatformType[],
  selectedPresetIds?: PromptPresetIdByPlatform,
): PlatformPromptSetting[] {
  return getPromptSettingsService().listPromptSettings(
    platforms,
    selectedPresetIds,
  );
}

export function listPromptPresetGroups(
  platforms?: PlatformType[],
): PlatformPromptPresetGroup[] {
  return getPromptSettingsService().listPromptPresetGroups(platforms);
}

export function createPromptPreset(input: {
  platform: PlatformType;
  name: string;
  promptTemplate: string;
}) {
  return getPromptSettingsService().createPromptPreset(input);
}

export function updatePromptPreset(
  id: string,
  input: { name?: string; promptTemplate?: string },
) {
  return getPromptSettingsService().updatePromptPreset(id, input);
}

export function duplicatePromptPreset(id: string) {
  return getPromptSettingsService().duplicatePromptPreset(id);
}

export function deletePromptPreset(id: string) {
  return getPromptSettingsService().deletePromptPreset(id);
}

export function setDefaultPromptPreset(id: string) {
  return getPromptSettingsService().setDefaultPromptPreset(id);
}

export function updatePromptSetting(
  platform: PlatformType,
  promptTemplate: string,
) {
  return getPromptSettingsService().updatePromptSetting(platform, promptTemplate);
}

export function resetPromptSetting(platform: PlatformType) {
  return getPromptSettingsService().resetPromptSetting(platform);
}

export { PromptPresetError };
