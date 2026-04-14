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
};

const TOPIC_RULES: TopicRule[] = [
  {
    key: "running-training",
    canonicalKeyword: "跑步",
    topicTitle: "跑步与长期训练",
    keywords: ["跑步", "训练", "节奏", "配速", "恢复", "耐力"],
  },
  {
    key: "writing-observation",
    canonicalKeyword: "写作",
    topicTitle: "写作与观察表达",
    keywords: ["写作", "文字", "表达", "脑力", "观察"],
  },
  {
    key: "family-life",
    canonicalKeyword: "家庭",
    topicTitle: "家庭与生活节奏",
    keywords: ["家庭", "育儿", "父母", "孩子", "生活"],
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
      const candidateArticles = candidateArticleRepository
        .list()
        .filter((article) => article.status !== "discarded");
      const now = new Date().toISOString();

      const builtClusters = buildTopicClusters(candidateArticles, now);
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
  };
}

function buildTopicClusters(candidateArticles: CandidateArticle[], now: string) {
  const groups = new Map<
    string,
    { articles: CandidateArticle[]; rule?: TopicRule; fallbackKeyword?: string }
  >();

  for (const article of candidateArticles) {
    const rule = matchTopicRule(article);
    const fallbackKeyword = rule ? undefined : deriveFallbackKeyword(article);
    const groupKey = rule?.key ?? `single:${article.id}`;

    const current = groups.get(groupKey);

    if (current) {
      current.articles.push(article);
      continue;
    }

    groups.set(groupKey, {
      articles: [article],
      ...(rule ? { rule } : {}),
      ...(fallbackKeyword ? { fallbackKeyword } : {}),
    });
  }

  return Array.from(groups.values()).map((group) =>
    buildClusterFromGroup(group, now),
  );
}

function buildClusterFromGroup(
  group: {
    articles: CandidateArticle[];
    rule?: TopicRule;
    fallbackKeyword?: string;
  },
  now: string,
): TopicCluster {
  const articleIds = group.articles.map((article) => article.id);
  const keywords = Array.from(
    new Set([
      ...(group.rule ? [group.rule.canonicalKeyword] : []),
      ...collectSignalKeywords(group.articles),
    ]),
  ).slice(0, 5);

  const topicTitle = group.rule
    ? group.rule.topicTitle
    : `${group.fallbackKeyword ?? "主题"}观察`;

  return {
    id: randomUUID(),
    topicTitle,
    topicTitleSource: "rule_based",
    topicSummary: buildTopicSummary(group.articles, topicTitle),
    keywords: keywords.length > 0 ? keywords : [group.fallbackKeyword ?? "主题"],
    articleIds,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
}

function matchTopicRule(article: CandidateArticle) {
  const text = getArticleSearchText(article);
  return TOPIC_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
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
