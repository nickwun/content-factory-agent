"use client";

import { useMemo, useState } from "react";

import type { PlatformPromptSetting } from "@/lib/settings/prompt-settings-types";
import type { PlatformType } from "@/lib/types/platform";

const PLATFORM_OPTIONS: Array<{ value: PlatformType; label: string }> = [
  { value: "wechat_article", label: "公众号" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "twitter", label: "Twitter" },
  { value: "video_script", label: "视频脚本" },
];

type PromptSettingsScreenProps = {
  initialSettings: PlatformPromptSetting[];
};

export function PromptSettingsScreen({
  initialSettings,
}: PromptSettingsScreenProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [activePlatform, setActivePlatform] = useState<PlatformType>(
    initialSettings[0]?.platform ?? "wechat_article",
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const activeSetting = useMemo(
    () => settings.find((setting) => setting.platform === activePlatform),
    [activePlatform, settings],
  );

  const statusLabel =
    status === "saving"
      ? "保存中..."
      : status === "saved"
        ? "已保存"
        : status === "error"
          ? "保存失败"
          : "编辑中";

  async function saveCurrentSetting() {
    if (!activeSetting) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(`/api/prompt-settings/${activePlatform}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptTemplate: activeSetting.promptTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      const data = (await response.json()) as { setting: PlatformPromptSetting };
      setSettings((current) =>
        current.map((setting) =>
          setting.platform === activePlatform ? data.setting : setting,
        ),
      );
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function resetCurrentSetting() {
    setStatus("saving");

    try {
      const response = await fetch(
        `/api/prompt-settings/${activePlatform}/reset`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("reset failed");
      }

      const data = (await response.json()) as { setting: PlatformPromptSetting };
      setSettings((current) =>
        current.map((setting) =>
          setting.platform === activePlatform ? data.setting : setting,
        ),
      );
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-[32px] border border-black/10 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <p className="mb-4 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Platforms
        </p>
        <div className="space-y-2">
          {PLATFORM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActivePlatform(option.value)}
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

      <div className="rounded-[32px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Prompt Setting
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {PLATFORM_OPTIONS.find((option) => option.value === activePlatform)?.label}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              这里编辑的是该平台的提示词模板，也就是生成时使用的规则、语气和结构偏好。
            </p>
          </div>
          <div className="flex items-center gap-3">
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
              onClick={resetCurrentSetting}
              className="rounded-full border border-black/8 bg-stone-100 px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-700"
            >
              重置
            </button>
            <button
              type="button"
              onClick={saveCurrentSetting}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              保存
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-[24px] border border-black/8 bg-stone-50/90 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            提示词模板
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            修改后会影响该平台后续的 mock 生成结果，适合在这里维护平台专属生成规则。
          </p>
        </div>

        <textarea
          value={activeSetting?.promptTemplate ?? ""}
          onChange={(event) =>
            setSettings((current) =>
              current.map((setting) =>
                setting.platform === activePlatform
                  ? { ...setting, promptTemplate: event.target.value }
                  : setting,
              ),
            )
          }
          className="min-h-[480px] w-full resize-y rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,1),_rgba(247,242,234,0.86))] px-5 py-4 text-base leading-8 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
        />
      </div>
    </section>
  );
}
