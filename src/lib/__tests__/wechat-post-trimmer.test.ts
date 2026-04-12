import assert from "node:assert/strict";
import test from "node:test";

import type { WechatArticleContent } from "../types/history.ts";
import {
  DEFAULT_WECHAT_POST_TRIM_MAX_WORDS,
  trimWechatArticlePostFinalization,
} from "../generation/wechat-post-trimmer.ts";
import { serializeWechatBlocksToContinuousText } from "../workspace/wechat-continuous-editor.ts";
import { countWechatArticleWords } from "../workspace/wechat-word-count.ts";

function buildArticle(blocks: WechatArticleContent["blocks"]): WechatArticleContent {
  return {
    platform: "wechat_article",
    title: "写作让大脑保持清醒",
    blocks,
  };
}

function getBodyCount(article: WechatArticleContent) {
  return countWechatArticleWords(
    "",
    serializeWechatBlocksToContinuousText(article.blocks),
  ).bodyCount;
}

test("wechat post trimmer leaves articles within the limit untouched", () => {
  const article = buildArticle([
    { id: "h-1", type: "heading", level: 2, text: "先把节奏放慢" },
    {
      id: "p-1",
      type: "paragraph",
      text: "写作让人把脑子里的东西慢慢理顺。它像每天做一点认知训练。",
    },
    {
      id: "p-2",
      type: "paragraph",
      text: "只要还能认真把一句话写清楚，人就不容易变得敷衍。",
    },
  ]);

  const result = trimWechatArticlePostFinalization(article);

  assert.equal(result.trimmed, false);
  assert.equal(result.originalBodyWords <= DEFAULT_WECHAT_POST_TRIM_MAX_WORDS, true);
  assert.equal(result.article.title, article.title);
  assert.equal(result.article.markdownBody?.includes("## 先把节奏放慢"), true);
  assert.deepEqual(
    result.article.blocks.map((block) => block.type),
    article.blocks.map((block) => block.type),
  );
});

test("wechat post trimmer trims markdownBody-first articles and keeps markdown as the source of truth", () => {
  const article: WechatArticleContent = {
    platform: "wechat_article",
    title: "写作让大脑保持清醒",
    markdownBody:
      "## 写作像慢跑一样\n\n" +
      Array.from(
        { length: 12 },
        () =>
          "写作会逼着人把已经想过的事情重新整理一遍。也就是说，你会再把同一个意思解释得更完整一点。\n\n",
      ).join(""),
    blocks: [],
  };

  const result = trimWechatArticlePostFinalization(article, { maxBodyWords: 220 });

  assert.equal(result.trimmed, true);
  assert.ok((result.article.markdownBody ?? "").length > 0);
  assert.equal(result.article.markdownBody?.includes("也就是说"), false);
  assert.deepEqual(result.article.blocks.map((block) => block.type)[0], "heading");
});

test("wechat post trimmer trims long articles down and never changes the title", () => {
  const repetitiveSentence =
    "写作会逼着人把已经想过的事情重新整理一遍。也就是说，你会再把同一个意思解释得更完整一点。";
  const article = buildArticle([
    { id: "h-1", type: "heading", level: 2, text: "写作像慢跑一样" },
    {
      id: "p-1",
      type: "paragraph",
      text: Array.from({ length: 18 }, () => repetitiveSentence).join(""),
    },
    {
      id: "p-2",
      type: "paragraph",
      text: Array.from({ length: 18 }, () => repetitiveSentence).join(""),
    },
  ]);

  const result = trimWechatArticlePostFinalization(article, { maxBodyWords: 900 });

  assert.equal(result.trimmed, true);
  assert.equal(result.article.title, article.title);
  assert.ok(result.trimmedBodyWords < result.originalBodyWords);
  assert.ok(result.trimmedBodyWords <= 1400);
});

test("wechat post trimmer preserves heading count and block order", () => {
  const article = buildArticle([
    { id: "h-1", type: "heading", level: 2, text: "第一节" },
    {
      id: "p-1",
      type: "paragraph",
      text: "观点已经说清了。也就是说，这里只是把同一个意思再解释一遍。".repeat(6),
    },
    { id: "h-2", type: "heading", level: 2, text: "第二节" },
    {
      id: "p-2",
      type: "paragraph",
      text: "核心判断已经成立。换句话说，这一句只是重复前面的观点。".repeat(6),
    },
  ]);

  const result = trimWechatArticlePostFinalization(article, { maxBodyWords: 200 });

  assert.deepEqual(
    result.article.blocks.filter((block) => block.type === "heading").map((block) => block.type),
    ["heading", "heading"],
  );
  assert.deepEqual(
    result.article.blocks.map((block) => block.type),
    ["heading", "paragraph", "heading", "paragraph"],
  );
});

test("wechat post trimmer prioritizes dropping explanation-style sentences before core statements", () => {
  const article = buildArticle([
    {
      id: "p-1",
      type: "paragraph",
      text: "写作会逼着人整理信息。也就是说，你会把已经说清的东西再解释一遍。这个过程会让大脑持续运转。".repeat(
        18,
      ),
    },
  ]);

  const result = trimWechatArticlePostFinalization(article, { maxBodyWords: 450 });
  const body = serializeWechatBlocksToContinuousText(result.article.blocks);

  assert.equal(body.includes("也就是说"), false);
  assert.equal(body.includes("写作会逼着人整理信息"), true);
  assert.equal(body.includes("这个过程会让大脑持续运转"), true);
});

test("wechat post trimmer only removes sentences and never adds new headings", () => {
  const article = buildArticle([
    { id: "h-1", type: "heading", level: 2, text: "一" },
    {
      id: "p-1",
      type: "paragraph",
      text: "观点已经成立。更重要的是，这一句没有新增多少信息。".repeat(20),
    },
  ]);

  const beforeBodyCount = getBodyCount(article);
  const result = trimWechatArticlePostFinalization(article, { maxBodyWords: 200 });
  const afterBodyCount = getBodyCount(result.article);

  assert.equal(
    result.article.blocks.filter((block) => block.type === "heading").length,
    1,
  );
  assert.ok(afterBodyCount < beforeBodyCount);
});

test("wechat post trimmer prefers deleting templated transitions before human-sounding sentences", () => {
  const article = buildArticle([
    {
      id: "p-1",
      type: "paragraph",
      text: "说实话，年纪上来以后，我越来越珍惜那种还能把一句话慢慢说清楚的状态。总而言之，这一点毋庸置疑。这个习惯让我没那么容易变得敷衍。".repeat(
        8,
      ),
    },
  ]);

  const result = trimWechatArticlePostFinalization(article, { maxBodyWords: 320 });
  const body = serializeWechatBlocksToContinuousText(result.article.blocks);

  assert.equal(body.includes("总而言之"), false);
  assert.equal(body.includes("毋庸置疑"), false);
  assert.equal(body.includes("说实话"), true);
  assert.equal(body.includes("没那么容易变得敷衍"), true);
});
