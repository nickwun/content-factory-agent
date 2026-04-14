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
