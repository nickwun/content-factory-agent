import { randomUUID } from "node:crypto";

import {
  buildRewriteSource,
  MAX_REWRITE_SOURCE_CHARS,
} from "../rewrite/rewrite-source.ts";
import { buildPromptPresetPromptBlocks, type PromptPresetInput } from "../rewrite/prompt-preset-input.ts";
import { buildWechatFinalizationOptions } from "../generation/wechat-finalization.ts";
import type { CandidateArticle, RewriteTask, TopicCluster } from "./types.ts";

type CandidateArticleRepository = {
  getByIds: (ids: string[]) => CandidateArticle[];
};

type TopicClusterRepository = {
  getById: (id: string) => TopicCluster | null;
  updateStatus: (
    id: string,
    status: TopicCluster["status"],
    updatedAt: string,
  ) => TopicCluster | null;
};

type RewriteTaskRepository = {
  list: () => RewriteTask[];
  getById: (id: string) => RewriteTask | null;
  create: (input: RewriteTask) => RewriteTask | null;
  update: (
    id: string,
    input: Partial<Pick<RewriteTask, "status" | "generatedRecordId" | "error">> & {
      updatedAt: string;
    },
  ) => RewriteTask | null;
};

export class RewriteTaskError extends Error {
  readonly code:
    | "topic_cluster_not_found"
    | "topic_cluster_not_actionable"
    | "rewrite_task_not_found"
    | "rewrite_task_invalid_articles";

  constructor(
    code:
      | "topic_cluster_not_found"
      | "topic_cluster_not_actionable"
      | "rewrite_task_not_found"
      | "rewrite_task_invalid_articles",
    message: string,
  ) {
    super(message);
    this.name = "RewriteTaskError";
    this.code = code;
  }
}

export function createRewriteTaskService(input: {
  candidateArticleRepository: CandidateArticleRepository;
  topicClusterRepository: TopicClusterRepository;
  rewriteTaskRepository: RewriteTaskRepository;
}) {
  const { candidateArticleRepository, topicClusterRepository, rewriteTaskRepository } = input;

  return {
    listRewriteTasks() {
      return rewriteTaskRepository.list();
    },

    startRewriteTaskFromCluster(
      clusterId: string,
      promptPresetInput?: PromptPresetInput,
    ) {
      const cluster = topicClusterRepository.getById(clusterId);

      if (!cluster) {
        throw new RewriteTaskError(
          "topic_cluster_not_found",
          "当前主题簇不存在，无法发起仿写。",
        );
      }

      if (cluster.status !== "open") {
        throw new RewriteTaskError(
          "topic_cluster_not_actionable",
          "当前主题簇当前状态不可直接进入仿写。",
        );
      }

      const representativeArticleIds = cluster.articleIds.slice(0, 3);
      const representativeArticles = candidateArticleRepository.getByIds(
        representativeArticleIds,
      );

      if (representativeArticles.length === 0) {
        throw new RewriteTaskError(
          "rewrite_task_invalid_articles",
          "当前主题簇缺少可用候选文章，暂时无法发起仿写。",
        );
      }

      const now = new Date().toISOString();
      const rewriteTask: RewriteTask = {
        id: randomUUID(),
        clusterId: cluster.id,
        selectedArticleIds: representativeArticles.map((article) => article.id),
        brief: {
          topicTitle: cluster.topicTitle,
          topicSummary: cluster.topicSummary,
          keyAngles: buildKeyAngles(representativeArticles),
          representativeArticleIds: representativeArticles.map((article) => article.id),
          rewriteGoal:
            "把同一主题下的多篇候选文章重构成一篇适合公众号发布的原创长文。",
          styleProfile:
            "保留公众号长文的人味、口语感和观察感，避免模板腔、教程腔和过度解释。",
        },
        status: "running",
        createdAt: now,
        updatedAt: now,
      };

      const createdTask = rewriteTaskRepository.create(rewriteTask)!;
      topicClusterRepository.updateStatus(cluster.id, "approved", now);

      return {
        rewriteTask: createdTask,
        generatePayload: {
          userPrompt: buildRewriteUserPrompt(createdTask.brief, promptPresetInput),
          selectedPlatforms: ["wechat_article"] as const,
          rewriteSource: buildRewriteSource({
            kind: "pasted_text",
            sourceName: `${cluster.topicTitle} 多篇候选文章`,
            extractedText: buildRepresentativeSourceText(representativeArticles),
            maxChars: MAX_REWRITE_SOURCE_CHARS,
          }),
          wechatFinalization: buildWechatFinalizationOptions(true),
        },
      };
    },

    completeRewriteTask(input: { taskId: string; generatedRecordId: string }) {
      const current = rewriteTaskRepository.getById(input.taskId);

      if (!current) {
        throw new RewriteTaskError(
          "rewrite_task_not_found",
          "当前仿写任务不存在。",
        );
      }

      const updated = rewriteTaskRepository.update(input.taskId, {
        status: "succeeded",
        generatedRecordId: input.generatedRecordId,
        error: undefined,
        updatedAt: new Date().toISOString(),
      });

      topicClusterRepository.updateStatus(
        current.clusterId,
        "rewritten",
        new Date().toISOString(),
      );

      return updated!;
    },

    failRewriteTask(input: { taskId: string; errorMessage: string }) {
      const current = rewriteTaskRepository.getById(input.taskId);

      if (!current) {
        throw new RewriteTaskError(
          "rewrite_task_not_found",
          "当前仿写任务不存在。",
        );
      }

      return rewriteTaskRepository.update(input.taskId, {
        status: "failed",
        error: input.errorMessage,
        updatedAt: new Date().toISOString(),
      })!;
    },
  };
}

function buildRewriteUserPrompt(
  brief: RewriteTask["brief"],
  promptPresetInput?: PromptPresetInput,
) {
  const angles = brief.keyAngles.map((angle) => `- ${angle}`).join("\n");
  const lines = [
    `请围绕「${brief.topicTitle}」重构一篇公众号长文。`,
    brief.topicSummary,
    "建议优先吸收这些代表角度：",
    angles,
    `写作目标：${brief.rewriteGoal}`,
    `风格要求：${brief.styleProfile}`,
  ];

  const presetBlocks = buildPromptPresetPromptBlocks(promptPresetInput);
  if (presetBlocks.length > 0) {
    lines.push(...presetBlocks);
  }

  return lines.join("\n\n");
}

function buildRepresentativeSourceText(articles: CandidateArticle[]) {
  return articles
    .map(
      (article, index) =>
        `## 候选文章 ${index + 1}：${article.title}\n\n${article.contentMarkdown ?? article.excerpt ?? article.title}`,
    )
    .join("\n\n---\n\n");
}

function buildKeyAngles(articles: CandidateArticle[]) {
  return Array.from(
    new Set(
      articles
        .map((article) => article.title.trim())
        .filter((title) => title.length > 0),
    ),
  ).slice(0, 3);
}
