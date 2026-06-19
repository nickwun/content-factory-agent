import type { WechatBlock } from "../types/history.ts";
import { parseWechatHeadingContent } from "../workspace/wechat-editor-formatting.ts";

type BuildWechatCoverImagePromptInput = {
  articleTitle: string;
  articleBlocks: WechatBlock[];
};

const MAX_THEME_SUMMARY_LENGTH = 220;

export function buildWechatCoverImagePrompt(
  input: BuildWechatCoverImagePromptInput,
) {
  const title = input.articleTitle.trim();
  const themeSummary = summarizeWechatArticleTheme(input.articleBlocks);

  return [
    "请生成一张适合作为公众号文章头图的视觉图片。",
    "画面目标：公众号头图，横向 4:3 构图，主体明确，画面简洁，留白自然，更像内容封面而不是广告海报。",
    title ? `文章标题：${title}` : "",
    themeSummary ? `主题摘要：${themeSummary}` : "",
    "风格要求：纯图案或纯视觉场景，不要任何文字，不要标题字，不要宣传口号，不要大字标题感，不要做成海报。",
    "如果出现人物，请使用东亚人形象，气质自然真实，不要夸张摆拍。",
    "负向约束：no text, no letters, no numbers, no captions, no signage, no labels, no logos, no UI screenshot, no app interface, no watermarks.",
    "画面约束：不要做成广告横幅，不要做成手机截图，不要出现明显按钮、卡片式 UI、对话框或软件界面。",
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeWechatArticleTheme(blocks: WechatBlock[]) {
  const segments: string[] = [];

  for (const block of blocks) {
    if (block.type === "divider") {
      continue;
    }

    if (block.type === "list") {
      const listText = block.items.join("，").trim();
      if (listText) {
        segments.push(listText);
      }
      continue;
    }

    const visibleText =
      block.type === "heading"
        ? parseWechatHeadingContent(block.text).text
        : block.text.trim();

    if (visibleText) {
      segments.push(visibleText);
    }

    if (segments.join(" ").length >= MAX_THEME_SUMMARY_LENGTH) {
      break;
    }
  }

  const summary = segments.join(" ").replace(/\s+/g, " ").trim();

  if (!summary) {
    return "";
  }

  if (summary.length <= MAX_THEME_SUMMARY_LENGTH) {
    return summary;
  }

  return `${summary.slice(0, MAX_THEME_SUMMARY_LENGTH - 1).trim()}…`;
}
