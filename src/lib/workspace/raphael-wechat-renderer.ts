/**
 * Raphael-style WeChat preview adapter.
 *
 * This file is a small, isolated adapter inspired by Raphael Publish:
 * https://github.com/liuxiaopai-ai/raphael-publish
 *
 * Raphael Publish is MIT licensed.
 * Copyright (c) 2024 Raphael Editor Contributors.
 *
 * Milestone 1 only uses the inline-theme preview idea. It intentionally avoids
 * importing Raphael's full Vite app, global CSS, clipboard logic, or DOM-only
 * WeChat copy serializer.
 */

export type RaphaelWechatThemeId = "wechat";

type RaphaelWechatRenderOptions = {
  themeId?: string;
};

type RaphaelWechatTheme = {
  id: RaphaelWechatThemeId;
  name: string;
  styles: Record<string, string>;
};

export const RAPHAEL_WECHAT_DEFAULT_THEME: RaphaelWechatThemeId = "wechat";

const RAPHAEL_WECHAT_THEMES: RaphaelWechatTheme[] = [
  {
    id: "wechat",
    name: "微信公众号原生",
    styles: {
      container:
        'max-width: 100%; margin: 0 auto; padding: 24px 20px 48px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 16px; line-height: 1.7 !important; color: #333333 !important; background-color: #ffffff !important; word-wrap: break-word;',
      h1: "font-size: 32px; font-weight: 700; color: #111 !important; line-height: 1.3 !important; margin: 38px 0 16px; letter-spacing: -0.015em;",
      h2: "font-size: 26px; font-weight: 600; color: #111 !important; line-height: 1.35 !important; margin: 32px 0 16px;",
      h3: "font-size: 21px; font-weight: 600; color: #333333 !important; line-height: 1.4 !important; margin: 28px 0 14px;",
      h4: "font-size: 18px; font-weight: 600; color: #333333 !important; line-height: 1.4 !important; margin: 24px 0 12px;",
      p: "margin: 18px 0 !important; line-height: 1.7 !important; color: #333333 !important;",
      strong:
        "font-weight: 700; color: #07c160 !important; background-color: rgba(7,193,96,0.08); padding: 0 4px; border-radius: 4px;",
      em: "font-style: italic; color: #666 !important;",
      a: "color: #07c160 !important; text-decoration: none; border-bottom: 1px solid #07c160; padding-bottom: 1px;",
      ul: "margin: 16px 0; padding-left: 28px;",
      ol: "margin: 16px 0; padding-left: 28px;",
      li: "margin: 8px 0; line-height: 1.7 !important; color: #333333 !important;",
      blockquote:
        "margin: 24px 0; padding: 16px 20px; background-color: #f0f7f2 !important; border-left: 4px solid #07c160; color: #555 !important; border-radius: 4px;",
      code: 'font-family: "SF Mono", Consolas, monospace; padding: 3px 6px; background-color: #f0f7f2 !important; color: #07c160 !important; border-radius: 4px; font-size: 12px !important; line-height: 1.5 !important;',
      pre: "margin: 24px 0; padding: 20px; background-color: #f0f7f2 !important; border-radius: 8px; overflow-x: auto; font-size: 12px !important; line-height: 1.5 !important;",
      hr: "margin: 36px auto; border: none; height: 1px; background-color: #eaeaea !important; width: 100%;",
      img: "max-width: 100%; height: auto; display: block; margin: 24px auto; border-radius: 4px;",
    },
  },
];

export function renderRaphaelWechatPreviewHtml(
  markdown: string,
  options: RaphaelWechatRenderOptions = {},
) {
  const theme = resolveTheme(options.themeId);
  const bodyHtml = renderMarkdownBlocks(markdown, theme);

  return `<section data-raphael-wechat-preview="true" data-raphael-theme="${theme.id}" style="${escapeAttribute(theme.styles.container)}">${bodyHtml}</section>`;
}

function resolveTheme(themeId?: string) {
  return (
    RAPHAEL_WECHAT_THEMES.find((theme) => theme.id === themeId) ??
    RAPHAEL_WECHAT_THEMES[0]
  );
}

