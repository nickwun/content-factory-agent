import type { PlatformType } from "../types/platform.ts";
import type {
  PlatformPromptPresetGroup,
  PlatformPromptSetting,
  PromptPresetIdByPlatform,
} from "./prompt-settings-types.ts";

type PromptPresetRepository = {
  list(platforms?: PlatformType[]): PlatformPromptSetting[];
  getById(id: string): PlatformPromptSetting | null;
  getDefaultByPlatform(platform: PlatformType): PlatformPromptSetting | null;
  create(input: {
    id: string;
    platform: PlatformType;
    name: string;
    promptTemplate: string;
    isDefault: boolean;
    version?: string;
    createdAt: string;
    updatedAt: string;
  }): PlatformPromptSetting | null;
  update(
    id: string,
    input: { name?: string; promptTemplate?: string; updatedAt: string },
  ): PlatformPromptSetting | null;
  delete(id: string): number;
  countByPlatform(platform: PlatformType): number;
  setDefault(
    id: string,
    platform: PlatformType,
    updatedAt: string,
  ): PlatformPromptSetting | null;
  listGroups(platforms?: PlatformType[]): PlatformPromptPresetGroup[];
  resolveSelected(
    platforms: PlatformType[],
    selectedPresetIds?: PromptPresetIdByPlatform,
  ): Array<PlatformPromptSetting | null>;
};

type CreatePromptPresetInput = {
  platform: PlatformType;
  name: string;
  promptTemplate: string;
};

type UpdatePromptPresetInput = {
  name?: string;
  promptTemplate?: string;
};

export class PromptPresetError extends Error {
  readonly code:
    | "preset_not_found"
    | "duplicate_preset_name"
    | "last_preset_for_platform"
    | "invalid_preset_id";

  constructor(
    code:
      | "preset_not_found"
      | "duplicate_preset_name"
      | "last_preset_for_platform"
      | "invalid_preset_id",
    message: string,
  ) {
    super(message);
    this.name = "PromptPresetError";
    this.code = code;
  }
}

