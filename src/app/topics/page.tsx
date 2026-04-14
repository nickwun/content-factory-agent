import { AppShell } from "@/components/layout/app-shell";
import { TopicOverviewScreen } from "@/components/topics/topic-overview-screen";
import { getTopicCenterPageData } from "@/lib/topics/topic-center-page-data";

export default function TopicsPage() {
  const pageData = getTopicCenterPageData();

  return (
    <AppShell
      currentCenter="topics"
      currentPath="/topics"
      showUtilityNav={false}
      secondaryNavItems={[
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
      ]}
      currentSecondaryId="overview"
    >
      <div id="overview" className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Topic Center
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          选题中心 / 首页总览
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          /topics 继续作为选题中心首页 / 总览页保留。这里负责看全局：快速进入样本池和候选文章，并集中查看主题簇、评分、最小确认流与 RewriteTask 状态概览。
        </p>
      </div>

      <TopicOverviewScreen {...pageData} />
    </AppShell>
  );
}
