"use client";

import type {
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
  onChange: (platform: PlatformType, presetId: string) => void;
  disabled?: boolean;
};

export function PromptPresetSelector({
  selectedPlatforms,
  presetGroups,
  selectedPresetIds,
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
            当前风格预设
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            只对当前已选平台显示。没手动选择时，会自动使用该平台默认预设。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {selectedPlatforms.map((platform) => {
          const group = presetGroups.find((item) => item.platform === platform);
          const defaultPresetId = group?.presets.find((preset) => preset.isDefault)?.id ?? "";
          const currentPresetId = selectedPresetIds[platform] ?? defaultPresetId;

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
                {(group?.presets ?? []).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                    {preset.isDefault ? "（默认）" : ""}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}
