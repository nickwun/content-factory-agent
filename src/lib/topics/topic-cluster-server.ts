import { getAppDatabase } from "../db/sqlite.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "./candidate-article-repository.ts";
import {
  createTopicClusterRepository,
  ensureTopicClustersTable,
} from "./topic-cluster-repository.ts";
import { createTopicClusterService } from "./topic-cluster-service.ts";
import { ensureSourceAccountsTable } from "./source-account-repository.ts";

function getTopicClusterService() {
  const db = getAppDatabase();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  ensureTopicClustersTable(db);

  return createTopicClusterService({
    candidateArticleRepository: createCandidateArticleRepository(db),
    topicClusterRepository: createTopicClusterRepository(db),
  });
}

export function listTopicClusters() {
  return getTopicClusterService().listTopicClusters();
}

export function rebuildTopicClusters() {
  return getTopicClusterService().rebuildTopicClusters();
}

export function rejectTopicCluster(id: string) {
  return getTopicClusterService().rejectTopicCluster(id);
}
