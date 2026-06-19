import { getAppDatabase } from "../db/sqlite.ts";
import { buildPromptPresetInput, PromptPresetError } from "../settings/prompt-settings-server.ts";
import type { PromptPresetInput } from "../rewrite/prompt-preset-input.ts";
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

function resolvePromptPresetInput(
  promptPresetId?: string,
): PromptPresetInput | undefined {
  if (!promptPresetId) {
    return undefined;
  }

  return buildPromptPresetInput(promptPresetId);
}

export function listRewriteTasks() {
  return getRewriteTaskService().listRewriteTasks();
}

export function startRewriteTaskFromCluster(
  clusterId: string,
  promptPresetId?: string,
) {
  return getRewriteTaskService().startRewriteTaskFromCluster(
    clusterId,
    resolvePromptPresetInput(promptPresetId),
  );
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

export { PromptPresetError, RewriteTaskError };
