import { randomUUID } from "node:crypto";

import type { CandidateArticle, TopicCluster } from "./types.ts";

type CandidateArticleRepository = {
  list: () => CandidateArticle[];
  updateStatusByIds: (
    ids: string[],
    status: CandidateArticle["status"],
  ) => number;
};

type TopicClusterRepository = {
  list: () => TopicCluster[];
  getById: (id: string) => TopicCluster | null;
  replaceAll: (clusters: TopicCluster[]) => TopicCluster[];
  updateStatus: (
    id: string,
    status: TopicCluster["status"],
    updatedAt: string,
  ) => TopicCluster | null;
};

type TopicRule = {
  key: string;
  canonicalKeyword: string;
  topicTitle: string;
  keywords: string[];
  subtopics?: Array<{
    key: string;
    topicTitle: string;
    keywords: string[];
  }>;
};

const TOPIC_RULES: TopicRule[] = [
  {
    key: "running-training",
    canonicalKeyword: "跑步",
    topicTitle: "跑步与长期训练",
    keywords: ["跑步", "训练", "节奏", "配速", "恢复", "耐力"],
    subtopics: [
      {
        key: "pace-recovery",
        topicTitle: "跑步训练：配速与恢复",
        keywords: ["配速", "恢复", "节奏", "耐力"],
      },
      {
        key: "race-prep",
        topicTitle: "跑步训练：比赛与备赛",
        keywords: ["比赛", "备赛", "跑量", "赛前", "赛后"],
      },
      {
        key: "gear-data",
        topicTitle: "跑步训练：装备与数据",
        keywords: ["跑鞋", "碳板", "步频", "心率", "手表", "装备", "数据"],
      },
    ],
  },
  {
    key: "writing-observation",
    canonicalKeyword: "写作",
    topicTitle: "写作与观察表达",
    keywords: ["写作", "文字", "表达", "脑力", "观察"],
    subtopics: [
      {
        key: "writing-craft",
        topicTitle: "写作与表达方法",
        keywords: ["写作", "表达", "文字", "句子", "结构"],
      },
      {
        key: "brain-habit",
        topicTitle: "写作与脑力习惯",
        keywords: ["脑力", "习惯", "整理", "复盘", "观察"],
      },
    ],
  },
  {
    key: "family-life",
    canonicalKeyword: "家庭",
    topicTitle: "家庭与生活节奏",
    keywords: ["家庭", "育儿", "父母", "孩子", "生活"],
    subtopics: [
      {
        key: "parenting",
        topicTitle: "家庭生活：育儿与陪伴",
        keywords: ["育儿", "孩子", "陪伴", "父母"],
      },
      {
        key: "daily-rhythm",
        topicTitle: "家庭生活：节奏与日常",
        keywords: ["生活", "日常", "节奏", "家务"],
      },
    ],
  },
];

export function createTopicClusterService(input: {
  candidateArticleRepository: CandidateArticleRepository;
  topicClusterRepository: TopicClusterRepository;
}) {
  const { candidateArticleRepository, topicClusterRepository } = input;

  return {
    listTopicClusters() {
      return topicClusterRepository.list();
    },

    rebuildTopicClusters() {
      const existingClusters = topicClusterRepository.list();
      const candidateArticles = candidateArticleRepository
        .list()
        .filter((article) => article.status !== "discarded");
      const now = new Date().toISOString();

      const builtClusters = buildTopicClusters(candidateArticles, existingClusters, now);
      const clusters = topicClusterRepository.replaceAll(builtClusters);

      candidateArticleRepository.updateStatusByIds(
        candidateArticles.map((article) => article.id),
        "clustered",
      );

      return clusters;
    },

    rejectTopicCluster(id: string) {
      const cluster = topicClusterRepository.getById(id);

      if (!cluster) {
        return null;
      }

      return topicClusterRepository.updateStatus(
        id,
        "rejected",
        new Date().toISOString(),
      );
    },

    reactivateTopicCluster(id: string) {
      const cluster = topicClusterRepository.getById(id);

      if (!cluster) {
        return null;
      }

      if (cluster.status !== "rejected") {
        return cluster;
      }

      return topicClusterRepository.updateStatus(
        id,
        "open",
        new Date().toISOString(),
      );
    },
  };
}

