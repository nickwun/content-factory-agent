import type { WechatBlock } from "../types/history.ts";
import {
  extractVisibleWechatMarkdownText,
  type WechatMarkdownNode,
  parseWechatMarkdownDocument,
} from "../workspace/wechat-markdown.ts";
import { renderWechatMarkdownExportHtml } from "../workspace/wechat-markdown-export.ts";
import type { WechatPublishSnapshot } from "./types.ts";
import { resolveAbsoluteImageUrl } from "./xiaohongshu-publish-mapper.ts";

export type WechatArticlePublishPayload = {
  title: string;
  content: string;
  summary: string;
  coverImage?: string;
  contentFormat: "html";
  articleType: "news";
};

export type WechatXiaolvshuPublishPayload = {
  title: string;
  content: string;
  coverImage?: string;
  mainImages: string[];
  articleType: "newspic";
};

export function mapWechatSnapshotToArticlePayload(
  snapshot: WechatPublishSnapshot,
  baseOrigin: string,
): WechatArticlePublishPayload {
  const resolvedCoverImageUrl = snapshot.coverImageUrl
    ? resolveAbsoluteImageUrl(snapshot.coverImageUrl, baseOrigin)
    : undefined;

  return {
    title: snapshot.title.trim(),
    content: renderWechatArticleHtml(
      {
        markdownBody: snapshot.markdownBody,
        blocks: snapshot.blocks,
      },
      resolvedCoverImageUrl,
    ),
    summary: buildWechatDigest({
      markdownBody: snapshot.markdownBody,
      blocks: snapshot.blocks,
    }),
    ...(resolvedCoverImageUrl ? { coverImage: resolvedCoverImageUrl } : {}),
    contentFormat: "html",
    articleType: "news",
  };
}

export function mapWechatSnapshotToXiaolvshuPayload(
  snapshot: WechatPublishSnapshot,
): WechatXiaolvshuPublishPayload {
  const related = snapshot.relatedXiaohongshu;

  if (!related || related.imageUrls.length === 0) {
    throw new Error("Missing xiaohongshu assets for xiaolvshu publish");
  }

  return {
    title: related.title.trim(),
    content: buildWechatXiaolvshuPlainText(related.caption, related.tags),
    coverImage: related.imageUrls[0],
    mainImages: related.imageUrls.slice(1),
    articleType: "newspic",
  };
}

export function renderWechatBlocksToHtml(blocks: WechatBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        const tag = block.level === 3 ? "h3" : "h2";
        return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
      }

      if (block.type === "paragraph") {
        return `<p>${escapeHtml(block.text)}</p>`;
      }

      if (block.type === "quote") {
        return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
      }

      if (block.type === "list") {
        const items = block.items
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      return "<hr />";
    })
    .join("");
}

export function renderWechatArticleHtml(
  source: {
    markdownBody?: string;
    blocks: WechatBlock[];
  },
  coverImageUrl?: string,
) {
  const coverImageHtml = coverImageUrl
    ? `<p><img src="${escapeHtml(coverImageUrl)}" alt="" /></p>`
    : "";

  const bodyHtml =
    typeof source.markdownBody === "string" && source.markdownBody.trim().length > 0
      ? renderWechatMarkdownExportHtml(source.markdownBody)
      : renderWechatBlocksToHtml(source.blocks);

  return `${coverImageHtml}${bodyHtml}`;
}

export function buildWechatDigest(
  source:
    | WechatBlock[]
    | {
        markdownBody?: string;
        blocks: WechatBlock[];
      },
) {
  const normalizedSource = Array.isArray(source)
    ? { blocks: source }
    : source;

  if (
    typeof normalizedSource.markdownBody === "string" &&
    normalizedSource.markdownBody.trim().length > 0
  ) {
    return extractWechatMarkdownDigest(normalizedSource.markdownBody);
  }

  const plainParts: string[] = [];

  for (const block of normalizedSource.blocks) {
    if (block.type === "paragraph" || block.type === "quote") {
      plainParts.push(block.text.trim());
    } else if (block.type === "heading") {
      plainParts.push(block.text.trim());
    } else if (block.type === "list") {
      plainParts.push(block.items.join(" "));
    }

    if (plainParts.join(" ").length >= 120) {
      break;
    }
  }

  return plainParts.join(" ").slice(0, 120).trim();
}

function extractWechatMarkdownDigest(markdownBody: string) {
  const nodes = parseWechatMarkdownDocument(markdownBody);
  const plainParts: string[] = [];

  for (const node of nodes) {
    const text = getMarkdownNodeDigestText(node);

    if (text.length > 0) {
      plainParts.push(text);
    }

    if (plainParts.join(" ").length >= 120) {
      break;
    }
  }

  const digest = plainParts.join(" ").slice(0, 120).trim();

  return digest || extractVisibleWechatMarkdownText(markdownBody).slice(0, 120).trim();
}

function getMarkdownNodeDigestText(node: WechatMarkdownNode) {
  switch (node.type) {
    case "heading":
    case "paragraph":
    case "quote":
      return node.text.trim();
    case "list":
      return node.items.join(" ").trim();
    case "divider":
    default:
      return "";
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildWechatXiaolvshuPlainText(caption: string, tags: string[]) {
  const captionText = caption
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  const renderedTags = tags
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");

  return [captionText, renderedTags].filter(Boolean).join("\n\n").slice(0, 600).trim();
}
