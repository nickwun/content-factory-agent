import type { RewriteTask, SourceAccount, TopicCluster } from "./types.ts";

export function buildTopicOverviewStats(input: {
  sourceAccounts: SourceAccount[];
  candidateArticleCount: number;
  topicClusters: TopicCluster[];
  rewriteTasks: RewriteTask[];
}) {
  return [
    {
      id: "open-clusters",
      label: "待确认主题数",
      value: input.topicClusters.filter((cluster) => cluster.status === "open").length,
    },
    {
      id: "running-rewrites",
      label: "进行中仿写数",
      value: input.rewriteTasks.filter((task) => task.status === "running").length,
    },
    {
      id: "source-accounts",
      label: "样本源数",
      value: input.sourceAccounts.length,
    },
    {
      id: "candidate-articles",
      label: "候选文章数",
      value: input.candidateArticleCount,
    },
  ];
}

export function getRewriteTaskStatusMeta(status: RewriteTask["status"]) {
  switch (status) {
    case "pending":
      return {
        label: "待进入创作",
        description: "等待送入创作中心主链路",
      };
    case "running":
      return {
        label: "生成中",
        description: "正在生成公众号稿件",
      };
    case "succeeded":
      return {
        label: "已生成",
        description: "已生成，可直接打开编辑",
      };
    case "failed":
      return {
        label: "生成失败",
        description: "生成失败，请查看错误信息",
      };
  }
}

export function buildTopicClusterHeaderMeta(input: {
  status: TopicCluster["status"];
  articleCount: number;
  totalScore?: number;
  topicTitleSource: TopicCluster["topicTitleSource"];
}) {
  return [
    {
      id: "status",
      label: getTopicClusterStatusLabel(input.status),
      emphasis: "normal" as const,
    },
    {
      id: "article-count",
      label: `${input.articleCount} 篇候选文章`,
      emphasis: "normal" as const,
    },
    {
      id: "total-score",
      label: `总分 ${input.totalScore ?? "--"}`,
      emphasis: "strong" as const,
    },
    {
      id: "title-source",
      label: input.topicTitleSource === "rule_based" ? "规则聚类" : input.topicTitleSource,
      emphasis: "subtle" as const,
    },
  ];
}

export function getTopicClusterStatusSortOrder(status: TopicCluster["status"]) {
  switch (status) {
    case "open":
      return 0;
    case "approved":
      return 1;
    case "rewritten":
      return 2;
    case "rejected":
      return 3;
  }
}

export function toReadableTopicReasons(reasons: string[]) {
  const worthDoing: string[] = [];
  const caution: string[] = [];

  for (const reason of reasons) {
    if (/(偏少|需要避免|注意|风险|不足)/.test(reason)) {
      caution.push(reason);
    } else {
      worthDoing.push(reason);
    }
  }

  return {
    worthDoing,
    caution,
  };
}

export function truncateRewriteTaskError(message: string, maxLength = 72) {
  if (message.length <= maxLength) {
    return message;
  }

  return `${message.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getTopicClusterStatusLabel(status: TopicCluster["status"]) {
  switch (status) {
    case "approved":
      return "已通过";
    case "rejected":
      return "已忽略";
    case "rewritten":
      return "已进入创作";
    default:
      return "待确认";
  }
}
