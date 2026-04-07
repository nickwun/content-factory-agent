import type { PlatformType } from "../types/platform.ts";
import { getAppDatabase } from "../db/sqlite.ts";
import {
  createPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "./prompt-settings-repository.ts";
import {
  createPromptSettingsService,
  getDefaultPromptTemplates,
} from "./prompt-settings-service.ts";

function getPromptSettingsService() {
  const db = getAppDatabase();
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const repository = createPromptSettingsRepository(db);
  return createPromptSettingsService(repository);
}

export function listPromptSettings(platforms?: PlatformType[]) {
  return getPromptSettingsService().listPromptSettings(platforms);
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
