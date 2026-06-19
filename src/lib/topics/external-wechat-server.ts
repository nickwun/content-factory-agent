import { createExternalWechatClient } from "./external-wechat-client.ts";
import {
  createExternalWechatAnalysisService,
  ExternalWechatAnalysisError,
} from "./external-wechat-analysis.ts";
import {
  createExternalRewriteTaskService,
  ExternalRewriteTaskError,
} from "./external-rewrite-task-service.ts";
import {
  createExternalWechatService,
  ExternalWechatSearchError,
} from "./external-wechat-service.ts";
import {
  buildPromptPresetInput,
  PromptPresetError,
} from "../settings/prompt-settings-server.ts";
import type { PromptPresetInput } from "../rewrite/prompt-preset-input.ts";
import type {
  ExternalRewriteTask,
  ExternalTopicInsight,
  ExternalWechatArticle,
  ExternalWechatTimeWindow,
} from "./external-wechat-types.ts";
import type { WechatFinalizationOptions } from "../generation/wechat-finalization.ts";
import type { RewriteSource } from "../rewrite/rewrite-source.ts";

type ExternalWechatServerDependencies = {
  searchExternalWechatArticles?: (input: {
    keyword: string;
    timeWindow: ExternalWechatTimeWindow;
  }) => Promise<ExternalWechatArticle[]>;
  fetchExternalWechatArticleContents?: (input: {
    articles: ExternalWechatArticle[];
  }) => Promise<ExternalWechatArticle[]>;
  analyzeExternalWechatArticles?: (input: {
    keyword: string;
    timeWindow: ExternalWechatTimeWindow;
    articles: ExternalWechatArticle[];
  }) => Promise<ExternalTopicInsight>;
  createExternalRewriteTask?: (input: {
    keyword: string;
    timeWindow: ExternalWechatTimeWindow;
    articles: ExternalWechatArticle[];
    selectedArticleIds: string[];
    insight?: ExternalTopicInsight;
    promptPresetInput?: PromptPresetInput;
  }) => Promise<{
    externalRewriteTask: ExternalRewriteTask;
    generatePayload: {
      userPrompt: string;
      selectedPlatforms: readonly ["wechat_article"];
      rewriteSource: RewriteSource;
      wechatFinalization: WechatFinalizationOptions;
    };
  }>;
};

let testingDependencies: ExternalWechatServerDependencies | null = null;

export function setExternalWechatServerDependenciesForTesting(
  dependencies: ExternalWechatServerDependencies | null,
) {
  testingDependencies = dependencies;
}

function getExternalWechatService() {
  const client = createExternalWechatClient({
    baseUrl: process.env.EXTERNAL_WECHAT_BASE_URL,
  });

  return createExternalWechatService({
    client,
    credentialsProvider: () => {
      const apiKey = process.env.EXTERNAL_WECHAT_API_KEY?.trim();
      const verifyCode = process.env.EXTERNAL_WECHAT_VERIFYCODE?.trim();

      if (!apiKey) {
        return null;
      }

      return {
        apiKey,
        ...(verifyCode ? { verifyCode } : {}),
      };
    },
  });
}

function getExternalWechatAnalysisService() {
  return createExternalWechatAnalysisService();
}

function getExternalRewriteTaskService() {
  return createExternalRewriteTaskService();
}

function resolvePromptPresetInput(
  promptPresetId?: string,
): PromptPresetInput | undefined {
  if (!promptPresetId) {
    return undefined;
  }

  return buildPromptPresetInput(promptPresetId);
}

export function searchExternalWechatArticles(input: {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
}) {
  if (testingDependencies?.searchExternalWechatArticles) {
    return testingDependencies.searchExternalWechatArticles(input);
  }

  return getExternalWechatService().searchExternalWechatArticles(input);
}

export function fetchExternalWechatArticleContents(input: {
  articles: ExternalWechatArticle[];
}) {
  if (testingDependencies?.fetchExternalWechatArticleContents) {
    return testingDependencies.fetchExternalWechatArticleContents(input);
  }

  return getExternalWechatService().fetchExternalWechatArticleContents(input);
}

export function analyzeExternalWechatArticles(input: {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  articles: ExternalWechatArticle[];
}) {
  if (testingDependencies?.analyzeExternalWechatArticles) {
    return testingDependencies.analyzeExternalWechatArticles(input);
  }

  return getExternalWechatAnalysisService().analyzeExternalWechatArticles(input);
}

export function createExternalRewriteTask(input: {
  keyword: string;
  timeWindow: ExternalWechatTimeWindow;
  articles: ExternalWechatArticle[];
  selectedArticleIds: string[];
  insight?: ExternalTopicInsight;
  promptPresetId?: string;
}) {
  if (testingDependencies?.createExternalRewriteTask) {
    return testingDependencies.createExternalRewriteTask({
      ...input,
      promptPresetInput: resolvePromptPresetInput(input.promptPresetId),
    });
  }

  return Promise.resolve(
    getExternalRewriteTaskService().createExternalRewriteTask({
      ...input,
      promptPresetInput: resolvePromptPresetInput(input.promptPresetId),
    }),
  );
}

export {
  ExternalRewriteTaskError,
  ExternalWechatAnalysisError,
  ExternalWechatSearchError,
  PromptPresetError,
};
