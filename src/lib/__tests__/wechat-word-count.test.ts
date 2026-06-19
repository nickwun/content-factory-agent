import test from "node:test";
import assert from "node:assert/strict";

import {
  countWechatArticleWords,
  extractVisibleWechatText,
} from "../workspace/wechat-word-count.ts";

test("extractVisibleWechatText removes supported lightweight markers but keeps visible content", () => {
  const text = [
    "## 写作为什么能延缓衰老 {{h:size=lg;color=emerald;bold;underline}}",
    "",
    "> 写作是给大脑做长期训练。",
    "",
    "---",
    "",
    "把 **长期练习** 变成 __日常习惯__。",
  ].join("\n");

  assert.equal(
    extractVisibleWechatText(text),
    [
      "写作为什么能延缓衰老",
      "",
      "写作是给大脑做长期训练。",
      "",
      "",
      "",
      "把 长期练习 变成 日常习惯。",
    ].join("\n"),
  );
});

test("extractVisibleWechatText preserves invalid heading markers as visible text", () => {
  const text = "## 写作为什么能延缓衰老 {{h:size=huge;color=bad}}";

  assert.equal(
    extractVisibleWechatText(text),
    "写作为什么能延缓衰老 {{h:size=huge;color=bad}}",
  );
});

test("countWechatArticleWords counts non-whitespace visible characters only", () => {
  const counts = countWechatArticleWords(
    "写作延缓衰老",
    [
      "## 为什么要写作 {{h:size=lg;color=emerald;bold;underline}}",
      "",
      "> 写作是长期训练。",
      "",
      "---",
      "",
      "把 **经验** 变成 __结构__。",
    ].join("\n"),
  );

  assert.deepEqual(counts, {
    titleCount: 6,
    bodyCount: 22,
    totalCount: 28,
  });
});

test("countWechatArticleWords returns zero body count for empty content", () => {
  assert.deepEqual(countWechatArticleWords("标题", " \n\t "), {
    titleCount: 2,
    bodyCount: 0,
    totalCount: 2,
  });
});
