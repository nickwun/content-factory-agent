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
  createRewriteTaskRepository,
  ensureRewriteTasksTable,
} from "../topics/rewrite-task-repository.ts";
import { createRewriteTaskService } from "../topics/rewrite-task-service.ts";
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

test("rewrite task service creates structured brief from topic cluster and marks task running", () => {
  const {
    candidateArticleService,
    rewriteTaskService,
    sourceAccountService,
    topicClusterService,
  } = createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "跑步长期样本",
    handle: "runner-core",
    priority: 90,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "跑步不是为了赢别人",
    contentMarkdown:
      "跑步到后面，更像是在和自己的节奏相处。\n\n你不需要每次都证明什么。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "长期训练最怕节奏乱掉",
    contentMarkdown:
      "训练这件事，最先要保住的不是强度，而是节奏。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "中年跑步，先把速度放下",
    contentMarkdown:
      "很多人重新开始跑步，不是为了成绩，而是为了把生活重新稳住。",
  });

  const clusters = topicClusterService.rebuildTopicClusters();
  const cluster = clusters.find((item) => item.articleIds.length === 2);

  assert.ok(cluster);
  const started = rewriteTaskService.startRewriteTaskFromCluster(cluster!.id);

  assert.equal(started.rewriteTask.status, "running");
  assert.equal(started.rewriteTask.clusterId, cluster!.id);
  assert.ok(started.rewriteTask.selectedArticleIds.length <= 3);
  assert.equal(started.rewriteTask.brief.topicTitle, cluster!.topicTitle);
  assert.equal(started.rewriteTask.brief.topicSummary, cluster!.topicSummary);
  assert.ok(started.rewriteTask.brief.keyAngles.length > 0);
  assert.equal(
    started.rewriteTask.brief.representativeArticleIds.length,
    started.rewriteTask.selectedArticleIds.length,
  );
  assert.equal(started.generatePayload.selectedPlatforms[0], "wechat_article");
  assert.ok(started.generatePayload.userPrompt.includes(cluster!.topicTitle));
  assert.ok(started.generatePayload.rewriteSource.extractedText.includes("候选文章 1"));
});

test("rewrite task service updates running task to succeeded with generated record id", () => {
  const {
    candidateArticleService,
    rewriteTaskService,
    sourceAccountService,
    topicClusterService,
  } = createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "写作样本",
    priority: 70,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "写作逼着人整理自己",
    contentMarkdown: "第一段\n\n第二段",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  const started = rewriteTaskService.startRewriteTaskFromCluster(cluster!.id);
  const succeeded = rewriteTaskService.completeRewriteTask({
    taskId: started.rewriteTask.id,
    generatedRecordId: "record-123",
  });

  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.generatedRecordId, "record-123");
});

test("rewrite task service rejects non-open topic clusters", () => {
  const {
    candidateArticleService,
    rewriteTaskService,
    sourceAccountService,
    topicClusterService,
  } = createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "家庭观察样本",
    priority: 60,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "家庭里的节奏感是慢慢练出来的",
    contentMarkdown: "很多家庭冲突，最后都回到节奏没对齐这件事。",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  topicClusterService.rejectTopicCluster(cluster!.id);

  assert.throws(
    () => rewriteTaskService.startRewriteTaskFromCluster(cluster!.id),
    /当前主题簇当前状态不可直接进入仿写/u,
  );
});

test("rewrite task service de-duplicates repeated key angle titles", () => {
  const {
    candidateArticleService,
    rewriteTaskService,
    sourceAccountService,
    topicClusterService,
  } = createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "跑步观察样本",
    priority: 85,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "跑步老王",
    contentMarkdown: "第一篇内容，讲节奏和恢复。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "跑步老王",
    contentMarkdown: "第二篇内容，讲耐力和配速。",
  });
  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "中年跑步先别急着快",
    contentMarkdown: "第三篇内容，讲配速、恢复和长期训练。",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  const started = rewriteTaskService.startRewriteTaskFromCluster(cluster!.id);

  assert.equal(started.rewriteTask.brief.keyAngles.length, 2);
  assert.deepEqual(
    [...started.rewriteTask.brief.keyAngles].sort(),
    ["中年跑步先别急着快", "跑步老王"].sort(),
  );
});

test("rewrite task service can include selected prompt preset input in generation prompt", () => {
  const {
    candidateArticleService,
    rewriteTaskService,
    sourceAccountService,
    topicClusterService,
  } = createServices();
  const sourceAccountId = sourceAccountService.createSourceAccount({
    name: "跑步写法样本",
    priority: 88,
  }).id;

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "第一次全马前一周，最重要的不是猛练",
    contentMarkdown: "赛前一周更要稳节奏，而不是临时加量。",
  });

  const [cluster] = topicClusterService.rebuildTopicClusters();
  const started = rewriteTaskService.startRewriteTaskFromCluster(cluster!.id, {
    presetId: "preset-1",
    name: "跑步长期主义提示词",
    platform: "wechat_article",
    promptTemplate: "写成一篇像长期跑者复盘的公众号文章，少讲大道理。",
    corpusCount: 2,
    hasCorpus: true,
    corpusSummary: {
      tone: ["口语、克制、像过来人提醒"],
      structure: ["结论前置，再按阶段拆准备动作"],
      lengthHint: "整体篇幅偏中等，段落不拖沓。",
      reusablePhrases: ["先稳住节奏", "别急着证明自己"],
    },
  });

  assert.equal(started.generatePayload.userPrompt.includes("提示词预设："), true);
  assert.equal(
    started.generatePayload.userPrompt.includes("当前使用提示词预设「跑步长期主义提示词」。"),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("当前预设已绑定 2 份参考语料摘要。"),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("预设提示词：\n写成一篇像长期跑者复盘的公众号文章，少讲大道理。"),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("语料参考："),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("参考 2 份绑定语料的整体语气：口语、克制、像过来人提醒。"),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("结构上优先贴近：结论前置，再按阶段拆准备动作。"),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("篇幅感参考：整体篇幅偏中等，段落不拖沓。"),
    true,
  );
  assert.equal(
    started.generatePayload.userPrompt.includes("可以少量借这些表达偏好：先稳住节奏；别急着证明自己。"),
    true,
  );
});

function createServices() {
  const db = createTempDb();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  ensureTopicClustersTable(db);
  ensureRewriteTasksTable(db);

  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  const topicClusterRepository = createTopicClusterRepository(db);
  const rewriteTaskRepository = createRewriteTaskRepository(db);

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
    rewriteTaskService: createRewriteTaskService({
      candidateArticleRepository,
      topicClusterRepository,
      rewriteTaskRepository,
    }),
  };
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-rewrite-tasks-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}
