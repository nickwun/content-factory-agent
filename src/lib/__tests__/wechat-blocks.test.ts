import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWechatStructureItems,
  getWechatBlockLabel,
  removeWechatBlock,
} from "../workspace/wechat-blocks.ts";
import type { WechatArticleContent } from "../types/history.ts";

function createArticle(): WechatArticleContent {
  return {
    platform: "wechat_article",
    title: "测试标题",
    blocks: [
      {
        id: "heading-1",
        type: "heading",
        level: 2,
        text: "小标题",
      },
      {
        id: "paragraph-1",
        type: "paragraph",
        text: "段落内容",
      },
      {
        id: "divider-1",
        type: "divider",
      },
      {
        id: "quote-1",
        type: "quote",
        text: "引用内容",
      },
      {
        id: "list-1",
        type: "list",
        items: ["第一条", "第二条"],
      },
    ],
  };
}

test("getWechatBlockLabel returns stable labels for each block type", () => {
  const article = createArticle();

  assert.equal(getWechatBlockLabel(article.blocks[0]), "小标题");
  assert.equal(getWechatBlockLabel(article.blocks[1]), "段落");
  assert.equal(getWechatBlockLabel(article.blocks[2]), "分隔线");
  assert.equal(getWechatBlockLabel(article.blocks[3]), "引用");
  assert.equal(getWechatBlockLabel(article.blocks[4]), "列表");
});

test("removeWechatBlock removes the matching block and keeps the others intact", () => {
  const article = createArticle();

  const next = removeWechatBlock(article, "divider-1");

  assert.deepEqual(
    next.blocks.map((block) => block.id),
    ["heading-1", "paragraph-1", "quote-1", "list-1"],
  );
  assert.equal(next.title, article.title);
});

test("removeWechatBlock returns the original article when the block does not exist", () => {
  const article = createArticle();

  const next = removeWechatBlock(article, "missing-id");

  assert.deepEqual(next, article);
});

test("buildWechatStructureItems includes only key structure blocks and skips paragraphs", () => {
  const article = createArticle();

  const items = buildWechatStructureItems(article);

  assert.deepEqual(items, [
    {
      id: "article-title",
      blockId: null,
      type: "title",
      label: "标题",
      preview: "测试标题",
    },
    {
      id: "heading-1",
      blockId: "heading-1",
      type: "heading",
      label: "小标题",
      preview: "小标题",
    },
    {
      id: "divider-1",
      blockId: "divider-1",
      type: "divider",
      label: "分隔线",
      preview: "结构分隔",
    },
    {
      id: "quote-1",
      blockId: "quote-1",
      type: "quote",
      label: "引用",
      preview: "引用内容",
    },
    {
      id: "list-1",
      blockId: "list-1",
      type: "list",
      label: "列表",
      preview: "第一条",
    },
  ]);
});
