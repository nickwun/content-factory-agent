import { AppShell } from "@/components/layout/app-shell";
import { ExternalWechatPage } from "@/components/topics/external-wechat-page";

const TOPIC_SECONDARY_NAV_ITEMS = [
  {
    id: "overview",
    label: "首页总览",
    href: "/topics",
  },
  {
    id: "sources",
    label: "样本池",
    href: "/topics/sources",
  },
  {
    id: "articles",
    label: "候选文章",
    href: "/topics/articles",
  },
  {
    id: "wechat-hot",
    label: "公众号爆款抓取",
    href: "/topics/wechat-hot",
  },
] as const;

export default function TopicWechatHotPage() {
  return (
    <AppShell
      currentCenter="topics"
      currentPath="/topics/wechat-hot"
      showUtilityNav={false}
      secondaryNavItems={[...TOPIC_SECONDARY_NAV_ITEMS]}
      currentSecondaryId="wechat-hot"
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Topic Center
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          选题中心 / 公众号爆款抓取与分析
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          这里专门承接外部公众号爆款样本的完整研究链路：关键词抓取、正文补拉、结构化分析、勾选仿写素材，并进入创作中心生成公众号长文。
        </p>
      </div>

      <ExternalWechatPage />
    </AppShell>
  );
}
