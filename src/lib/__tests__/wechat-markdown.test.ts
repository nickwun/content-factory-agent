import assert from "node:assert/strict";
import test from "node:test";

import type { WechatArticleContent } from "../types/history.ts";
import {
  countWechatMarkdownWords,
  extractVisibleWechatMarkdownText,
  parseWechatMarkdownToBlocks,
  resolveWechatMarkdownBody,
  serializeWechatBlocksToMarkdown,
} from "../workspace/wechat-markdown.ts";

function buildArticle(
  overrides: Partial<WechatArticleContent> = {},
): WechatArticleContent {
  return {
    platform: "wechat_article",
    title: "标题",
    blocks: [
      {
        id: "heading-1",
        type: "heading",
        level: 2,
        text: "第一部分",
      },
      {
        id: "paragraph-1",
        type: "paragraph",
        text: "这是一段正文。",
      },
      {
        id: "quote-1",
        type: "quote",
        text: "这是一段引用。",
      },
      {
        id: "list-1",
        type: "list",
        items: ["第一项", "第二项"],
      },
      {
        id: "divider-1",
        type: "divider",
      },
    ],
    ...overrides,
  };
}

test("serializeWechatBlocksToMarkdown converts existing blocks into markdown body", () => {
  const markdown = serializeWechatBlocksToMarkdown(buildArticle().blocks);

  assert.match(markdown, /^## 第一部分/m);
  assert.match(markdown, /这是一段正文。/);
  assert.match(markdown, /^> 这是一段引用。/m);
  assert.match(markdown, /^- 第一项$/m);
  assert.match(markdown, /^---$/m);
});

test("resolveWechatMarkdownBody prefers markdownBody and falls back to serialized blocks", () => {
  assert.equal(
    resolveWechatMarkdownBody(buildArticle({ markdownBody: "# 新正文\n\n内容" })),
    "# 新正文\n\n内容",
  );

  assert.match(resolveWechatMarkdownBody(buildArticle()), /^## 第一部分/m);
});

test("parseWechatMarkdownToBlocks supports headings paragraphs quotes lists and divider", () => {
  const blocks = parseWechatMarkdownToBlocks(
    [
      "# 主标题",
      "",
      "## 小标题",
      "",
      "普通段落第一句。",
      "",
      "> 引用内容",
      "",
      "- 无序项",
      "- 第二项",
      "",
      "1. 有序项",
      "2. 第二项",
      "",
      "---",
    ].join("\n"),
  );

  assert.equal(blocks[0]?.type, "heading");
  assert.equal(blocks[1]?.type, "heading");
  assert.equal(blocks[2]?.type, "paragraph");
  assert.equal(blocks[3]?.type, "quote");
  assert.equal(blocks[4]?.type, "list");
  assert.equal(blocks[5]?.type, "list");
  assert.equal(blocks[6]?.type, "divider");
});

test("extractVisibleWechatMarkdownText removes markdown markers but keeps visible content", () => {
  const visible = extractVisibleWechatMarkdownText(
    [
      "# 主标题",
      "",
      "普通 **粗体** 文本和 *斜体* 文本。",
      "",
      "> 引用内容",
      "",
      "[链接文字](https://example.com)",
      "",
      "---",
    ].join("\n"),
  );

  assert.doesNotMatch(visible, /[#>*\[\]\(\)-]/);
  assert.match(visible, /主标题/);
  assert.match(visible, /粗体/);
  assert.match(visible, /斜体/);
  assert.match(visible, /引用内容/);
  assert.match(visible, /链接文字/);
});

test("countWechatMarkdownWords counts visible title and markdown body text", () => {
  const count = countWechatMarkdownWords(
    "标题",
    "## 小标题\n\n普通 **正文**。\n\n> 引用",
  );

  assert.equal(count.titleCount, 2);
  assert.equal(count.bodyCount, "小标题普通正文。引用".length);
  assert.equal(count.totalCount, count.titleCount + count.bodyCount);
});
