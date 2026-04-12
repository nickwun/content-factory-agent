import test from "node:test";
import assert from "node:assert/strict";

import {
  applyHeadingStyleToLine,
  formatWechatHeadingStyleMarker,
  insertDividerAtCursor,
  parseWechatHeadingContent,
  tokenizeWechatInlineFormatting,
  wrapSelectionWithMarker,
} from "../workspace/wechat-editor-formatting.ts";

test("formatWechatHeadingStyleMarker keeps heading style attributes in a stable order", () => {
  assert.equal(
    formatWechatHeadingStyleMarker({
      color: "emerald",
      underline: true,
      bold: true,
      size: "lg",
      center: true,
    }),
    "{{h:size=lg;color=emerald;bold;underline;center}}",
  );
});

test("parseWechatHeadingContent only parses one valid trailing heading style marker", () => {
  const parsed = parseWechatHeadingContent(
    "写作为什么能延缓衰老 {{h:size=lg;color=emerald;bold;underline;center}}",
  );

  assert.equal(parsed.text, "写作为什么能延缓衰老");
  assert.deepEqual(parsed.style, {
    size: "lg",
    color: "emerald",
    bold: true,
    underline: true,
    center: true,
  });
  assert.equal(parsed.marker, "{{h:size=lg;color=emerald;bold;underline;center}}");
});

test("parseWechatHeadingContent preserves invalid markers as plain heading text", () => {
  const parsed = parseWechatHeadingContent(
    "写作为什么能延缓衰老 {{h:size=huge;color=emerald;bold}}",
  );

  assert.equal(
    parsed.text,
    "写作为什么能延缓衰老 {{h:size=huge;color=emerald;bold}}",
  );
  assert.equal(parsed.style, null);
  assert.equal(parsed.marker, null);
});

test("applyHeadingStyleToLine only changes the current heading line", () => {
  const updated = applyHeadingStyleToLine(
    "## 写作为什么能延缓衰老",
    {
      color: "rose",
      size: "xl",
      underline: true,
      center: true,
    },
  );

  assert.equal(
    updated,
    "## 写作为什么能延缓衰老 {{h:size=xl;color=rose;underline;center}}",
  );
  assert.equal(
    applyHeadingStyleToLine("普通段落", {
      color: "rose",
    }),
    "普通段落",
  );
});

test("wrapSelectionWithMarker only wraps the selected text", () => {
  const result = wrapSelectionWithMarker("写作让大脑更清醒", 2, 4, "**");

  assert.equal(result.text, "写作**让大**脑更清醒");
  assert.deepEqual(result.selection, {
    start: 4,
    end: 6,
  });
});

test("insertDividerAtCursor inserts a divider block at the cursor position", () => {
  const result = insertDividerAtCursor("第一段\n\n第二段", 5);

  assert.equal(result.text, "第一段\n\n---\n\n第二段");
});

test("tokenizeWechatInlineFormatting only supports flat minimal matching", () => {
  assert.deepEqual(tokenizeWechatInlineFormatting("写作**会让**大脑更清醒"), [
    { text: "写作" },
    { text: "会让", bold: true, underline: undefined },
    { text: "大脑更清醒" },
  ]);

  assert.deepEqual(tokenizeWechatInlineFormatting("写作**__不会被解析__**"), [
    { text: "写作" },
    { text: "**__不会被解析__**" },
  ]);
});
