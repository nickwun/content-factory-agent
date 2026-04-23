"use client";

import type {
  ContentProcessingMode,
  PlatformPromptPresetGroup,
  PromptPresetIdByPlatform,
} from "@/lib/settings/prompt-settings-types";
import type { PlatformType } from "@/lib/types/platform";

const PLATFORM_LABELS: Record<PlatformType, string> = {
  wechat_article: "公众号",
  xiaohongshu: "小红书",
  twitter: "Twitter",
  video_script: "视频脚本",
};

type PromptPresetSelectorProps = {
  selectedPlatforms: PlatformType[];
  presetGroups: PlatformPromptPresetGroup[];
  selectedPresetIds: PromptPresetIdByPlatform;
  processingMode: ContentProcessingMode;
  onChange: (platform: PlatformType, presetId: string) => void;
  disabled?: boolean;
};

export function PromptPresetSelector({
  selectedPlatforms,
  presetGroups,
  selectedPresetIds,
  processingMode,
  onChange,
  disabled = false,
}: PromptPresetSelectorProps) {
  if (selectedPlatforms.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[24px] border border-black/8 bg-stone-50/85 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            提示词预设（必选）
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            只对当前已选平台显示。生成前，请为每个已选平台明确指定一套匹配当前处理方式的提示词预设。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {selectedPlatforms.map((platform) => {
          const group = presetGroups.find((item) => item.platform === platform);
          const availablePresets = (group?.presets ?? []).filter(
            (preset) => preset.processingMode === processingMode,
          );
          const currentPresetId = selectedPresetIds[platform] ?? "";

          return (
            <label
              key={platform}
              className="grid gap-2 rounded-[20px] border border-black/8 bg-white px-4 py-3"
            >
              <span className="text-sm font-semibold text-slate-900">
                {PLATFORM_LABELS[platform]}
              </span>
              <select
                value={currentPresetId}
                disabled={disabled}
                onChange={(event) => onChange(platform, event.target.value)}
                className={`rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none ${
                  disabled
                    ? "cursor-not-allowed bg-stone-100 text-slate-400"
                    : "bg-stone-50 text-slate-700"
                }`}
              >
                <option value="">
                  请选择 {PLATFORM_LABELS[platform]} 的提示词预设
                </option>
                {availablePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                    {preset.isDefault ? "（默认）" : ""}
                  </option>
                ))}
              </select>
              {availablePresets.length === 0 ? (
                <span className="text-xs leading-6 text-rose-500">
                  当前处理方式下还没有可用的提示词预设，请先到设置页创建。
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
