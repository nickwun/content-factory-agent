"use client";

import { useState } from "react";

import type { PublishCredentialSetting } from "@/lib/settings/publish-settings-types";

type PublishCredentialsPanelProps = {
  initialSettings: PublishCredentialSetting[];
};

export function PublishCredentialsPanel({
  initialSettings,
}: PublishCredentialsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});

  async function saveSetting(
    key: PublishCredentialSetting["key"],
    value: string,
  ) {
    setStatus((current) => ({ ...current, [key]: "saving" }));

    try {
      const response = await fetch(`/api/publish-settings/${key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      const data = (await response.json()) as { setting: PublishCredentialSetting };
      setSettings((current) =>
        current.map((setting) => (setting.key === key ? data.setting : setting)),
      );
      setStatus((current) => ({ ...current, [key]: "saved" }));
    } catch {
      setStatus((current) => ({ ...current, [key]: "error" }));
    }
  }

  return (
    <div className="rounded-[32px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Publish Credentials
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          发布凭证配置
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          发布相关凭证统一存放在 SQLite 设置页，不走环境变量 fallback；飞书发布使用服务端 App ID / App Secret 换取官方 tenant_access_token。
        </p>
      </div>

      <div className="space-y-4">
        {settings.map((setting) => {
          const currentStatus = status[setting.key] ?? "idle";
          const statusLabel =
            currentStatus === "saving"
              ? "保存中..."
              : currentStatus === "saved"
                ? "已保存"
                : currentStatus === "error"
                  ? "保存失败"
                  : "未保存";

          return (
            <div
              key={setting.key}
              className="rounded-[24px] border border-black/8 bg-stone-50/90 p-4"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {setting.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {setting.description}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                  {statusLabel}
                </span>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <input
                  type={setting.key.endsWith("secret") ? "password" : "text"}
                  value={setting.value}
                  onChange={(event) =>
                    setSettings((current) =>
                      current.map((item) =>
                        item.key === setting.key
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="请输入配置值"
                />
                <button
                  type="button"
                  onClick={() => void saveSetting(setting.key, setting.value)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  保存
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