function buildTopicClusters(
  candidateArticles: CandidateArticle[],
  existingClusters: TopicCluster[],
  now: string,
) {
  const groups = new Map<
    string,
    {
      articles: CandidateArticle[];
      rule?: TopicRule;
      subtopic?: NonNullable<TopicRule["subtopics"]>[number];
      fallbackKeyword?: string;
    }
  >();
  const existingClusterByTitle = new Map(
    existingClusters.map((cluster) => [cluster.topicTitle, cluster]),
  );

  for (const article of candidateArticles) {
    const rule = matchTopicRule(article);
    const subtopic = rule ? matchTopicSubtopic(rule, article) : undefined;
    const fallbackKeyword = deriveFallbackKeyword(article);
    const groupKey = rule
      ? subtopic
        ? `${rule.key}:${subtopic.key}`
        : `${rule.key}:source:${article.sourceAccountId}`
      : `single:${article.id}`;

    const current = groups.get(groupKey);

    if (current) {
      current.articles.push(article);
      continue;
    }

    groups.set(groupKey, {
      articles: [article],
      ...(rule ? { rule } : {}),
      ...(subtopic ? { subtopic } : {}),
      ...(fallbackKeyword ? { fallbackKeyword } : {}),
    });
  }

  return Array.from(groups.values()).map((group) =>
    buildClusterFromGroup(group, existingClusterByTitle, now),
  );
}

function buildClusterFromGroup(
  group: {
    articles: CandidateArticle[];
    rule?: TopicRule;
    subtopic?: NonNullable<TopicRule["subtopics"]>[number];
    fallbackKeyword?: string;
  },
  existingClusterByTitle: Map<string, TopicCluster>,
  now: string,
): TopicCluster {
  const articleIds = group.articles.map((article) => article.id);
  const keywords = Array.from(
    new Set([
      ...(group.rule ? [group.rule.canonicalKeyword] : []),
      ...(group.subtopic?.keywords.slice(0, 2) ?? []),
      ...collectSignalKeywords(group.articles),
    ]),
  ).slice(0, 5);

  const topicTitle = group.rule
    ? group.subtopic?.topicTitle ??
      `${group.rule.topicTitle}：${group.fallbackKeyword ?? "来源观察"}`
    : `${group.fallbackKeyword ?? "主题"}观察`;
  const existingCluster = existingClusterByTitle.get(topicTitle);

  return {
    id: existingCluster?.id ?? randomUUID(),
    topicTitle,
    topicTitleSource: "rule_based",
    topicSummary: buildTopicSummary(group.articles, topicTitle),
    keywords: keywords.length > 0 ? keywords : [group.fallbackKeyword ?? "主题"],
    articleIds,
    status: existingCluster?.status ?? "open",
    createdAt: existingCluster?.createdAt ?? now,
    updatedAt: now,
  };
}

function matchTopicRule(article: CandidateArticle) {
  const text = getArticleSearchText(article);
  return TOPIC_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
}

function matchTopicSubtopic(rule: TopicRule, article: CandidateArticle) {
  if (!rule.subtopics || rule.subtopics.length === 0) {
    return undefined;
  }

  const text = getArticleSearchText(article);
  return rule.subtopics.find((subtopic) =>
    subtopic.keywords.some((keyword) => text.includes(keyword)),
  );
}

function collectSignalKeywords(articles: CandidateArticle[]) {
  const keywords: string[] = [];

  for (const article of articles) {
    const text = getArticleSearchText(article);
    for (const rule of TOPIC_RULES) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          keywords.push(keyword);
        }
      }
    }

    const fallback = deriveFallbackKeyword(article);
    if (fallback) {
      keywords.push(fallback);
    }
  }

  return keywords.filter(Boolean);
}

function deriveFallbackKeyword(article: CandidateArticle) {
  const value = article.title
    .replace(/[：:，,。.!！?？、“”"'‘’（）()]/g, " ")
    .split(/\s+/)
    .find((token) => token.trim().length >= 2);

  return value?.trim().slice(0, 8) ?? "主题";
}

function buildTopicSummary(articles: CandidateArticle[], topicTitle: string) {
  const representative = articles[0]?.excerpt ?? articles[0]?.title ?? "";
  return `${topicTitle}相关候选文章 ${articles.length} 篇，当前以「${representative.slice(
    0,
    36,
  )}」为代表样本。`;
}

function getArticleSearchText(article: CandidateArticle) {
  return [article.title, article.excerpt, article.contentMarkdown]
    .filter(Boolean)
    .join("\n")
    .toLocaleLowerCase();
}
