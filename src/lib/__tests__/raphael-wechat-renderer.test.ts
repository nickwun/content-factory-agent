import assert from "node:assert/strict";
import test from "node:test";

import {
  RAPHAEL_WECHAT_DEFAULT_THEME,
  renderRaphaelWechatPreviewHtml,
} from "../workspace/raphael-wechat-renderer.ts";

test("renderRaphaelWechatPreviewHtml renders a Raphael-style preview for common markdown blocks", () => {
  const html = renderRaphaelWechatPreviewHtml(
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

  assert.match(html, /data-raphael-wechat-preview="true"/);
  assert.match(html, /data-raphael-theme="wechat"/);
  assert.match(html, /<h1 style="[^"]*font-size: 32px/);
  assert.match(html, /<p style="[^"]*line-height: 1\.7/);
  assert.match(html, /<strong style="[^"]*#07c160/);
  assert.match(html, /<blockquote style="[^"]*border-left: 4px solid #07c160/);
  assert.match(html, /<ul style="[^"]*padding-left: 28px/);
  assert.match(html, /<li style="[^"]*">第一项<\/li>/);
  assert.match(
    html,
    /<img src="https:\/\/example\.com\/image\.png" alt="配图" style="[^"]*max-width: 100%/,
  );
  assert.match(html, /<hr style="[^"]*background-color: #eaeaea/);
});

test("renderRaphaelWechatPreviewHtml falls back to the default theme for unknown theme ids", () => {
  const html = renderRaphaelWechatPreviewHtml("正文", {
    themeId: "unknown-theme",
  });

  assert.match(html, new RegExp(`data-raphael-theme="${RAPHAEL_WECHAT_DEFAULT_THEME}"`));
  assert.match(html, /正文/);
});
