import Link from "next/link";
import {
  APP_SHELL_NAV_BUTTON_CLASS,
  AppShell,
} from "@/components/layout/app-shell";
import { PublishCredentialsPanel } from "@/components/settings/publish-credentials-panel";
import { PromptSettingsScreen } from "@/components/settings/prompt-settings-screen";
import { listPublishSettings } from "@/lib/settings/publish-settings-server";
import { listPromptPresetGroups } from "@/lib/settings/prompt-settings-server";

export default function SettingsPage() {
  const initialPresetGroups = listPromptPresetGroups();
  const initialPublishSettings = listPublishSettings();

  return (
    <AppShell
      currentPath="/settings"
      rightNavLabel="文章编辑"
      rightNavHref="/?view=workspace"
      actions={
        <Link href="/?view=composer" className={APP_SHELL_NAV_BUTTON_CLASS}>
          新建内容
        </Link>
      }
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          按平台管理生成提示词
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          设置页首屏会一次性读取全部平台配置，后续只对当前平台执行保存或重置。
        </p>
      </div>

      <div className="space-y-6">
        <PromptSettingsScreen initialPresetGroups={initialPresetGroups} />
        <PublishCredentialsPanel initialSettings={initialPublishSettings} />
      </div>
    </AppShell>
  );
}