function renderMarkdownBlocks(markdown: string, theme: RaphaelWechatTheme) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) continue;

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(`<hr style="${escapeAttribute(theme.styles.hr)}" />`);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      blocks.push(
        `<h${level} style="${escapeAttribute(theme.styles[`h${level}`])}">${renderInlineMarkdown(
          headingMatch[2],
          theme,
        )}</h${level}>`,
      );
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (imageMatch) {
      blocks.push(renderImage(imageMatch[1], imageMatch[2], theme));
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      let quoteIndex = index;
      while (quoteIndex < lines.length && lines[quoteIndex]?.trim().startsWith(">")) {
        quoteLines.push(lines[quoteIndex].trim().replace(/^>\s?/, ""));
        quoteIndex += 1;
      }
      index = quoteIndex - 1;
      blocks.push(
        `<blockquote style="${escapeAttribute(theme.styles.blockquote)}">${renderInlineMarkdown(
          quoteLines.join("<br />"),
          theme,
          { allowHtmlBreaks: true },
        )}</blockquote>`,
      );
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];
      let listIndex = index;
      const itemPattern = ordered ? /^\d+\.\s+/ : /^[-*+]\s+/;

      while (listIndex < lines.length && itemPattern.test(lines[listIndex]?.trim() ?? "")) {
        items.push((lines[listIndex] ?? "").trim().replace(itemPattern, ""));
        listIndex += 1;
      }

      index = listIndex - 1;
      const tag = ordered ? "ol" : "ul";
      blocks.push(
        `<${tag} style="${escapeAttribute(theme.styles[tag])}">${items
          .map((item) => `<li style="${escapeAttribute(theme.styles.li)}">${renderInlineMarkdown(item, theme)}</li>`)
          .join("")}</${tag}>`,
      );
      continue;
    }

    const paragraphLines = [trimmed];
    let paragraphIndex = index + 1;
    while (paragraphIndex < lines.length) {
      const nextTrimmed = lines[paragraphIndex]?.trim() ?? "";
      if (
        !nextTrimmed ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrimmed) ||
        /^(#{1,4})\s+/.test(nextTrimmed) ||
        nextTrimmed.startsWith(">") ||
        /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.test(nextTrimmed) ||
        /^[-*+]\s+/.test(nextTrimmed) ||
        /^\d+\.\s+/.test(nextTrimmed)
      ) {
        break;
      }

      paragraphLines.push(nextTrimmed);
      paragraphIndex += 1;
    }

    index = paragraphIndex - 1;
    blocks.push(
      `<p style="${escapeAttribute(theme.styles.p)}">${renderInlineMarkdown(
        paragraphLines.join(" "),
        theme,
      )}</p>`,
    );
  }

  return blocks.join("");
}

function renderImage(alt: string, src: string, theme: RaphaelWechatTheme) {
  return `<p style="${escapeAttribute(theme.styles.p)}"><img src="${escapeAttribute(src)}" alt="${escapeAttribute(
    alt,
  )}" style="${escapeAttribute(theme.styles.img)}" /></p>`;
}

function renderInlineMarkdown(
  text: string,
  theme: RaphaelWechatTheme,
  options: { allowHtmlBreaks?: boolean } = {},
) {
  const breakToken = "__RAPHAEL_BR__";
  const escaped = escapeHtml(
    options.allowHtmlBreaks ? text.replaceAll("<br />", breakToken) : text,
  );

  return escaped
    .replaceAll(breakToken, "<br />")
    .replace(
      /`([^`]+)`/g,
      `<code style="${escapeAttribute(theme.styles.code)}">$1</code>`,
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, label: string, href: string) =>
        `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer" style="${
          escapeAttribute(theme.styles.a)
        }">${label}</a>`,
    )
    .replace(
      /\*\*([^*]+)\*\*/g,
      `<strong style="${escapeAttribute(theme.styles.strong)}">$1</strong>`,
    )
    .replace(/\*([^*\n]+)\*/g, `<em style="${escapeAttribute(theme.styles.em)}">$1</em>`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
