/**
 * Raphael-style WeChat copy adapter.
 *
 * Inspired by Raphael Publish:
 * https://github.com/liuxiaopai-ai/raphael-publish
 *
 * Raphael Publish is MIT licensed.
 * Copyright (c) 2024 Raphael Editor Contributors.
 *
 * This adapter now follows the Raphael core copy pipeline:
 * markdown -> markdown-it -> applyTheme -> makeWeChatCompatible -> HTML.
 * It does not read from preview DOM and does not replace the existing legacy
 * copy/export pipeline until real WeChat + mobile preview validation passes.
 *
 * Validation status:
 * - Passed Chromium clipboard checks for text/html and text/plain output.
 * - Passed basic paste validation in the real WeChat Official Account editor.
 * - Mobile preview and old/new copy A/B comparison still require manual review.
 */

import { renderRaphaelMarkdownHtml } from "./raphael-markdown.ts";
import {
  applyRaphaelTheme,
  makeWeChatCompatibleHtml,
} from "./raphael-wechat-compat.ts";

type RaphaelWechatCopyOptions = {
  themeId?: string;
};

export function renderRaphaelWechatCopyHtml(
  markdown: string,
  options: RaphaelWechatCopyOptions = {},
) {
  const rawHtml = renderRaphaelMarkdownHtml(normalizeRaphaelCopyMarkdown(markdown));
  const themedHtml = applyRaphaelTheme(rawHtml, options.themeId);
  return makeWeChatCompatibleHtml(themedHtml, options.themeId);
}

export function normalizeRaphaelCopyMarkdown(markdown: string) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const hasExplicitMarkdownStructure = lines.some((line) =>
    /^(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)/.test(line.trim()),
  );
  const normalizedLines = lines.map((line) => {
    const trimmed = line.trim();

    if (
      !hasExplicitMarkdownStructure &&
      isPlainNumberedSectionHeading(trimmed)
    ) {
      return `## ${trimmed}`;
    }

    return line;
  });

  if (!hasExplicitMarkdownStructure) {
    const firstContentIndex = normalizedLines.findIndex((line) => line.trim());
    const firstContent = normalizedLines[firstContentIndex]?.trim() ?? "";

    if (firstContentIndex >= 0 && shouldPromoteLeadParagraph(firstContent)) {
      normalizedLines[firstContentIndex] = `> ${firstContent}`;
    }
  }

  return normalizedLines.join("\n");
}

function isPlainNumberedSectionHeading(line: string) {
  if (!line || line.length > 64) return false;

  return /^(?:0?[1-9]|[1-9]\d|[０-９]{1,2})[、.．]\s*\S+/.test(line);
}

function shouldPromoteLeadParagraph(line: string) {
  if (!line || line.length > 180) return false;
  if (isPlainNumberedSectionHeading(line)) return false;
  if (/^(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)/.test(line)) return false;

  return true;
}
