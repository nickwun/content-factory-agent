import type {
  WechatArticleContent,
  PlatformContentMap,
  TwitterContent,
  XiaohongshuContent,
  VideoScriptContent,
} from "../types/history.ts";
import type { PlatformType } from "../types/platform.ts";
import type { GenerationContext } from "./generation-context.ts";
import { generateMockDraft } from "./mock-generation-service.ts";
import {
  normalizeWechatArticleMarkdownBody,
  parseWechatMarkdownToBlocks,
} from "../workspace/wechat-markdown.ts";

export type DraftGenerationInfo = {
  generatorVersion: string;
  modelProvider: string;
  modelName: string;
  rewriteMode?: GenerationContext["rewriteMode"];
  usedLongformRewrite?: boolean;
  rewriteChunkCount?: number;
  rewriteBriefVersion?: string;
  wechatFinalizationEnabled?: boolean;
  wechatFinalizationApplied?: boolean;
  wechatFinalizationTargetMinWords?: number;
  wechatFinalizationTargetMaxWords?: number;
};

export type GeneratedDraftResult = {
  autoTitle: string;
  content: PlatformContentMap;
  generatedPlatforms: PlatformType[];
  mockPlatforms: PlatformType[];
  generationInfo: DraftGenerationInfo;
};

export type WechatArticleGenerationResult = {
  article: WechatArticleContent;
  finalizationApplied?: boolean;
};

type GenerateDraftDeps = {
  modelProvider: string;
  modelName: string;
  generateWechatArticle: (
    context: GenerationContext,
  ) => Promise<WechatArticleContent | WechatArticleGenerationResult>;
  generateTwitterDraft: (
    context: GenerationContext,
  ) => Promise<TwitterContent>;
  generateXiaohongshuDraft: (
    context: GenerationContext,
  ) => Promise<XiaohongshuContent>;
  generateVideoScript: (
    context: GenerationContext,
  ) => Promise<VideoScriptContent>;
};

export async function generateDraft(
  context: GenerationContext,
  deps: GenerateDraftDeps,
): Promise<GeneratedDraftResult> {
  const mockPlatforms: PlatformType[] = [];
  const content: PlatformContentMap = {};
  let wechatFinalizationApplied = false;

  const realGenerationTasks: Array<Promise<void>> = [];

  if (context.selectedPlatforms.includes("wechat_article")) {
    realGenerationTasks.push(
      deps.generateWechatArticle(context).then((wechatResult) => {
        const normalized = normalizeWechatArticleGenerationResult(wechatResult);
        content.wechat_article = normalized.article;
        wechatFinalizationApplied = normalized.finalizationApplied;
      }),
    );
  }

  if (context.selectedPlatforms.includes("twitter")) {
    realGenerationTasks.push(
      deps.generateTwitterDraft(context).then((twitterDraft) => {
        content.twitter = twitterDraft;
      }),
    );
  }

  if (context.selectedPlatforms.includes("xiaohongshu")) {
    realGenerationTasks.push(
      deps.generateXiaohongshuDraft(context).then((xiaohongshuDraft) => {
        content.xiaohongshu = xiaohongshuDraft;
      }),
    );
  }

  if (context.selectedPlatforms.includes("video_script")) {
    realGenerationTasks.push(
      deps.generateVideoScript(context).then((videoScriptDraft) => {
        content.video_script = videoScriptDraft;
      }),
    );
  }

  if (realGenerationTasks.length > 0) {
    await Promise.all(realGenerationTasks);
  }

  const generatedPlatforms = context.selectedPlatforms.filter((platform) => {
    if (platform === "wechat_article") {
      return Boolean(content.wechat_article);
    }

    if (platform === "twitter") {
      return Boolean(content.twitter);
    }

    if (platform === "xiaohongshu") {
      return Boolean(content.xiaohongshu);
    }

    if (platform === "video_script") {
      return Boolean(content.video_script);
    }

    return false;
  });

  const remainingPlatforms = context.selectedPlatforms.filter(
    (platform) => !generatedPlatforms.includes(platform),
  );

  if (remainingPlatforms.length > 0) {
    const mockDraft = generateMockDraft({
      ...context,
      selectedPlatforms: remainingPlatforms,
    });

    Object.assign(content, mockDraft.content);
    mockPlatforms.push(...remainingPlatforms);
  }

  if (generatedPlatforms.length === 0) {
    const mockDraft = generateMockDraft(context);

    return {
      autoTitle: mockDraft.autoTitle,
      content: mockDraft.content,
      generatedPlatforms,
      mockPlatforms: [...context.selectedPlatforms],
      generationInfo: {
        generatorVersion: "mock-v1",
        modelProvider: "mock",
        modelName: "mock-v1",
        rewriteMode: context.rewriteMode,
        usedLongformRewrite: context.rewriteMode === "long_source",
        rewriteChunkCount: context.rewriteChunkCount,
        rewriteBriefVersion: context.rewriteBrief?.version,
        wechatFinalizationEnabled: context.wechatFinalization?.enabled === true,
        wechatFinalizationApplied,
        wechatFinalizationTargetMinWords: context.wechatFinalization?.targetMinWords,
        wechatFinalizationTargetMaxWords: context.wechatFinalization?.targetMaxWords,
      },
    };
  }

  return {
    autoTitle: deriveAutoTitle(context, content),
    content,
    generatedPlatforms,
    mockPlatforms,
    generationInfo: {
      generatorVersion: context.generatorVersion,
      modelProvider: deps.modelProvider,
      modelName: deps.modelName,
      rewriteMode: context.rewriteMode,
      usedLongformRewrite: context.rewriteMode === "long_source",
      rewriteChunkCount: context.rewriteChunkCount,
      rewriteBriefVersion: context.rewriteBrief?.version,
      wechatFinalizationEnabled: context.wechatFinalization?.enabled === true,
      wechatFinalizationApplied,
      wechatFinalizationTargetMinWords: context.wechatFinalization?.targetMinWords,
      wechatFinalizationTargetMaxWords: context.wechatFinalization?.targetMaxWords,
    },
  };
}

function normalizeWechatArticleGenerationResult(
  value: WechatArticleContent | WechatArticleGenerationResult,
): { article: WechatArticleContent; finalizationApplied: boolean } {
  if ("platform" in value) {
    return {
      article: normalizeWechatArticleCompatibility(value),
      finalizationApplied: false,
    };
  }

  return {
    article: normalizeWechatArticleCompatibility(value.article),
    finalizationApplied: value.finalizationApplied === true,
  };
}

function normalizeWechatArticleCompatibility(
  article: WechatArticleContent,
): WechatArticleContent {
  const normalized = normalizeWechatArticleMarkdownBody(article);

  return {
    ...normalized,
    blocks: parseWechatMarkdownToBlocks(normalized.markdownBody ?? ""),
  };
}

function deriveAutoTitle(
  context: GenerationContext,
  content: PlatformContentMap,
) {
  if (content.wechat_article?.title) {
    return content.wechat_article.title;
  }

  if (content.twitter?.singleDraft) {
    return truncateTitle(content.twitter.singleDraft);
  }

  if (content.xiaohongshu?.title) {
    return content.xiaohongshu.title;
  }

  if (content.video_script?.title) {
    return content.video_script.title;
  }

  return generateMockDraft(context).autoTitle;
}

function truncateTitle(value: string) {
  const normalized = value.trim();

  if (normalized.length <= 28) {
    return normalized;
  }

  return `${normalized.slice(0, 27).trim()}…`;
}
