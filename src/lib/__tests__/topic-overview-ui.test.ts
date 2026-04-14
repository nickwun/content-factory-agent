import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTopicOverviewStats,
  buildTopicClusterHeaderMeta,
  getRewriteTaskStatusMeta,
  truncateRewriteTaskError,
  toReadableTopicReasons,
} from "../topics/topic-overview-ui.ts";
import type { RewriteTask, SourceAccount, TopicCluster } from "../topics/types.ts";

test("buildTopicOverviewStats summarizes open clusters, running tasks, sources, and candidate articles", () => {
  const sourceAccounts = [{ id: "s1" }, { id: "s2" }] as SourceAccount[];
  const topicClusters = [
    { id: "c1", status: "open" },
    { id: "c2", status: "approved" },
    { id: "c3", status: "open" },
  ] as TopicCluster[];
  const rewriteTasks = [
    { id: "r1", status: "running" },
    { id: "r2", status: "failed" },
    { id: "r3", status: "pending" },
  ] as RewriteTask[];

  const stats = buildTopicOverviewStats({
    sourceAccounts,
    candidateArticleCount: 7,
    topicClusters,
    rewriteTasks,
  });

  assert.deepEqual(stats, [
    { id: "open-clusters", label: "待确认主题数", value: 2 },
    { id: "running-rewrites", label: "进行中仿写数", value: 1 },
    { id: "source-accounts", label: "样本源数", value: 2 },
    { id: "candidate-articles", label: "候选文章数", value: 7 },
  ]);
});

test("getRewriteTaskStatusMeta returns readable status copy", () => {
  assert.deepEqual(getRewriteTaskStatusMeta("pending"), {
    label: "待进入创作",
    description: "等待送入创作中心主链路",
  });
  assert.deepEqual(getRewriteTaskStatusMeta("running"), {
    label: "生成中",
    description: "正在生成公众号稿件",
  });
  assert.deepEqual(getRewriteTaskStatusMeta("succeeded"), {
    label: "已生成",
    description: "已生成，可直接打开编辑",
  });
  assert.deepEqual(getRewriteTaskStatusMeta("failed"), {
    label: "生成失败",
    description: "生成失败，请查看错误信息",
  });
});

test("toReadableTopicReasons highlights worth-doing reasons and caution reasons", () => {
  const readable = toReadableTopicReasons([
    "样本源集中，说明题目在核心池里重复出现。",
    "证据文章偏少，重构时需要避免把角度写散。",
    "适合公众号长文重构，角度空间比较清楚。",
  ]);

  assert.deepEqual(readable, {
    worthDoing: [
      "样本源集中，说明题目在核心池里重复出现。",
      "适合公众号长文重构，角度空间比较清楚。",
    ],
    caution: ["证据文章偏少，重构时需要避免把角度写散。"],
  });
});

test("buildTopicClusterHeaderMeta keeps header priority as status, article count, total score, title source", () => {
  const meta = buildTopicClusterHeaderMeta({
    status: "open",
    articleCount: 4,
    totalScore: 87,
    topicTitleSource: "rule_based",
  });

  assert.deepEqual(meta, [
    { id: "status", label: "待确认", emphasis: "normal" },
    { id: "article-count", label: "4 篇候选文章", emphasis: "normal" },
    { id: "total-score", label: "总分 87", emphasis: "strong" },
    { id: "title-source", label: "规则聚类", emphasis: "subtle" },
  ]);
});

test("truncateRewriteTaskError keeps task error readable without making cards too tall", () => {
  const message =
    "模型返回超时，随后状态同步也失败，系统已经保留原始任务，但需要你稍后重新发起本次多篇仿写，避免继续把页面停留在失败状态里。";

  assert.equal(
    truncateRewriteTaskError(message, 30),
    "模型返回超时，随后状态同步也失败，系统已经保留原始任务，但…",
  );
  assert.equal(truncateRewriteTaskError("短错误", 30), "短错误");
});
