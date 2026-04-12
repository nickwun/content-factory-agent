import assert from "node:assert/strict";
import test from "node:test";

import {
  renderWechatMarkdownExportHtml,
  renderWechatMarkdownPreviewHtml,
} from "../workspace/wechat-markdown-export.ts";

test("renderWechatMarkdownPreviewHtml renders wechat-like html for markdown", () => {
  const html = renderWechatMarkdownPreviewHtml(
    [
      "# 主标题",
      "",
      "## 小标题",
      "",
      "普通 **正文**。",
      "",
      "> 引用内容",
      "",
      "- 第一项",
      "- 第二项",
      "",
      "---",
    ].join("\n"),
  );

  assert.match(html, /<h1/);
  assert.match(html, /<h2/);
  assert.match(html, /<strong>正文<\/strong>/);
  assert.match(html, /<blockquote/);
  assert.match(html, /<ul/);
  assert.match(html, /<hr/);
});

test("renderWechatMarkdownExportHtml produces html that keeps paragraph order and link markup", () => {
  const html = renderWechatMarkdownExportHtml(
    [
      "第一段。",
      "",
      "第二段带[链接](https://example.com)。",
    ].join("\n"),
  );

  assert.match(html, /<p[^>]*>第一段。<\/p>/);
  assert.match(
    html,
    /<a href="https:\/\/example\.com"[^>]*>链接<\/a>/,
  );
  assert.ok(html.indexOf("第一段。") < html.indexOf("第二段带"));
});
