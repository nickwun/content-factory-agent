import { listCandidateArticles } from "./candidate-article-server";
import { listRewriteTasks } from "./rewrite-task-server";
import { listSourceAccounts } from "./source-account-server";
import { listTopicClusters } from "./topic-cluster-server";
import { listTopicScores } from "./topic-score-server";

export function getTopicCenterPageData() {
  return {
    initialSourceAccounts: listSourceAccounts(),
    initialCandidateArticles: listCandidateArticles(),
    initialTopicClusters: listTopicClusters(),
    initialTopicScores: listTopicScores(),
    initialRewriteTasks: listRewriteTasks(),
  };
}
