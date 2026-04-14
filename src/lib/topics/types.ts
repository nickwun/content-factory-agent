export type SourceAccount = {
  id: string;
  platform: "wechat";
  name: string;
  handle?: string;
  category?: string;
  priority: number;
  status: "active" | "paused";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CandidateArticle = {
  id: string;
  sourceAccountId: string;
  sourceType:
    | "manual_import"
    | "file_import"
    | "search_discovery"
    | "feed_ingest";
  title: string;
  authorName?: string;
  publishedAt?: string;
  url?: string;
  contentMarkdown?: string;
  excerpt?: string;
  charCount?: number;
  status: "ingested" | "clustered" | "discarded";
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
};

export type TopicCluster = {
  id: string;
  topicTitle: string;
  topicTitleSource: "manual" | "rule_based" | "llm_generated";
  topicSummary: string;
  keywords: string[];
  articleIds: string[];
  status: "open" | "approved" | "rejected" | "rewritten";
  createdAt: string;
  updatedAt: string;
};

export type TopicScore = {
  clusterId: string;
  noveltyScore: number;
  fitScore: number;
  evidenceScore: number;
  rewritePotentialScore: number;
  totalScore: number;
  reasons: string[];
  scoredAt: string;
};

export type RewriteTaskBrief = {
  topicTitle: string;
  topicSummary: string;
  keyAngles: string[];
  representativeArticleIds: string[];
  rewriteGoal: string;
  styleProfile: string;
};

export type RewriteTask = {
  id: string;
  clusterId: string;
  selectedArticleIds: string[];
  brief: RewriteTaskBrief;
  status: "pending" | "running" | "succeeded" | "failed";
  generatedRecordId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
