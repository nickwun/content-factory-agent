import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase } from "../db/sqlite.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "../topics/candidate-article-repository.ts";
import { createCandidateArticleService } from "../topics/candidate-article-service.ts";
import {
  createSourceAccountRepository,
  ensureSourceAccountsTable,
} from "../topics/source-account-repository.ts";
import { createSourceAccountService } from "../topics/source-account-service.ts";
import {
  createTopicClusterRepository,
  ensureTopicClustersTable,
} from "../topics/topic-cluster-repository.ts";
import { createTopicClusterService } from "../topics/topic-cluster-service.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("topic cluster service groups similar running articles into one cluster", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService } =
    createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "跑步长期样本",
    handle: "runner-core",
    priority: 90,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "人到中年，跑步不是为了赢别人",
    contentMarkdown:
      "跑步到后面，更像是在和自己的节奏相处。\n\n你不需要每次都证明什么。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "中年人跑步，先把节奏慢下来",
    contentMarkdown:
      "很多人重新开始跑步，不是为了成绩，而是为了把生活重新稳住。\n\n节奏比速度更重要。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "写作是一种对抗脑力钝化的方式",
    contentMarkdown:
      "写作会迫使人重新组织观察、经验和语言。\n\n它更像慢慢整理自己。",
  });

  const clusters = topicClusterService.rebuildTopicClusters();

  assert.equal(clusters.length, 2);

  const runningCluster = clusters.find((cluster) =>
    cluster.articleIds.length === 2 &&
    cluster.keywords.some((keyword) => keyword.includes("跑步")),
  );

  assert.ok(runningCluster);
  assert.equal(runningCluster?.topicTitleSource, "rule_based");
  assert.equal(runningCluster?.status, "open");
});

test("topic cluster service marks non-discarded articles as clustered after rebuild", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService } =
    createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "训练样本",
    priority: 80,
  }).id;

  const first = candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "长期训练不是靠一时兴起",
    contentMarkdown: "第一段\n\n第二段",
  });

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "中年跑步最怕的是忽快忽慢",
    contentMarkdown: "第三段\n\n第四段",
  });

  const before = candidateArticleService.listCandidateArticles();
  assert.equal(before.find((article) => article.id === first.id)?.status, "ingested");

  topicClusterService.rebuildTopicClusters();

  const after = candidateArticleService.listCandidateArticles();
  assert.equal(after.find((article) => article.id === first.id)?.status, "clustered");
});

test("topic cluster service can reject an open cluster", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService } =
    createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "写作观察样本",
    priority: 70,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "写作不是为了证明自己",
    contentMarkdown: "先把话说出来，再慢慢整理成自己的表达。",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  assert.ok(cluster);
  assert.equal(cluster?.status, "open");

  const rejected = topicClusterService.rejectTopicCluster(cluster!.id);

  assert.ok(rejected);
  assert.equal(rejected?.status, "rejected");
});

test("topic cluster service can reactivate a rejected cluster", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService } =
    createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "重开样本",
    priority: 70,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "这篇主题先忽略，之后再看",
    contentMarkdown: "跑步训练里，有些主题这轮先不做，下一轮再回来。",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  assert.ok(cluster);

  const rejected = topicClusterService.rejectTopicCluster(cluster!.id);
  assert.equal(rejected?.status, "rejected");

  const reactivated = topicClusterService.reactivateTopicCluster(cluster!.id);
  assert.ok(reactivated);
  assert.equal(reactivated?.status, "open");
});

test("topic cluster service does not collapse all running subtopics into a single mega cluster", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService } =
    createServices();
  const runningSourceId = sourceAccountService.createSourceAccount({
    name: "跑步样本 A",
    handle: "runner-a",
    priority: 90,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId: runningSourceId,
    title: "配速训练不是越快越好",
    contentMarkdown: "跑步训练里，配速和恢复要一起看。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId: runningSourceId,
    title: "恢复跑比硬顶训练更重要",
    contentMarkdown: "长期训练里，恢复和节奏比一时状态更关键。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId: runningSourceId,
    title: "比赛前一周，跑量要怎么收",
    contentMarkdown: "跑步比赛前一周，训练重点会从跑量切到状态和节奏。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId: runningSourceId,
    title: "跑鞋怎么选，别只看碳板",
    contentMarkdown: "跑步训练里的装备选择，如果只看碳板，很容易把日常跑和比赛鞋混在一起。",
  });

  const clusters = topicClusterService.rebuildTopicClusters();

  assert.ok(clusters.length >= 2);

  const runningClusters = clusters.filter((cluster) =>
    cluster.keywords.includes("跑步"),
  );

  assert.ok(runningClusters.length >= 2);
  assert.ok(runningClusters.every((cluster) => cluster.articleIds.length < 4));
});

test("topic cluster service preserves rejected status when rebuilding same topic", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService } =
    createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "长期训练样本",
    handle: "runner-core",
    priority: 90,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "配速稳定下来之后，训练才算开始",
    contentMarkdown: "跑步训练里，节奏、配速和恢复经常一起出现。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "恢复跑不是可有可无的点缀",
    contentMarkdown: "很多人只盯训练强度，但恢复跑才是长期训练能走远的关键。",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  assert.ok(cluster);

  const rejected = topicClusterService.rejectTopicCluster(cluster!.id);
  assert.equal(rejected?.status, "rejected");

  const [rebuiltCluster] = topicClusterService.rebuildTopicClusters();
  assert.ok(rebuiltCluster);
  assert.equal(rebuiltCluster?.topicTitle, cluster?.topicTitle);
  assert.equal(rebuiltCluster?.status, "rejected");
});

function createServices() {
  const db = createTempDb();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  ensureTopicClustersTable(db);

  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  const topicClusterRepository = createTopicClusterRepository(db);

  return {
    sourceAccountService: createSourceAccountService(sourceAccountRepository),
    candidateArticleService: createCandidateArticleService({
      candidateArticleRepository,
      sourceAccountRepository,
    }),
    topicClusterService: createTopicClusterService({
      candidateArticleRepository,
      topicClusterRepository,
    }),
  };
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-topic-clusters-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}
