import type { TopicCluster, TopicScore } from "./types.ts";

type TopicClusterRepository = {
  list: () => TopicCluster[];
};

type TopicScoreRepository = {
  list: () => TopicScore[];
  replaceAll: (scores: TopicScore[]) => TopicScore[];
};

export function createTopicScoreService(input: {
  topicClusterRepository: TopicClusterRepository;
  topicScoreRepository: TopicScoreRepository;
}) {
  const { topicClusterRepository, topicScoreRepository } = input;

  return {
    listTopicScores() {
      return topicScoreRepository.list();
    },

    scoreTopicClusters() {
      const clusters = topicClusterRepository.list();
      const now = new Date().toISOString();
      const scores = clusters.map((cluster) => buildTopicScore(cluster, now));
      return topicScoreRepository.replaceAll(scores);
    },

    listRankedTopicClusters() {
      const clusters = topicClusterRepository.list();
      const scores = topicScoreRepository.list();
      const scoreMap = new Map(scores.map((score) => [score.clusterId, score]));

      return clusters
        .map((cluster) => ({
          cluster,
          score:
            scoreMap.get(cluster.id) ??
            buildTopicScore(cluster, new Date().toISOString()),
        }))
        .sort((left, right) => right.score.totalScore - left.score.totalScore);
    },
  };
}

function buildTopicScore(cluster: TopicCluster, scoredAt: string): TopicScore {
  const noveltyScore = scoreNovelty(cluster);
  const fitScore = scoreFit(cluster);
  const evidenceScore = scoreEvidence(cluster);
  const rewritePotentialScore = scoreRewritePotential(cluster);
  const totalScore =
    noveltyScore + fitScore + evidenceScore + rewritePotentialScore;
  const reasons = buildReasons({
    cluster,
    evidenceScore,
    fitScore,
    noveltyScore,
    rewritePotentialScore,
  });

  return {
    clusterId: cluster.id,
    noveltyScore,
    fitScore,
    evidenceScore,
    rewritePotentialScore,
    totalScore,
    reasons,
    scoredAt,
  };
}

function scoreNovelty(cluster: TopicCluster) {
  if (cluster.topicTitleSource === "llm_generated") {
    return 18;
  }

  if (cluster.keywords.length >= 3) {
    return 16;
  }

  return 12;
}

function scoreFit(cluster: TopicCluster) {
  if (cluster.keywords.some((keyword) => ["跑步", "训练", "写作", "家庭"].includes(keyword))) {
    return 30;
  }

  return 22;
}

function scoreEvidence(cluster: TopicCluster) {
  if (cluster.articleIds.length >= 3) {
    return 26;
  }

  if (cluster.articleIds.length === 2) {
    return 22;
  }

  return 14;
}

function scoreRewritePotential(cluster: TopicCluster) {
  if (cluster.articleIds.length >= 2 && cluster.keywords.length >= 2) {
    return 24;
  }

  if (cluster.articleIds.length >= 2) {
    return 20;
  }

  return 15;
}

function buildReasons(input: {
  cluster: TopicCluster;
  noveltyScore: number;
  fitScore: number;
  evidenceScore: number;
  rewritePotentialScore: number;
}) {
  const reasons: string[] = [];

  if (input.cluster.articleIds.length >= 2) {
    reasons.push(`已有 ${input.cluster.articleIds.length} 篇候选文章支撑，证据强度更稳定。`);
  } else {
    reasons.push("当前只有单篇候选文章，仍可观察但支撑度偏弱。");
  }

  if (input.cluster.keywords.length >= 2) {
    reasons.push(`关键词已收敛到 ${input.cluster.keywords.slice(0, 3).join(" / ")}。`);
  }

  if (input.fitScore >= 30) {
    reasons.push("主题与当前公众号长期样本方向贴合度较高。");
  }

  if (input.rewritePotentialScore >= 24) {
    reasons.push("已有足够线索重构成长文，不必只依赖单篇原文。");
  }

  if (input.noveltyScore >= 16) {
    reasons.push("主题标题与关键词集中，可直接进入下一步筛选。");
  }

  return reasons.slice(0, 4);
}
