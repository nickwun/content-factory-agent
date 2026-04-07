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

export type DraftGenerationInfo = {
  generatorVersion: string;
  modelProvider: string;
  modelName: string;
};

export type GeneratedDraftResult = {
  autoTitle: string;
  content: PlatformContentMap;
  generatedPlatforms: PlatformType[];
  mockPlatforms: PlatformType[];
  generationInfo: DraftGenerationInfo;
};

type GenerateDraftDeps = {
  modelProvider: string;
  modelName: string;
  generateWechatArticle: (
    context: GenerationContext,
  ) => Promise<WechatArticleContent>;
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

  const realGenerationTasks: Array<Promise<void>> = [];

  if (context.selectedPlatforms.includes("wechat_article")) {
    realGenerationTasks.push(
      deps.generateWechatArticle(context).then((wechatArticle) => {
        content.wechat_article = wechatArticle;
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
    },
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
