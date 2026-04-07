import type { PlatformType } from "./platform";

export type PromptSettingsVersionMap = Partial<Record<PlatformType, string>>;
export type PromptSnapshotMap = Partial<Record<PlatformType, string>>;

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
  blocks: WechatBlock[];
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
  selectedPlatformsSnapshot: PlatformType[];
  promptSnapshotByPlatform: PromptSnapshotMap;
  settingsVersionByPlatform?: PromptSettingsVersionMap;
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
};
