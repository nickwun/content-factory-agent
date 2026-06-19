import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkRewriteSourceText,
  countParagraphGroups,
} from "../rewrite/rewrite-chunking.ts";

test("countParagraphGroups treats continuous paragraphs as one group and headings as boundaries", () => {
  const text = [
    "开头第一段。",
    "",
    "开头第二段。",
    "",
    "一、为什么写作有益",
    "",
    "主体第一段。",
    "",
    "主体第二段。",
    "",
    "结尾总结段。",
  ].join("\n");

  assert.equal(countParagraphGroups(text), 2);
});

test("countParagraphGroups breaks on explicit blank separators between paragraph groups", () => {
  const text = [
    "第一组第一段。",
    "",
    "第一组第二段。",
    "",
    "---",
    "",
    "第二组第一段。",
    "",
    "第二组第二段。",
  ].join("\n");

  assert.equal(countParagraphGroups(text), 2);
});

test("chunkRewriteSourceText keeps headings attached and assigns role hints heuristically", () => {
  const text = [
    "最近很多人都在讨论写作为什么会让人更有活力。",
    "",
    "如果每天都有稳定输出，大脑会保持在持续组织和调用信息的状态里。",
    "",
    "一、写作为什么能延缓心智迟滞",
    "",
    "写作会迫使人不断回忆、筛选、重组信息。",
    "",
    "这会让语言、记忆和判断保持联动。",
    "",
    "接下来我们再看第二个原因。",
    "",
    "二、写作如何改变日常节奏",
    "",
    "当你开始记录和表达，生活会变得更有结构。",
    "",
    "最后，不需要一次写很多，关键是稳定开始。",
  ].join("\n");

  const chunks = chunkRewriteSourceText(text, {
    targetChars: 80,
    softMaxChars: 120,
    hardMaxChars: 160,
  });

  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0]?.sourceRoleHint, "intro");
  assert.ok(chunks.some((chunk) => chunk.sourceRoleHint === "transition"));
  assert.equal(chunks.at(-1)?.sourceRoleHint, "conclusion");
  assert.ok(chunks.some((chunk) => chunk.heading?.includes("写作为什么能延缓心智迟滞")));
});

test("chunkRewriteSourceText respects hard length limits by splitting oversized paragraph groups", () => {
  const longParagraph = "写作会调动记忆与表达。".repeat(120);
  const chunks = chunkRewriteSourceText(longParagraph, {
    targetChars: 120,
    softMaxChars: 160,
    hardMaxChars: 220,
  });

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.charCount <= 220));
  assert.ok(chunks.every((chunk) => chunk.paragraphGroups === 1));
});
