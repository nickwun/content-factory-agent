"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  PlatformPromptPresetGroup,
  PlatformPromptSetting,
} from "@/lib/settings/prompt-settings-types";
import type { PlatformType } from "@/lib/types/platform";

const PLATFORM_OPTIONS: Array<{ value: PlatformType; label: string }> = [
  { value: "wechat_article", label: "公众号" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "twitter", label: "Twitter" },
  { value: "video_script", label: "视频脚本" },
];

type PromptSettingsScreenProps = {
  initialPresetGroups: PlatformPromptPresetGroup[];
};

type StatusState = "idle" | "saving" | "saved" | "error";

export function PromptSettingsScreen({
  initialPresetGroups,
}: PromptSettingsScreenProps) {
  const [presetGroups, setPresetGroups] = useState(initialPresetGroups);
  const [activePlatform, setActivePlatform] = useState<PlatformType>(
    initialPresetGroups[0]?.platform ?? "wechat_article",
  );
  const [activePresetId, setActivePresetId] = useState<string>(
    resolveInitialActivePresetId(
      initialPresetGroups,
      initialPresetGroups[0]?.platform ?? "wechat_article",
    ),
  );
  const [status, setStatus] = useState<StatusState>("idle");

  const activeGroup = useMemo(
    () => presetGroups.find((group) => group.platform === activePlatform),
    [activePlatform, presetGroups],
  );
  const activePreset = activeGroup?.presets.find((preset) => preset.id === activePresetId);

  useEffect(() => {
    if (activePreset) {
      return;
    }

    const nextPresetId = resolveInitialActivePresetId(presetGroups, activePlatform);
    setActivePresetId(nextPresetId);
  }, [activePlatform, activePreset, presetGroups]);

  const statusLabel =
    status === "saving"
      ? "保存中..."
      : status === "saved"
        ? "已保存"
        : status === "error"
          ? "保存失败"
          : "编辑中";

  async function reloadPresetGroups(nextActivePresetId?: string) {
    const response = await fetch("/api/prompt-presets");
    if (!response.ok) {
      throw new Error("reload failed");
    }

    const data = (await response.json()) as {
      presetGroups: PlatformPromptPresetGroup[];
    };
    setPresetGroups(data.presetGroups);
    setActivePresetId(
      nextActivePresetId ??
        resolveInitialActivePresetId(data.presetGroups, activePlatform),
    );
  }

  async function handleCreatePreset() {
    if (!activeGroup) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch("/api/prompt-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: activePlatform,
          name: buildNextPresetName(activeGroup.presets),
          promptTemplate:
            activeGroup.presets.find((preset) => preset.isDefault)?.defaultTemplate ??
            activePreset?.defaultTemplate ??
            "",
        }),
      });

      if (!response.ok) {
        throw new Error("create failed");
      }

      const data = (await response.json()) as { preset: PlatformPromptSetting };
      await reloadPresetGroups(data.preset.id);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function handleSavePreset() {
    if (!activePreset) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(`/api/prompt-presets/${activePreset.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: activePreset.name,
          promptTemplate: activePreset.promptTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      await reloadPresetGroups(activePreset.id);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function handleDuplicatePreset() {
    if (!activePreset) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(
        `/api/prompt-presets/${activePreset.id}/duplicate`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("duplicate failed");
      }

      const data = (await response.json()) as { preset: PlatformPromptSetting };
      await reloadPresetGroups(data.preset.id);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function handleSetDefaultPreset() {
    if (!activePreset || activePreset.isDefault) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(
        `/api/prompt-presets/${activePreset.id}/set-default`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("set default failed");
      }

      await reloadPresetGroups(activePreset.id);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function handleDeletePreset() {
    if (!activePreset) {
      return;
    }

    if (!window.confirm(`确认删除提示词预设“${activePreset.name}”吗？`)) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(`/api/prompt-presets/${activePreset.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      await reloadPresetGroups();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[220px_280px_minmax(0,1fr)]">
      <aside className="rounded-[32px] border border-black/10 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Platforms
        </p>
        <div className="space-y-2">
          {PLATFORM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setActivePlatform(option.value);
                setActivePresetId(
                  resolveInitialActivePresetId(presetGroups, option.value),
                );
              }}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                activePlatform === option.value
                  ? "bg-slate-900 text-white"
                  : "bg-stone-100 text-slate-700 hover:bg-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </aside>

      <aside className="rounded-[32px] border border-black/10 bg-white/88 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Presets
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              为当前平台保留多套长期风格，不再覆盖旧 prompt。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleCreatePreset()}
            className="inline-flex min-w-[72px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            新增
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {activeGroup?.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setActivePresetId(preset.id ?? "")}
              className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                preset.id === activePresetId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-black/8 bg-stone-50 text-slate-700 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{preset.name}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
                    preset.id === activePresetId
                      ? "bg-white/14 text-white"
                      : preset.isDefault
                        ? "bg-amber-100 text-amber-700"
                        : "bg-white text-slate-400"
                  }`}
                >
                  {preset.isDefault ? "默认" : "预设"}
                </span>
              </div>
              <p
                className={`mt-2 line-clamp-2 text-xs leading-6 ${
                  preset.id === activePresetId ? "text-white/78" : "text-slate-500"
                }`}
              >
                {preset.promptTemplate}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <div className="rounded-[32px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Prompt Preset
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {activePreset?.name ?? "请选择一个预设"}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              在这里长期维护同平台不同风格。生成时可以直接选择，不需要覆盖旧内容。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] ${
                status === "saving"
                  ? "bg-amber-100 text-amber-700"
                  : status === "saved"
                    ? "bg-emerald-100 text-emerald-700"
                    : status === "error"
                      ? "bg-rose-100 text-rose-600"
                      : "bg-stone-100 text-slate-500"
              }`}
            >
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={() => void handleDuplicatePreset()}
              disabled={!activePreset}
              className="rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white"
            >
              复制
            </button>
            <button
              type="button"
              onClick={() => void handleSetDefaultPreset()}
              disabled={!activePreset || activePreset.isDefault}
              className="rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              设为默认
            </button>
            <button
              type="button"
              onClick={() => void handleDeletePreset()}
              disabled={!activeGroup || (activeGroup.presets.length <= 1)}
              className="rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              删除
            </button>
            <button
              type="button"
              onClick={() => void handleSavePreset()}
              disabled={!activePreset}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              保存
            </button>
          </div>
        </div>

        {activePreset ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-black/8 bg-stone-50/90 px-4 py-4">
              <label className="block">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  预设名称
                </p>
                <input
                  value={activePreset.name}
                  onChange={(event) =>
                    setPresetGroups((current) =>
                      current.map((group) =>
                        group.platform !== activePlatform
                          ? group
                          : {
                              ...group,
                              presets: group.presets.map((preset) =>
                                preset.id === activePreset.id
                                  ? { ...preset, name: event.target.value }
                                  : preset,
                              ),
                            },
                      ),
                    )
                  }
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                />
              </label>
            </div>

            <div className="rounded-[24px] border border-black/8 bg-stone-50/90 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                提示词模板
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                修改这里会影响该预设下后续的普通生成与仿写生成。
              </p>
            </div>

            <textarea
              value={activePreset.promptTemplate}
              onChange={(event) =>
                setPresetGroups((current) =>
                  current.map((group) =>
                    group.platform !== activePlatform
                      ? group
                      : {
                          ...group,
                          presets: group.presets.map((preset) =>
                            preset.id === activePreset.id
                              ? {
                                  ...preset,
                                  promptTemplate: event.target.value,
                                }
                              : preset,
                          ),
                        },
                  ),
                )
              }
              className="min-h-[480px] w-full resize-y rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,1),_rgba(247,242,234,0.86))] px-5 py-4 text-base leading-8 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
            />
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-black/10 bg-stone-50/90 px-5 py-6 text-sm leading-7 text-slate-500">
            当前平台还没有可编辑预设，请先创建一条。
          </div>
        )}
      </div>
    </section>
  );
}

function resolveInitialActivePresetId(
  groups: PlatformPromptPresetGroup[],
  platform: PlatformType,
) {
  const group = groups.find((item) => item.platform === platform);
  return (
    group?.presets.find((preset) => preset.isDefault)?.id ??
    group?.presets[0]?.id ??
    ""
  );
}

function buildNextPresetName(presets: PlatformPromptSetting[]) {
  const existingNames = new Set(presets.map((preset) => preset.name));
  if (!existingNames.has("新预设")) {
    return "新预设";
  }

  let index = 2;
  while (existingNames.has(`新预设 ${index}`)) {
    index += 1;
  }

  return `新预设 ${index}`;
}
