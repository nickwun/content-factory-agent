export type ExternalWechatTimeWindow = "all" | "1d" | "7d" | "6m";

export type ExternalWechatArticle = {
  id: string;
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  title: string;
  accountName: string;
  publishTime?: string;
  url?: string;
  metrics?: {
    read?: number;
    like?: number;
    looking?: number;
  };
  content?: string;
  contentFetchStatus?: "pending" | "loading" | "success" | "failed";
  contentFetchError?: string;
  fetchedAt: string;
};

export type ExternalTopicInsight = {
  id: string;
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  articleIds: string[];
  summary: string;
  titlePatterns: string[];
  demandDrivers: string[];
  structurePatterns: string[];
  stylePatterns: string[];
  emotionalDrivers: string[];
  rewritePotential: string[];
  references: string[];
  sampleNotice?: string;
  // Legacy compatibility for already-persisted insight snapshots and existing rewrite bridge reads.
  whyViral?: string[];
  characteristics?: string[];
  createdAt: string;
};

export type ExternalRewriteTaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type ExternalRewriteTaskAnalysisHighlights = {
  titlePatterns?: string[];
  structurePatterns?: string[];
  emotionalDrivers?: string[];
  rewritePotential?: string[];
  demandSummary?: string;
  styleHint?: string;
};

export type ExternalRewriteTaskBrief = {
  keyword: string;
  insightSummary?: string;
  whyViral?: string[];
  characteristics?: string[];
  references?: string[];
  analysisHighlights?: ExternalRewriteTaskAnalysisHighlights;
  sourceArticles: Array<{
    id: string;
    title: string;
    accountName: string;
    publishTime?: string;
  }>;
  rewriteGoal: string;
  styleProfile: string;
};

export type ExternalRewriteTask = {
  id: string;
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  selectedArticleIds: string[];
  brief: ExternalRewriteTaskBrief;
  status: ExternalRewriteTaskStatus;
  generatedRecordId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExternalWechatQueryState = {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  articles: ExternalWechatArticle[];
  latestInsight?: ExternalTopicInsight;
  updatedAt: string;
};
