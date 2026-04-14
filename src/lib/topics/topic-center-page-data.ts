import { connection } from "next/server.js";

import { listCandidateArticles as defaultListCandidateArticles } from "./candidate-article-server.ts";
import { listRewriteTasks as defaultListRewriteTasks } from "./rewrite-task-server.ts";
import { listSourceAccounts as defaultListSourceAccounts } from "./source-account-server.ts";
import { listTopicClusters as defaultListTopicClusters } from "./topic-cluster-server.ts";
import { listTopicScores as defaultListTopicScores } from "./topic-score-server.ts";

type TopicCenterPageDataDependencies = {
  waitForRequest?: () => Promise<void>;
  listSourceAccounts?: typeof defaultListSourceAccounts;
  listCandidateArticles?: typeof defaultListCandidateArticles;
  listTopicClusters?: typeof defaultListTopicClusters;
  listTopicScores?: typeof defaultListTopicScores;
  listRewriteTasks?: typeof defaultListRewriteTasks;
};

export async function getTopicCenterPageData(
  dependencies: TopicCenterPageDataDependencies = {},
) {
  const {
    waitForRequest = connection,
    listSourceAccounts = defaultListSourceAccounts,
    listCandidateArticles = defaultListCandidateArticles,
    listTopicClusters = defaultListTopicClusters,
    listTopicScores = defaultListTopicScores,
    listRewriteTasks = defaultListRewriteTasks,
  } = dependencies;

  await waitForRequest();

  return {
    initialSourceAccounts: listSourceAccounts(),
    initialCandidateArticles: listCandidateArticles(),
    initialTopicClusters: listTopicClusters(),
    initialTopicScores: listTopicScores(),
    initialRewriteTasks: listRewriteTasks(),
  };
}
