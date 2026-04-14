import { AppShell } from "@/components/layout/app-shell";
import { CandidateArticlePage } from "@/components/topics/candidate-article-page";
import { getTopicCenterPageData } from "@/lib/topics/topic-center-page-data";

export default function TopicArticlesPage() {
  const pageData = getTopicCenterPageData();

  return (
    <AppShell
      currentCenter="topics"
      currentPath="/topics/articles"
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
      currentSecondaryId="articles"
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
          Topic Center
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          选题中心 / 候选文章
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-8 text-slate-500">
          这里专门承接候选文章入库与查看，包括手动导入、文件导入、多文件汇总反馈，以及最近入库文章池。
        </p>
      </div>

      <CandidateArticlePage {...pageData} />
    </AppShell>
  );
}
