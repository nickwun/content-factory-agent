import { AppShell } from "@/components/layout/app-shell";
import { SourceAccountPage } from "@/components/topics/source-account-page";
import { getTopicCenterPageData } from "@/lib/topics/topic-center-page-data";

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

export default async function TopicSourcesPage() {
  const pageData = await getTopicCenterPageData();

  return (
    <AppShell
      currentCenter="topics"
      currentPath="/topics/sources"
      showUtilityNav={false}
      secondaryNavItems={[...TOPIC_SECONDARY_NAV_ITEMS]}
      currentSecondaryId="sources"
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Topic Center
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          选题中心 / 样本池
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          这里专门管理固定样本源，负责新增、编辑、启用、暂停观察和删除。首页总览继续保留全局判断，这里只处理样本池细活。
        </p>
      </div>

      <SourceAccountPage {...pageData} />
    </AppShell>
  );
}