export function createPromptPresetService(repository: PromptPresetRepository) {
  return {
    listPromptPresetGroups(platforms?: PlatformType[]) {
      return repository.listGroups(platforms);
    },

    createPromptPreset(input: CreatePromptPresetInput) {
      const name = normalizePresetName(input.name);
      const promptTemplate = input.promptTemplate.trim();

      assertUniquePresetName(repository, input.platform, name);

      const now = new Date().toISOString();
      const created = repository.create({
        id: crypto.randomUUID(),
        platform: input.platform,
        name,
        promptTemplate,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      });

      if (!created) {
        throw new Error("Failed to create prompt preset");
      }

      return created;
    },

    updatePromptPreset(id: string, input: UpdatePromptPresetInput) {
      const current = repository.getById(id);
      if (!current) {
        throw new PromptPresetError("preset_not_found", "提示词预设不存在。");
      }

      const currentName = current.name ?? "默认";
      const currentId = current.id ?? id;
      const nextName =
        input.name !== undefined ? normalizePresetName(input.name) : currentName;
      const nextTemplate =
        input.promptTemplate !== undefined
          ? input.promptTemplate.trim()
          : current.promptTemplate;

      if (nextName !== currentName) {
        assertUniquePresetName(repository, current.platform, nextName, currentId);
      }

      const updated = repository.update(id, {
        name: nextName,
        promptTemplate: nextTemplate,
        updatedAt: new Date().toISOString(),
      });

      if (!updated) {
        throw new PromptPresetError("preset_not_found", "提示词预设不存在。");
      }

      return updated;
    },

    duplicatePromptPreset(id: string) {
      const current = repository.getById(id);
      if (!current) {
        throw new PromptPresetError("preset_not_found", "提示词预设不存在。");
      }

      const name = generateCopyName(
        repository,
        current.platform,
        current.name ?? "默认",
      );
      const now = new Date().toISOString();
      const duplicated = repository.create({
        id: crypto.randomUUID(),
        platform: current.platform,
        name,
        promptTemplate: current.promptTemplate,
        isDefault: false,
        version: current.version,
        createdAt: now,
        updatedAt: now,
      });

      if (!duplicated) {
        throw new Error("Failed to duplicate prompt preset");
      }

      return duplicated;
    },

    deletePromptPreset(id: string) {
      const current = repository.getById(id);
      if (!current) {
        throw new PromptPresetError("preset_not_found", "提示词预设不存在。");
      }

      if (repository.countByPlatform(current.platform) <= 1) {
        throw new PromptPresetError(
          "last_preset_for_platform",
          "每个平台至少需要保留一套提示词预设。",
        );
      }

      repository.delete(id);

      if (current.isDefault) {
        const fallback = repository
          .list([current.platform])
          .find((preset) => preset.id !== id);

        if (fallback) {
          repository.setDefault(
            fallback.id ?? "",
            fallback.platform,
            new Date().toISOString(),
          );
        }
      }
    },

    setDefaultPromptPreset(id: string) {
      const current = repository.getById(id);
      if (!current) {
        throw new PromptPresetError("preset_not_found", "提示词预设不存在。");
      }

      const updated = repository.setDefault(
        current.id ?? id,
        current.platform,
        new Date().toISOString(),
      );

      if (!updated) {
        throw new PromptPresetError("preset_not_found", "提示词预设不存在。");
      }

      return updated;
    },

    resolvePromptSettings(
      platforms: PlatformType[],
      selectedPresetIds?: PromptPresetIdByPlatform,
    ) {
      const resolved = repository.resolveSelected(platforms, selectedPresetIds);

      const missingPlatform = resolved.findIndex((preset) => preset === null);
      if (missingPlatform !== -1) {
        throw new PromptPresetError(
          "invalid_preset_id",
          `当前选择的提示词预设不存在或不属于目标平台，请重新选择后再试。`,
        );
      }

      return resolved.filter((preset): preset is PlatformPromptSetting => Boolean(preset));
    },

    updateDefaultPromptSetting(platform: PlatformType, promptTemplate: string) {
      const defaultPreset = repository.getDefaultByPlatform(platform);
      if (!defaultPreset) {
        throw new PromptPresetError("preset_not_found", "默认提示词预设不存在。");
      }

      return this.updatePromptPreset(defaultPreset.id ?? `default-${platform}`, {
        promptTemplate,
      });
    },

    resetDefaultPromptSetting(platform: PlatformType) {
      const defaultPreset = repository.getDefaultByPlatform(platform);
      if (!defaultPreset) {
        throw new PromptPresetError("preset_not_found", "默认提示词预设不存在。");
      }

      return this.updatePromptPreset(defaultPreset.id ?? `default-${platform}`, {
        promptTemplate: defaultPreset.defaultTemplate,
      });
    },
  };
}

function normalizePresetName(name: string) {
  const normalized = name.trim();

  if (!normalized) {
    throw new PromptPresetError(
      "duplicate_preset_name",
      "提示词预设名称不能为空。",
    );
  }

  return normalized;
}

function assertUniquePresetName(
  repository: Pick<PromptPresetRepository, "list">,
  platform: PlatformType,
  name: string,
  ignoreId?: string,
) {
  const duplicated = repository
    .list([platform])
    .find(
      (preset) =>
        preset.name === name && (ignoreId === undefined || preset.id !== ignoreId),
    );

  if (duplicated) {
    throw new PromptPresetError(
      "duplicate_preset_name",
      "同一平台下不能创建重名提示词预设。",
    );
  }
}

function generateCopyName(
  repository: Pick<PromptPresetRepository, "list">,
  platform: PlatformType,
  baseName: string,
) {
  const existingNames = new Set(
    repository.list([platform]).map((preset) => preset.name),
  );

  const initialName = `${baseName} 副本`;
  if (!existingNames.has(initialName)) {
    return initialName;
  }

  let index = 2;
  while (existingNames.has(`${baseName} 副本 ${index}`)) {
    index += 1;
  }

  return `${baseName} 副本 ${index}`;
}
