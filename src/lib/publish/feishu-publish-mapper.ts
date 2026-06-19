import {
  parseWechatMarkdownDocument,
  serializeWechatBlocksToMarkdown,
  type WechatMarkdownNode,
} from "../workspace/wechat-markdown.ts";
import { resolveAbsoluteImageUrl } from "./xiaohongshu-publish-mapper.ts";
import type {
  FeishuDocxBlock,
  FeishuDocxTextRun,
  FeishuPublishPayload,
  FeishuPublishSnapshot,
} from "./types.ts";

export function mapFeishuSnapshotToPayload(
  snapshot: FeishuPublishSnapshot,
  baseOrigin: string,
): FeishuPublishPayload {
  const markdownBody =
    snapshot.markdownBody?.trim() || serializeWechatBlocksToMarkdown(snapshot.blocks);
  const blocks = renderFeishuMarkdownToBlockPlan(snapshot.title, markdownBody);
  const resolvedCoverImageUrl = snapshot.coverImageUrl
    ? resolveAbsoluteImageUrl(snapshot.coverImageUrl, baseOrigin)
    : undefined;

  return {
    title: snapshot.title.trim(),
    blocks,
    ...(resolvedCoverImageUrl ? { coverImageUrl: resolvedCoverImageUrl } : {}),
  };
}

export function renderFeishuMarkdownToBlockPlan(title: string, markdown: string) {
  const normalizedTitle = title.trim();
  const nodes = parseWechatMarkdownDocument(markdown);

  return [
    createHeadingBlock(1, normalizedTitle),
    ...nodes.flatMap(convertMarkdownNodeToFeishuBlocks),
  ];
}

function convertMarkdownNodeToFeishuBlocks(node: WechatMarkdownNode): FeishuDocxBlock[] {
  switch (node.type) {
    case "heading":
      return [createHeadingBlock(node.level, node.text)];
    case "quote":
      return [{
        block_type: 15,
        quote: {
          elements: createTextRuns(node.text),
        },
      }];
    case "list":
      return node.items.map((item) =>
        ({
          block_type: node.ordered ? 13 : 12,
          [node.ordered ? "ordered" : "bullet"]: {
            elements: createTextRuns(item),
          },
        }) as FeishuDocxBlock,
      );
    case "divider":
      return [{
        block_type: 22,
        divider: {},
      }];
    case "paragraph":
    default:
      return [{
        block_type: 2,
        text: {
          elements: createTextRuns(node.text),
        },
      }];
  }
}

function createHeadingBlock(level: 1 | 2 | 3, text: string): FeishuDocxBlock {
  if (level === 1) {
    return {
      block_type: 3,
      heading1: {
        elements: createTextRuns(text),
      },
    };
  }

  if (level === 2) {
    return {
      block_type: 4,
      heading2: {
        elements: createTextRuns(text),
      },
    };
  }

  return {
    block_type: 5,
    heading3: {
      elements: createTextRuns(text),
    },
  };
}

function createTextRuns(content: string): FeishuDocxTextRun[] {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return [createTextRun("")];
  }

  const segments = normalizedContent.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  const runs = segments.map((segment) => {
    const boldMatch = /^\*\*([^*]+)\*\*$/.exec(segment);

    if (boldMatch) {
      return createTextRun(boldMatch[1] ?? "", { bold: true });
    }

    return createTextRun(segment);
  });

  return runs.length > 0 ? runs : [createTextRun(normalizedContent)];
}

function createTextRun(
  content: string,
  options?: { bold?: boolean },
): FeishuDocxTextRun {
  return {
    text_run: {
      content,
      ...(options?.bold
        ? {
            text_element_style: {
              bold: true,
            },
          }
        : {}),
    },
  };
}
