import type { WechatArticleContent, WechatBlock } from "../types/history.ts";

export type RawWechatArticleOutput = {
  title?: unknown;
  blocks?: unknown;
};

const DEFAULT_TITLE = "未命名公众号草稿";
export const DEFAULT_WECHAT_PLACEHOLDER =
  "这是一篇新生成的公众号草稿，请继续完善具体内容。";

export function normalizeWechatArticleOutput(
  raw: unknown,
): WechatArticleContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid wechat article output");
  }

  const source = raw as RawWechatArticleOutput;
  const title =
    typeof source.title === "string" && source.title.trim()
      ? source.title.trim()
      : DEFAULT_TITLE;

  const blocks = normalizeBlocks(source.blocks);

  return {
    platform: "wechat_article",
    title,
    blocks:
      blocks.length > 0
        ? blocks
        : [
            {
              id: crypto.randomUUID(),
              type: "paragraph",
              text: DEFAULT_WECHAT_PLACEHOLDER,
            },
          ],
  };
}

function normalizeBlocks(rawBlocks: unknown): WechatBlock[] {
  if (rawBlocks === undefined) {
    return [];
  }

  if (!Array.isArray(rawBlocks)) {
    throw new Error("Invalid wechat article output");
  }

  return rawBlocks
    .map((block) => normalizeBlock(block))
    .filter((block): block is WechatBlock => block !== null);
}

function normalizeBlock(rawBlock: unknown): WechatBlock | null {
  if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
    return null;
  }

  const candidate = rawBlock as Record<string, unknown>;
  const blockType = typeof candidate.type === "string" ? candidate.type : "paragraph";
  const text =
    typeof candidate.text === "string"
      ? candidate.text.trim()
      : typeof candidate.content === "string"
        ? candidate.content.trim()
        : "";

  if (blockType === "divider") {
    return {
      id: crypto.randomUUID(),
      type: "divider",
    };
  }

  if (blockType === "list") {
    const items = Array.isArray(candidate.items)
      ? candidate.items
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : text
        ? [text]
        : [];

    if (items.length === 0) {
      return null;
    }

    return {
      id: crypto.randomUUID(),
      type: "list",
      items,
    };
  }

  if (blockType === "heading") {
    return {
      id: crypto.randomUUID(),
      type: "heading",
      level: candidate.level === 3 ? 3 : 2,
      text: text || DEFAULT_WECHAT_PLACEHOLDER,
    };
  }

  if (blockType === "quote") {
    return {
      id: crypto.randomUUID(),
      type: "quote",
      text: text || DEFAULT_WECHAT_PLACEHOLDER,
    };
  }

  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: text || DEFAULT_WECHAT_PLACEHOLDER,
  };
}

export function assertMeaningfulWechatArticle(article: WechatArticleContent) {
  const textualBlocks = article.blocks.filter(
    (block) => block.type !== "divider",
  );

  const meaningfulBlocks = textualBlocks.filter((block) => {
    if (block.type === "list") {
      return block.items.some(
        (item) => item.trim() && item.trim() !== DEFAULT_WECHAT_PLACEHOLDER,
      );
    }

    return (
      block.text.trim() &&
      block.text.trim() !== DEFAULT_WECHAT_PLACEHOLDER
    );
  });

  if (meaningfulBlocks.length === 0) {
    throw new Error("Generated wechat article did not contain meaningful content");
  }
}

export function extractWechatArticleJsonPayload(rawText: string) {
  const text = rawText.trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const jsonText = findFirstJsonObject(candidate);

  if (!jsonText) {
    throw new Error("Invalid wechat article output");
  }

  return JSON.parse(jsonText);
}

function findFirstJsonObject(text: string) {
  const startIndex = text.indexOf("{");

  if (startIndex === -1) {
    return null;
  }

  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
