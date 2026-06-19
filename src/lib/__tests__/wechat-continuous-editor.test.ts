import test from "node:test";
import assert from "node:assert/strict";

import type { WechatBlock } from "../types/history.ts";
import {
  parseContinuousTextToWechatBlocks,
  serializeWechatBlocksToContinuousText,
} from "../workspace/wechat-continuous-editor.ts";

test("serializeWechatBlocksToContinuousText renders supported blocks into one continuous article", () => {
  const blocks: WechatBlock[] = [
    {
      id: "heading-1",
      type: "heading",
      level: 2,
      text: "写作为什么能延缓衰老",
    },
    {
      id: "paragraph-1",
      type: "paragraph",
      text: "写作不是为了立刻输出，而是让大脑持续组织经验。",
    },
    {
      id: "quote-1",
      type: "quote",
      text: "写作是给大脑做长期训练。",
    },
    {
      id: "divider-1",
      type: "divider",
    },
    {
      id: "list-1",
      type: "list",
      items: ["第一条", "第二条"],
    },
  ];

  const text = serializeWechatBlocksToContinuousText(blocks);

  assert.equal(
    text,
    [
      "## 写作为什么能延缓衰老",
      "写作不是为了立刻输出，而是让大脑持续组织经验。",
      "> 写作是给大脑做长期训练。",
      "---",
      "- 第一条\n- 第二条",
    ].join("\n\n"),
  );
});

test("parseContinuousTextToWechatBlocks restores supported markers into blocks", () => {
  const blocks = parseContinuousTextToWechatBlocks(
    [
      "## 写作为什么能延缓衰老",
      "写作不是为了立刻输出，而是让大脑持续组织经验。",
      "> 写作是给大脑做长期训练。",
      "---",
      "最后回到日常练习本身。",
    ].join("\n\n"),
  );

  assert.equal(blocks.length, 5);
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["heading", "paragraph", "quote", "divider", "paragraph"],
  );
  assert.equal(blocks[0].type, "heading");
  if (blocks[0].type === "heading") {
    assert.equal(blocks[0].level, 2);
    assert.equal(blocks[0].text, "写作为什么能延缓衰老");
  }
  assert.equal(blocks[2].type, "quote");
  if (blocks[2].type === "quote") {
    assert.equal(blocks[2].text, "写作是给大脑做长期训练。");
  }
});

test("heading style markers survive continuous text round-trip as heading text", () => {
  const source =
    "## 写作为什么能延缓衰老 {{h:size=lg;color=emerald;bold;underline;center}}";

  const blocks = parseContinuousTextToWechatBlocks(source);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "heading");
  if (blocks[0].type === "heading") {
    assert.equal(
      blocks[0].text,
      "写作为什么能延缓衰老 {{h:size=lg;color=emerald;bold;underline;center}}",
    );
  }

  assert.equal(serializeWechatBlocksToContinuousText(blocks), source);
});

test("parseContinuousTextToWechatBlocks keeps unsupported list-like text as paragraph content", () => {
  const blocks = parseContinuousTextToWechatBlocks("- 第一条\n- 第二条");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  if (blocks[0].type === "paragraph") {
    assert.equal(blocks[0].text, "- 第一条\n- 第二条");
  }
});

test("parseContinuousTextToWechatBlocks falls back to one empty paragraph for empty body", () => {
  const blocks = parseContinuousTextToWechatBlocks("   \n\n   ");

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "paragraph");
  if (blocks[0].type === "paragraph") {
    assert.equal(blocks[0].text, "");
  }
});
