import type { WechatBlock } from "../types/history";
import { createRandomId } from "../utils/create-random-id";

const EMPTY_PARAGRAPH = (): WechatBlock => ({
  id: createRandomId("wechat-continuous"),
  type: "paragraph",
  text: "",
});

export function serializeWechatBlocksToContinuousText(
  blocks: WechatBlock[],
): string {
  if (blocks.length === 0) {
    return "";
  }

  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `## ${block.text.trim()}`;
        case "quote":
          return `> ${block.text.trim()}`;
        case "divider":
          return "---";
        case "list":
          return block.items.map((item) => `- ${item.trim()}`).join("\n").trim();
        case "paragraph":
          return block.text.trim();
        default:
          return "";
      }
    })
    .filter((section) => section.length > 0)
    .join("\n\n");
}

export function parseContinuousTextToWechatBlocks(text: string): WechatBlock[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (normalized.length === 0) {
    return [EMPTY_PARAGRAPH()];
  }

  const sections = normalized
    .split(/\n\s*\n+/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  const blocks = sections
    .map(parseSectionToBlock)
    .filter((block): block is WechatBlock => block !== null);

  return blocks.length > 0 ? blocks : [EMPTY_PARAGRAPH()];
}

function parseSectionToBlock(section: string): WechatBlock | null {
  if (section === "---") {
    return {
      id: createRandomId("wechat-continuous"),
      type: "divider",
    };
  }

  if (section.startsWith("## ")) {
    const headingText = section.slice(3).trim();

    if (headingText.length === 0) {
      return null;
    }

    return {
      id: createRandomId("wechat-continuous"),
      type: "heading",
      level: 2,
      text: headingText,
    };
  }

  if (section.startsWith("> ")) {
    const quoteText = section
      .split("\n")
      .map((line, index) => (index === 0 ? line.slice(2) : line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (quoteText.length === 0) {
      return null;
    }

    return {
      id: createRandomId("wechat-continuous"),
      type: "quote",
      text: quoteText,
    };
  }

  return {
    id: createRandomId("wechat-continuous"),
    type: "paragraph",
    text: section,
  };
}
