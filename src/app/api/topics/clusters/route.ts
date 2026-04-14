import { NextResponse } from "next/server.js";

import {
  listCandidateArticles,
} from "../../../../lib/topics/candidate-article-server.ts";
import {
  listTopicClusters,
  rebuildTopicClusters,
} from "../../../../lib/topics/topic-cluster-server.ts";
import {
  listTopicScores,
  scoreTopicClusters,
} from "../../../../lib/topics/topic-score-server.ts";

export async function GET() {
  return NextResponse.json({
    topicClusters: listTopicClusters(),
    topicScores: listTopicScores(),
  });
}

export async function POST() {
  const topicClusters = rebuildTopicClusters();
  const topicScores = scoreTopicClusters();

  return NextResponse.json({
    topicClusters,
    topicScores,
    candidateArticles: listCandidateArticles(),
  });
}
