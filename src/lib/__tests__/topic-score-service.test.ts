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
import {
  createTopicScoreRepository,
  ensureTopicScoresTable,
} from "../topics/topic-score-repository.ts";
import { createTopicScoreService } from "../topics/topic-score-service.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("topic score service scores topic clusters and treats totalScore as server truth", () => {
  const { candidateArticleService, sourceAccountService, topicClusterService, topicScoreService } =
    createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "跑步长期样本",
    handle: "runner-core",
    priority: 90,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "中年人跑步，先把节奏慢下来",
    contentMarkdown:
      "跑步不是为了抢速度，而是为了把生活重新稳住。\n\n节奏比一时的成绩更重要。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "长期训练最怕忽快忽慢",
    contentMarkdown:
      "训练这件事，最先要保住的不是强度，而是节奏。\n\n恢复和耐力都需要时间。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "写作会逼着人重新整理自己",
    contentMarkdown:
      "写作更像是在把经验、观察和语言慢慢重新排一遍。",
  });

  const clusters = topicClusterService.rebuildTopicClusters();
  const scores = topicScoreService.scoreTopicClusters();

  assert.equal(scores.length, clusters.length);
  assert.ok(scores.every((score) => score.totalScore > 0));
  assert.ok(scores.every((score) => score.reasons.length > 0));

  const ranked = topicScoreService.listRankedTopicClusters();

  assert.equal(ranked.length, 2);
  assert.ok(ranked[0]!.score.totalScore >= ranked[1]!.score.totalScore);
  assert.ok(ranked[0]!.score.totalScore === scores.find((item) => item.clusterId === ranked[0]!.cluster.id)?.totalScore);
});

function createServices() {
  const db = createTempDb();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  ensureTopicClustersTable(db);
  ensureTopicScoresTable(db);

  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  const topicClusterRepository = createTopicClusterRepository(db);
  const topicScoreRepository = createTopicScoreRepository(db);

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
    topicScoreService: createTopicScoreService({
      topicClusterRepository,
      topicScoreRepository,
    }),
  };
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-topic-scores-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}
