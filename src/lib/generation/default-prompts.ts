import type { PlatformType } from "../types/platform";
import type { PlatformPromptSetting } from "../settings/prompt-settings-types";

const DEFAULT_PROMPT_TEMPLATES: Record<PlatformType, string> = {
  wechat_article:
    "生成一篇适合公众号发布的长文，强调结构完整、论点清晰、适合深度阅读。",
  xiaohongshu:
    "生成一篇适合小红书发布的笔记，包含吸睛标题、图片建议、正文文案与标签。",
  twitter:
    "生成适合 Twitter 发布的内容，优先判断 single 或 thread，并输出简洁有力的表达。",
  video_script:
    "生成一份适合短视频创作的视频脚本，包含分镜、旁白和时长节奏。",
};

export function getDefaultPromptSetting(
  platform: PlatformType,
): PlatformPromptSetting {
  return {
    id: `default-prompt-${platform}`,
    platform,
    name: "默认",
    promptTemplate: DEFAULT_PROMPT_TEMPLATES[platform],
    defaultTemplate: DEFAULT_PROMPT_TEMPLATES[platform],
    isDefault: true,
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
  };
}

export function getDefaultPromptSettings(
  platforms: PlatformType[],
): PlatformPromptSetting[] {
  return platforms.map((platform) => getDefaultPromptSetting(platform));
}
