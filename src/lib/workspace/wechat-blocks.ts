import type { WechatArticleContent, WechatBlock } from "../types/history";

export type WechatStructureItem = {
  id: string;
  blockId: string | null;
  type: "title" | Exclude<WechatBlock["type"], "paragraph">;
  label: string;
  preview: string;
};

export function getWechatBlockLabel(block: WechatBlock) {
  switch (block.type) {
    case "heading":
      return "小标题";
    case "paragraph":
      return "段落";
    case "quote":
      return "引用";
    case "list":
      return "列表";
    case "divider":
      return "分隔线";
    default:
      return "内容块";
  }
}

export function buildWechatStructureItems(
  article: WechatArticleContent,
): WechatStructureItem[] {
  const items: WechatStructureItem[] = [
    {
      id: "article-title",
      blockId: null,
      type: "title",
      label: "标题",
      preview: article.title.trim() || "未命名文章",
    },
  ];

  for (const block of article.blocks) {
    if (block.type === "paragraph") {
      continue;
    }

    items.push({
      id: block.id,
      blockId: block.id,
      type: block.type,
      label: getWechatBlockLabel(block),
      preview: getWechatBlockPreview(block),
    });
  }

  return items;
}

export function removeWechatBlock(
  article: WechatArticleContent,
  blockId: string,
) {
  const nextBlocks = article.blocks.filter((block) => block.id !== blockId);

  if (nextBlocks.length === article.blocks.length) {
    return article;
  }

  return {
    ...article,
    blocks: nextBlocks,
  };
}

function getWechatBlockPreview(block: Exclude<WechatBlock, { type: "paragraph" }>) {
  switch (block.type) {
    case "heading":
    case "quote":
      return block.text.trim() || getWechatBlockLabel(block);
    case "list":
      return block.items[0]?.trim() || "列表内容";
    case "divider":
      return "结构分隔";
    default:
      return getWechatBlockLabel(block);
  }
}
