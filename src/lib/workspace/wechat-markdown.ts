import type { WechatArticleContent, WechatBlock } from "../types/history.ts";
import { createRandomId } from "../utils/create-random-id.ts";

export type WechatMarkdownNode =
  | {
      type: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "quote";
      text: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: string[];
    }
  | {
      type: "divider";
    };

const EMPTY_PARAGRAPH = (): WechatBlock => ({
  id: createRandomId("wechat-markdown"),
  type: "paragraph",
  text: "",
});

export function resolveWechatMarkdownBody(
  article: Pick<WechatArticleContent, "markdownBody" | "blocks">,
) {
  if (typeof article.markdownBody === "string" && article.markdownBody.trim().length > 0) {
    return article.markdownBody;
  }

  return serializeWechatBlocksToMarkdown(article.blocks);
}

export function normalizeWechatArticleMarkdownBody(
  article: WechatArticleContent,
): WechatArticleContent {
  const markdownBody = resolveWechatMarkdownBody(article);

  return {
    ...article,
    markdownBody,
  };
}

export function serializeWechatBlocksToMarkdown(blocks: WechatBlock[]) {
  if (blocks.length === 0) {
    return "";
  }

  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${block.level === 3 ? "###" : "##"} ${block.text.trim()}`;
        case "quote":
          return block.text
            .split(/\r?\n/)
            .map((line) => `> ${line.trim()}`)
            .join("\n");
        case "divider":
          return "---";
        case "list":
          return block.items.map((item) => `- ${item.trim()}`).join("\n");
        case "paragraph":
        default:
          return block.text.trim();
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export function parseWechatMarkdownDocument(markdown: string): WechatMarkdownNode[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();

  if (normalized.length === 0) {
    return [{ type: "paragraph", text: "" }];
  }

  const sections = normalized
    .split(/\n\s*\n+/)
    .map((section) => section.trim())
    .filter(Boolean);

  const nodes = sections
    .map(parseMarkdownSectionToNode)
    .filter((node): node is WechatMarkdownNode => node !== null);

  return nodes.length > 0 ? nodes : [{ type: "paragraph", text: "" }];
}

export function parseWechatMarkdownToBlocks(markdown: string): WechatBlock[] {
  const nodes = parseWechatMarkdownDocument(markdown);
  const blocks = nodes
    .map(convertMarkdownNodeToWechatBlock)
    .filter((block): block is WechatBlock => block !== null);

  return blocks.length > 0 ? blocks : [EMPTY_PARAGRAPH()];
}

export function extractVisibleWechatMarkdownText(markdown: string) {
  return parseWechatMarkdownDocument(markdown)
    .map((node) => {
      switch (node.type) {
        case "divider":
          return "";
        case "list":
          return node.items.map(stripInlineMarkdownMarkers).join("\n");
        default:
          return stripInlineMarkdownMarkers(node.text);
      }
    })
    .join("\n")
    .replace(/\s+/g, "");
}

export function countWechatMarkdownWords(title: string, markdownBody: string) {
  const titleCount = title.replace(/\s+/g, "").length;
  const bodyCount = extractVisibleWechatMarkdownText(markdownBody).length;

  return {
    titleCount,
    bodyCount,
    totalCount: titleCount + bodyCount,
  };
}

function parseMarkdownSectionToNode(section: string): WechatMarkdownNode | null {
  if (/^---+$/.test(section)) {
    return { type: "divider" };
  }

  const headingMatch = section.match(/^(#{1,3})\s+(.+)$/);
  if (headingMatch) {
    const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
    return {
      type: "heading",
      level,
      text: headingMatch[2].trim(),
    };
  }

  const lines = section.split("\n").map((line) => line.trim());

  if (lines.every((line) => line.startsWith("> "))) {
    const text = lines
      .map((line) => line.slice(2).trim())
      .filter(Boolean)
      .join(" ");

    return text.length > 0 ? { type: "quote", text } : null;
  }

  if (lines.every((line) => /^[-*+]\s+/.test(line))) {
    const items = lines
      .map((line) => line.replace(/^[-*+]\s+/, "").trim())
      .filter(Boolean);

    return items.length > 0 ? { type: "list", ordered: false, items } : null;
  }

  if (lines.every((line) => /^\d+\.\s+/.test(line))) {
    const items = lines
      .map((line) => line.replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean);

    return items.length > 0 ? { type: "list", ordered: true, items } : null;
  }

  return {
    type: "paragraph",
    text: section,
  };
}

function convertMarkdownNodeToWechatBlock(node: WechatMarkdownNode): WechatBlock | null {
  switch (node.type) {
    case "heading":
      return {
        id: createRandomId("wechat-markdown"),
        type: "heading",
        level: node.level === 3 ? 3 : 2,
        text: node.text,
      };
    case "quote":
      return {
        id: createRandomId("wechat-markdown"),
        type: "quote",
        text: node.text,
      };
    case "list":
      return {
        id: createRandomId("wechat-markdown"),
        type: "list",
        items: node.items,
      };
    case "divider":
      return {
        id: createRandomId("wechat-markdown"),
        type: "divider",
      };
    case "paragraph":
      return {
        id: createRandomId("wechat-markdown"),
        type: "paragraph",
        text: node.text,
      };
    default:
      return null;
  }
}

function stripInlineMarkdownMarkers(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .trim();
}
