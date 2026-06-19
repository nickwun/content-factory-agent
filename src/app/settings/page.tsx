import { AppShell } from "@/components/layout/app-shell";
import { PublishCredentialsPanel } from "@/components/settings/publish-credentials-panel";
import { PromptSettingsScreen } from "@/components/settings/prompt-settings-screen";
import { listPublishSettings } from "@/lib/settings/publish-settings-server";
import { listPromptPresetGroups } from "@/lib/settings/prompt-settings-server";

export default function SettingsPage() {
  const initialPresetGroups = listPromptPresetGroups();
  const initialPublishSettings = listPublishSettings();

  return (
    <AppShell
      currentCenter="creative"
      currentPath="/settings"
      showUtilityNav={false}
      secondaryNavItems={[
        {
          id: "composer",
          label: "新建内容",
          href: "/?view=composer",
        },
        {
          id: "workspace",
          label: "文章编辑",
          href: "/?view=workspace",
        },
        {
          id: "settings",
          label: "设置",
          href: "/settings",
        },
      ]}
      currentSecondaryId="settings"
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Creative Center
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          创作中心 / 设置
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          这里统一承载创作中心的提示词配置、发布设置和生成相关规则，不负责选题池、候选文章或主题簇管理。
        </p>
      </div>

      <div className="space-y-6">
        <PromptSettingsScreen initialPresetGroups={initialPresetGroups} />
        <PublishCredentialsPanel initialSettings={initialPublishSettings} />
      </div>
    </AppShell>
  );
}
