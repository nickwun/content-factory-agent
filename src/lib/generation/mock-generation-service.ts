import type { PlatformContentMap } from "../types/history";
import type { PlatformType } from "../types/platform";
import type { GenerationContext } from "./generation-context";

export type MockGeneratedDraft = {
  autoTitle: string;
  content: PlatformContentMap;
};

const EFFICIENCY_PROMPT = "写一篇关于如何提高工作效率的内容";

export function generateMockDraft(
  context: GenerationContext,
): MockGeneratedDraft {
  const autoTitle = getAutoTitle(context.userPrompt);
  const content: PlatformContentMap = {};

  for (const platform of context.selectedPlatforms) {
    const promptHint = getPromptHint(
      platform,
      context.promptSettings[platform]?.promptTemplate ?? "",
    );

    if (platform === "wechat_article") {
      content.wechat_article = buildWechatArticle(autoTitle, promptHint);
    }

    if (platform === "xiaohongshu") {
      content.xiaohongshu = buildXiaohongshuNote(promptHint);
    }

    if (platform === "twitter") {
      content.twitter = buildTwitterThread(promptHint);
    }

    if (platform === "video_script") {
      content.video_script = buildVideoScript(promptHint);
    }
  }

  return {
    autoTitle,
    content,
  };
}

function getAutoTitle(userPrompt: string) {
  if (userPrompt.includes(EFFICIENCY_PROMPT)) {
    return "高效工作的 5 个底层逻辑";
  }

  return "多平台内容创作草稿";
}

function buildWechatArticle(title: string, promptHint: string) {
  return {
    platform: "wechat_article" as const,
    title,
    blocks: [
      {
        id: "wechat-heading-1",
        type: "heading" as const,
        level: 2 as const,
        text: "为什么多数人越努力，反而越忙",
      },
      {
        id: "wechat-paragraph-1",
        type: "paragraph" as const,
        text: "真正的效率，不是把一天塞满，而是让重要的事情持续产出。**高效工作**背后往往不是技巧堆砌，而是更清晰的判断与更稳定的系统。",
      },
      {
        id: "wechat-list-1",
        type: "list" as const,
        items: [
          "先区分重要与紧急",
          "把注意力交给少数关键任务",
          "减少切换成本",
          "让流程可复用",
          "用复盘持续修正系统",
        ],
      },
      {
        id: "wechat-quote-1",
        type: "quote" as const,
        text: "效率的本质，不是做得更快，而是做得更对。",
      },
      {
        id: "wechat-divider-1",
        type: "divider" as const,
      },
      {
        id: "wechat-heading-2",
        type: "heading" as const,
        level: 3 as const,
        text: "把高效变成长期能力",
      },
      {
        id: "wechat-paragraph-2",
        type: "paragraph" as const,
        text: `当任务选择、执行节奏和反馈机制形成闭环，效率才会从偶尔爆发，变成稳定的工作方式。当前生成偏好强调：${promptHint}。`,
      },
    ],
  };
}

function buildXiaohongshuNote(promptHint: string) {
  return {
    platform: "xiaohongshu" as const,
    title: "工作效率翻倍！我的 5 个神仙方法✨",
    caption:
      `以前我总觉得自己很忙，但结果并不多。后来我才发现，效率不是靠熬，而是靠系统。最近这套 5 步方法真的帮我把工作节奏稳定下来：先做优先级排序，再安排深度工作时间块，接着把重复动作模板化，同时减少消息切换，最后每天用 10 分钟复盘。坚持下来以后，不仅事情做得更快，心也没那么乱了。如果你也总觉得一天被琐事打散，可以试试这套方法。本次提示词更强调：${promptHint}。`,
    imageSuggestions: Array.from({ length: 9 }, (_, index) => ({
      id: `xhs-image-${index + 1}`,
      index: index + 1,
      title: `配图建议 ${index + 1}`,
      description: `展示与效率主题相关的画面，如桌面规划、时间分块、任务清单或深度工作场景。`,
      status: "suggested" as const,
    })),
    tags: ["工作效率", "自我提升", "时间管理", "职场干货"],
  };
}

function buildTwitterThread(promptHint: string) {
  return {
    platform: "twitter" as const,
    mode: "thread" as const,
    userLockedMode: false,
    autoDetectedMode: "thread" as const,
    singleDraft: `Hook: ${promptHint}. High performance at work usually comes from systems, not motivation.`,
    threadDraft: Array.from({ length: 10 }, (_, index) =>
      buildTweetLine(index + 1, promptHint),
    ),
  };
}

function buildTweetLine(index: number, promptHint: string) {
  const tweets = [
    `1/ ${promptHint}。Most productivity advice is too shallow. Real efficiency starts with deciding what is worth doing at all.`,
    "2/ If everything is urgent, nothing is strategic. Strong prioritization is the first productivity multiplier.",
    "3/ Deep work is not about willpower. It is about protecting time from constant switching.",
    "4/ Repeated tasks should become templates, not recurring decisions.",
    "5/ Meetings, messages, and tabs all carry hidden context-switch costs.",
    "6/ Energy management matters as much as calendar management.",
    "7/ A short daily review can save hours of random drift.",
    "8/ Good systems reduce friction before motivation is needed.",
    "9/ High performers build environments that make focus easier.",
    "10/ Productivity is not doing more. It is creating more value with less chaos.",
  ];

  return tweets[index - 1] ?? `${index}/ Productivity insight`;
}

function buildVideoScript(promptHint: string) {
  return {
    platform: "video_script" as const,
    title: "3 分钟讲清高效工作的 5 个底层逻辑",
    duration: "3:00",
    scenes: [
      {
        id: "scene-1",
        index: 1,
        shot: "镜头扫过凌乱办公桌，切到待办事项堆积的电脑屏幕。",
        voiceover: "你是不是也经常忙了一整天，却说不清自己真正推进了什么？",
      },
      {
        id: "scene-2",
        index: 2,
        shot: "出现优先级矩阵和时间块安排的界面示意。",
        voiceover: "高效工作的第一步，不是更努力，而是先判断什么最值得做。",
      },
      {
        id: "scene-3",
        index: 3,
        shot: "展示模板化流程、番茄钟和消息免打扰的工作状态。",
        voiceover: "减少切换、复用流程、保护深度工作时间，效率会明显提升。",
      },
      {
        id: "scene-4",
        index: 4,
        shot: "人物收尾总结，画面出现 5 个底层逻辑关键词。",
        voiceover: `当你把效率变成系统，而不是情绪驱动，稳定产出就会越来越容易。这一版脚本额外强调：${promptHint}。`,
      },
    ],
  };
}

function getPromptHint(platform: PlatformType, promptTemplate: string) {
  const template = promptTemplate.trim();

  if (!template) {
    return getDefaultHint(platform);
  }

  const lower = template.toLowerCase();

  if (lower.includes("hook") || template.includes("钩子")) {
    return "观点钩子更强";
  }

  if (template.includes("陪伴")) {
    return "陪伴式经验分享";
  }

  if (template.includes("深度")) {
    return "深度表达";
  }

  if (template.includes("节奏")) {
    return "节奏更清晰";
  }

  return template.replace(/^新的[^：:]*[：:]/, "").slice(0, 14);
}

function getDefaultHint(platform: PlatformType) {
  if (platform === "twitter") {
    return "观点表达直接";
  }

  if (platform === "xiaohongshu") {
    return "经验分享感";
  }

  if (platform === "video_script") {
    return "分镜节奏清楚";
  }

  return "结构完整";
}
