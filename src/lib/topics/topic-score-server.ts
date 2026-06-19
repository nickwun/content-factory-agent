import { getAppDatabase } from "../db/sqlite.ts";
import {
  createTopicClusterRepository,
  ensureTopicClustersTable,
} from "./topic-cluster-repository.ts";
import {
  createTopicScoreRepository,
  ensureTopicScoresTable,
} from "./topic-score-repository.ts";
import { createTopicScoreService } from "./topic-score-service.ts";

function getTopicScoreService() {
  const db = getAppDatabase();
  ensureTopicClustersTable(db);
  ensureTopicScoresTable(db);

  return createTopicScoreService({
    topicClusterRepository: createTopicClusterRepository(db),
    topicScoreRepository: createTopicScoreRepository(db),
  });
}

export function listTopicScores() {
  return getTopicScoreService().listTopicScores();
}

export function scoreTopicClusters() {
  return getTopicScoreService().scoreTopicClusters();
}

export function listRankedTopicClusters() {
  return getTopicScoreService().listRankedTopicClusters();
}
