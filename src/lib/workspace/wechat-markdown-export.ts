import {
  parseWechatMarkdownDocument,
  type WechatMarkdownNode,
} from "./wechat-markdown.ts";

export function renderWechatMarkdownPreviewHtml(markdown: string) {
  const nodes = parseWechatMarkdownDocument(markdown);
  return nodes.map((node) => renderNode(node, "preview")).join("");
}

export function renderWechatMarkdownExportHtml(markdown: string) {
  const nodes = parseWechatMarkdownDocument(markdown);
  return nodes.map((node) => renderNode(node, "export")).join("");
}

function renderNode(
  node: WechatMarkdownNode,
  mode: "preview" | "export",
): string {
  switch (node.type) {
    case "heading":
      return renderHeading(node.level, renderInlineMarkdown(node.text), mode);
    case "paragraph":
      return renderParagraph(renderInlineMarkdown(node.text), mode);
    case "quote":
      return renderQuote(renderInlineMarkdown(node.text), mode);
    case "list":
      return renderList(node.items, node.ordered, mode);
    case "divider":
      return mode === "export"
        ? '<hr style="border:none;border-top:1px solid #d6d3d1;margin:24px 0;" />'
        : "<hr />";
    default:
      return "";
  }
}

function renderHeading(level: 1 | 2 | 3, content: string, mode: "preview" | "export") {
  if (mode === "export") {
    const style =
      level === 1
        ? "font-size:30px;line-height:1.35;font-weight:700;color:#0f172a;margin:0 0 18px;"
        : level === 2
          ? "font-size:24px;line-height:1.45;font-weight:700;color:#0f172a;margin:28px 0 14px;"
          : "font-size:20px;line-height:1.5;font-weight:700;color:#1f2937;margin:24px 0 12px;";

    return `<h${level} style="${style}">${content}</h${level}>`;
  }

  return `<h${level}>${content}</h${level}>`;
}

function renderParagraph(content: string, mode: "preview" | "export") {
  if (mode === "export") {
    return `<p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.9;">${content}</p>`;
  }

  return `<p>${content}</p>`;
}

function renderQuote(content: string, mode: "preview" | "export") {
  if (mode === "export") {
    return `<blockquote style="margin:20px 0;padding:0 0 0 16px;border-left:4px solid #f59e0b;color:#475569;font-style:italic;">${content}</blockquote>`;
  }

  return `<blockquote>${content}</blockquote>`;
}

function renderList(items: string[], ordered: boolean, mode: "preview" | "export") {
  const tag = ordered ? "ol" : "ul";
  const listItems = items
    .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
    .join("");

  if (mode === "export") {
    const style = ordered
      ? "margin:0 0 18px 0;padding-left:24px;color:#334155;font-size:16px;line-height:1.9;"
      : "margin:0 0 18px 0;padding-left:24px;color:#334155;font-size:16px;line-height:1.9;";
    return `<${tag} style="${style}">${listItems}</${tag}>`;
  }

  return `<${tag}>${listItems}</${tag}>`;
}

function renderInlineMarkdown(text: string) {
  const escaped = escapeHtml(text);

  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, label: string, href: string) =>
        `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
