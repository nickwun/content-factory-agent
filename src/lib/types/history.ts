import type { PlatformType } from "./platform";

export type PromptSettingsVersionMap = Partial<Record<PlatformType, string>>;
export type PromptSnapshotMap = Partial<Record<PlatformType, string>>;
export type PromptPresetIdMap = Partial<Record<PlatformType, string>>;
export type PromptPresetNameMap = Partial<Record<PlatformType, string>>;

export type WechatBlock =
  | {
      id: string;
      type: "heading";
      level: 2 | 3;
      text: string;
    }
  | {
      id: string;
      type: "paragraph" | "quote";
      text: string;
    }
  | {
      id: string;
      type: "divider";
    }
  | {
      id: string;
      type: "list";
      items: string[];
    };

export type WechatArticleContent = {
  platform: "wechat_article";
  title: string;
  markdownBody?: string;
  blocks: WechatBlock[];
  coverImage?: WechatCoverImage;
};

export type WechatCoverImage = {
  status: "idle" | "generating" | "generated" | "failed";
  imageUrl?: string;
  prompt?: string;
  model?: string;
  error?: string;
  generatedAt?: string;
  previousImage?: {
    imageUrl: string;
    prompt?: string;
    model?: string;
    generatedAt?: string;
  };
};

export type XiaohongshuImageSuggestion = {
  id: string;
  index: number;
  title: string;
  description: string;
  status: "suggested" | "generating" | "generated" | "failed";
  imagePrompt?: string;
  imageUrl?: string;
  imageModel?: string;
  imageError?: string;
  imageFailureReason?:
    | "failed_ratio_check"
    | "failed_text_ui_check"
    | "failed_upstream_generation";
  generatedAt?: string;
};

export type XiaohongshuContent = {
  platform: "xiaohongshu";
  title: string;
  caption: string;
  imageSuggestions: XiaohongshuImageSuggestion[];
  tags: string[];
};

export type TwitterContent = {
  platform: "twitter";
  mode: "single" | "thread";
  userLockedMode: boolean;
  autoDetectedMode: "single" | "thread";
  singleDraft: string;
  threadDraft: string[];
};

export type VideoScene = {
  id: string;
  index: number;
  shot: string;
  voiceover: string;
};

export type VideoScriptContent = {
  platform: "video_script";
  title: string;
  duration: string;
  scenes: VideoScene[];
};

export type PlatformContentMap = {
  wechat_article?: WechatArticleContent;
  xiaohongshu?: XiaohongshuContent;
  twitter?: TwitterContent;
  video_script?: VideoScriptContent;
};

export type WorkspaceSnapshot = {
  activePlatform: PlatformType;
  platformOrder: PlatformType[];
  lastViewedAt: string;
};

export type GenerationMetadata = {
  generatorVersion: string;
  modelProvider: string;
  modelName: string;
  generatedAt: string;
  hasRewriteSource?: boolean;
  rewriteSourceKind?: "pasted_text" | "uploaded_file";
  rewriteSourceName?: string;
  rewriteSourceCharCount?: number;
  rewriteSourceTruncated?: boolean;
  rewriteMode?: "none" | "short_source" | "long_source";
  usedLongformRewrite?: boolean;
  rewriteChunkCount?: number;
  rewriteBriefVersion?: string;
  wechatFinalizationEnabled?: boolean;
  wechatFinalizationApplied?: boolean;
  wechatFinalizationTargetMinWords?: number;
  wechatFinalizationTargetMaxWords?: number;
  selectedPlatformsSnapshot: PlatformType[];
  promptSnapshotByPlatform: PromptSnapshotMap;
  promptPresetIdByPlatform?: PromptPresetIdMap;
  promptPresetNameByPlatform?: PromptPresetNameMap;
  settingsVersionByPlatform?: PromptSettingsVersionMap;
};

export type HistoryRecordTraceContext = {
  sourceKind: "direct_create" | "rewrite_task";
  topicClusterId?: string;
  topicClusterTitle?: string;
  rewriteTaskId?: string;
  representativeArticleIds?: string[];
  createdFromPlatform?: "wechat_article";
};

export type HistoryRecord = {
  id: string;
  schemaVersion: 1;
  autoTitle: string;
  title: string;
  isCustomTitle: boolean;
  userPrompt: string;
  selectedPlatforms: PlatformType[];
  createdAt: string;
  updatedAt: string;
  generation: GenerationMetadata;
  content: PlatformContentMap;
  workspace: WorkspaceSnapshot;
  traceContext?: HistoryRecordTraceContext;
};
