import assert from "node:assert/strict";
import test from "node:test";

import { getTopicCenterPageData } from "../topics/topic-center-page-data.ts";

test("topic center page data waits for request time before reading live topic data", async () => {
  const calls: string[] = [];

  const pageData = await getTopicCenterPageData({
    waitForRequest: async () => {
      calls.push("wait");
    },
    listSourceAccounts: () => {
      calls.push("sources");
      return [];
    },
    listCandidateArticles: () => {
      calls.push("articles");
      return [];
    },
    listTopicClusters: () => {
      calls.push("clusters");
      return [];
    },
    listTopicScores: () => {
      calls.push("scores");
      return [];
    },
    listRewriteTasks: () => {
      calls.push("tasks");
      return [];
    },
  });

  assert.deepEqual(calls, ["wait", "sources", "articles", "clusters", "scores", "tasks"]);
  assert.deepEqual(pageData, {
    initialSourceAccounts: [],
    initialCandidateArticles: [],
    initialTopicClusters: [],
    initialTopicScores: [],
    initialRewriteTasks: [],
  });
});
