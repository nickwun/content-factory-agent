import {
  resolveRaphaelTheme,
  type RaphaelTheme,
} from "./raphael-themes.ts";

export function applyRaphaelTheme(rawHtml: string, themeId?: string) {
  const theme = resolveRaphaelTheme(themeId);
  let html = rawHtml;

  for (const [selector, style] of Object.entries(theme.styles)) {
    if (selector === "container") continue;
    html = appendStyleBySelector(html, selector, style);
  }

  return `<div style="${escapeAttribute(theme.styles.container)}">${html}</div>`;
}

export async function makeWeChatCompatibleHtml(
  themedHtml: string,
  themeId?: string,
) {
  const theme = resolveRaphaelTheme(themeId);
  const containerStyle = theme.styles.container;
  const innerHtml = unwrapSingleRootDiv(sanitizeHtml(themedHtml));

  let html = `<section style="${escapeAttribute(containerStyle)}">${innerHtml}</section>`;
  html = forceTextInheritance(html, theme);
  html = keepCjkPunctuationWithInlineNodes(html);

  return html;
}

function appendStyleBySelector(html: string, selector: string, style: string) {
  if (selector === "pre code") return html;

  if (/^[a-z][a-z0-9]*$/i.test(selector)) {
    return appendStyleToTag(html, selector, style);
  }

  return html;
}

function appendStyleToTag(html: string, tag: string, style: string) {
  const pattern = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");

  return html.replace(pattern, (match, attributes = "") => {
    if (tag === "code" && /<pre[\s\S]*$/i.test(html.slice(0, html.indexOf(match)))) {
      return match;
    }

    const styleMatch = String(attributes).match(/\sstyle=(["'])(.*?)\1/i);
    const mergedStyle = styleMatch
      ? mergeInlineStyle(styleMatch[2], style)
      : sanitizeStyle(style);

    if (styleMatch) {
      return `<${tag}${String(attributes).replace(
        /\sstyle=(["'])(.*?)\1/i,
        ` style="${escapeAttribute(mergedStyle)}"`,
      )}>`;
    }

    return `<${tag}${attributes ?? ""} style="${escapeAttribute(mergedStyle)}">`;
  });
}

function forceTextInheritance(html: string, theme: RaphaelTheme) {
  const containerStyle = theme.styles.container;
  const inheritedStyle = [
    extractStyleValue(containerStyle, "font-family")
      ? `font-family: ${extractStyleValue(containerStyle, "font-family")};`
      : "",
    extractStyleValue(containerStyle, "line-height")
      ? `line-height: ${extractStyleValue(containerStyle, "line-height")};`
      : "",
    extractStyleValue(containerStyle, "color")
      ? `color: ${extractStyleValue(containerStyle, "color")};`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const textStyle = [
    inheritedStyle,
    extractStyleValue(containerStyle, "font-size")
      ? `font-size: ${extractStyleValue(containerStyle, "font-size")};`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  let nextHtml = html;

  for (const tag of ["p", "li", "blockquote", "span"]) {
    nextHtml = appendStyleToTag(nextHtml, tag, textStyle);
  }

  for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    nextHtml = appendStyleToTag(nextHtml, tag, inheritedStyle);
  }

  return nextHtml;
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\sdata-md-(?:type|index)\s*=\s*"[^"]*"/gi, "")
    .replace(/\sdata-md-(?:type|index)\s*=\s*'[^']*'/gi, "")
    .replace(/\s(?:href|src)\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/\s(?:href|src)\s*=\s*'javascript:[^']*'/gi, "");
}

function unwrapSingleRootDiv(html: string) {
  const trimmed = html.trim();
  const match = trimmed.match(/^<div\b[^>]*>([\s\S]*)<\/div>$/i);
  return match ? match[1] : trimmed;
}

function keepCjkPunctuationWithInlineNodes(html: string) {
  return html.replace(
    /(<\/(?:strong|b|em|span|a|code)>)\s*([：；，。！？、])/g,
    "$1\u2060$2",
  );
}

function extractStyleValue(style: string, property: string) {
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;!]+)`, "i"));
  return match ? match[1].trim() : null;
}

function mergeInlineStyle(currentStyle: string, nextStyle: string) {
  const normalizedCurrent = sanitizeStyle(currentStyle).replace(/;?$/, ";");
  return `${normalizedCurrent} ${sanitizeStyle(nextStyle)}`.trim();
}

function sanitizeStyle(style: string) {
  return style
    .replace(/\s*!important/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
