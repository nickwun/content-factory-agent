import { getAppDatabase } from "../db/sqlite.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "./candidate-article-repository.ts";
import {
  createRewriteTaskRepository,
  ensureRewriteTasksTable,
} from "./rewrite-task-repository.ts";
import {
  createRewriteTaskService,
  RewriteTaskError,
} from "./rewrite-task-service.ts";
import {
  createTopicClusterRepository,
  ensureTopicClustersTable,
} from "./topic-cluster-repository.ts";

function getRewriteTaskService() {
  const db = getAppDatabase();
  ensureCandidateArticlesTable(db);
  ensureTopicClustersTable(db);
  ensureRewriteTasksTable(db);

  return createRewriteTaskService({
    candidateArticleRepository: createCandidateArticleRepository(db),
    topicClusterRepository: createTopicClusterRepository(db),
    rewriteTaskRepository: createRewriteTaskRepository(db),
  });
}

export function listRewriteTasks() {
  return getRewriteTaskService().listRewriteTasks();
}

export function startRewriteTaskFromCluster(clusterId: string) {
  return getRewriteTaskService().startRewriteTaskFromCluster(clusterId);
}

export function completeRewriteTask(input: {
  taskId: string;
  generatedRecordId: string;
}) {
  return getRewriteTaskService().completeRewriteTask(input);
}

export function failRewriteTask(input: { taskId: string; errorMessage: string }) {
  return getRewriteTaskService().failRewriteTask(input);
}

export { RewriteTaskError };
