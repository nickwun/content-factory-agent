import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRaphaelCopyMarkdown,
  renderRaphaelWechatCopyHtml,
} from "../workspace/raphael-wechat-copy.ts";

test("renderRaphaelWechatCopyHtml produces Raphael-compatible inline HTML for common markdown blocks", async () => {
  const html = await renderRaphaelWechatCopyHtml(
    [
      "# 主标题",
      "",
      "普通 **正文**。",
      "",
      "> 引用内容",
      "",
      "- 第一项",
      "- 第二项",
      "",
      "![配图](https://example.com/image.png)",
      "",
      "---",
    ].join("\n"),
  );

  assert.match(html, /^<section style="/);
  assert.doesNotMatch(html, /data-raphael-wechat-preview/);
  assert.doesNotMatch(html, /data-raphael-theme/);
  assert.match(html, /<h1 style="[^"]*font-size: 32px/);
  assert.match(html, /<p style="[^"]*font-size: 16px/);
  assert.match(html, /<p style="[^"]*line-height: 1\.7/);
  assert.match(html, /<p style="[^"]*color: #1d1d1f/);
  assert.match(html, /<strong style="[^"]*color: #000/);
  assert.match(html, /<blockquote style="[^"]*border-left: 4px solid #0066cc/);
  assert.match(html, /<ul style="[^"]*padding-left: 28px/);
  assert.match(
    html,
    /<img src="https:\/\/example\.com\/image\.png" alt="配图" style="[^"]*max-width: 100%/,
  );
  assert.match(html, /<hr style="[^"]*background-color: #eaeaea/);
});

test("renderRaphaelWechatCopyHtml runs markdown-it before theme and WeChat compatibility", async () => {
  const html = await renderRaphaelWechatCopyHtml("普通 **正文**。[链接](https://example.com)");

  assert.match(html, /<strong style="[^"]*font-weight: 700/);
  assert.match(html, /<a href="https:\/\/example\.com"[^>]*style="[^"]*#0066cc/);
  assert.match(html, /<section style="[^"]*font-size: 16px/);
  assert.match(html, /<p style="[^"]*font-family:/);
});

test("renderRaphaelWechatCopyHtml cleans unsafe html before copying", async () => {
  const html = await renderRaphaelWechatCopyHtml(
    '<script>alert("x")</script><p onclick="bad()">正文</p><img src="https://example.com/a.png" onerror="bad()" />',
  );

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /onclick=/i);
  assert.doesNotMatch(html, /onerror=/i);
  assert.match(html, /<img src="https:\/\/example\.com\/a\.png"/);
});

test("normalizeRaphaelCopyMarkdown adds copy-only structure for plain generated articles", () => {
  const markdown = normalizeRaphaelCopyMarkdown(
    [
      "你看，国庆长假一过，天气就真正凉下来了。",
      "",
      "其实，这很正常。",
      "",
      "01、总有人在你纠结时，已经跑完了十公里",
      "",
      "可你知道吗？即便如此。",
    ].join("\n"),
  );

  assert.match(markdown, /^> 你看，国庆长假一过/);
  assert.match(markdown, /\n## 01、总有人在你纠结时，已经跑完了十公里\n/);
});

test("renderRaphaelWechatCopyHtml renders copy-only plain article structure", async () => {
  const html = await renderRaphaelWechatCopyHtml(
    [
      "你看，国庆长假一过，天气就真正凉下来了。",
      "",
      "其实，这很正常。",
      "",
      "01、总有人在你纠结时，已经跑完了十公里",
      "",
      "可你知道吗？即便如此。",
    ].join("\n"),
  );

  assert.match(html, /<blockquote style="[^"]*border-left: 4px solid #0066cc/);
  assert.match(html, /<h2 style="[^"]*font-size: 26px/);
  assert.match(html, />01、总有人在你纠结时，已经跑完了十公里<\/h2>/);
});

test("renderRaphaelWechatCopyHtml keeps empty content as a safe styled section", async () => {
  const html = await renderRaphaelWechatCopyHtml("");

  assert.match(html, /^<section style="/);
  assert.match(html, /><\/section>$/);
  assert.doesNotMatch(html, /data-raphael/);
});
