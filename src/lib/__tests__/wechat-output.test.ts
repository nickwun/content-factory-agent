import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMeaningfulWechatArticle,
  extractWechatArticleJsonPayload,
  normalizeWechatArticleOutput,
  type RawWechatArticleOutput,
} from "../generation/wechat-output.ts";

test("normalizeWechatArticleOutput maps unknown block types back to paragraph", () => {
  const normalized = normalizeWechatArticleOutput({
    title: "效率系统",
    blocks: [
      {
        type: "hero",
        text: "这是一段应该回落为段落的内容",
      },
    ],
  } satisfies RawWechatArticleOutput);

  assert.equal(normalized.title, "效率系统");
  assert.equal(normalized.blocks.length, 1);
  assert.equal(normalized.blocks[0]?.type, "paragraph");
});

test("normalizeWechatArticleOutput falls back when title and blocks are empty", () => {
  const normalized = normalizeWechatArticleOutput({
    title: "",
    blocks: [],
  } satisfies RawWechatArticleOutput);

  assert.equal(normalized.title, "未命名公众号草稿");
  assert.equal(normalized.coverImage?.status, "idle");
  assert.equal(normalized.markdownBody, "这是一篇新生成的公众号草稿，请继续完善具体内容。");
  assert.equal(normalized.blocks.length, 1);
  assert.equal(normalized.blocks[0]?.type, "paragraph");
});

test("normalizeWechatArticleOutput writes markdownBody alongside normalized blocks", () => {
  const normalized = normalizeWechatArticleOutput({
    title: "效率系统",
    blocks: [
      {
        type: "heading",
        level: 2,
        text: "第一部分",
      },
      {
        type: "paragraph",
        text: "正文内容",
      },
      {
        type: "quote",
        text: "引用内容",
      },
      {
        type: "list",
        items: ["第一项", "第二项"],
      },
    ],
  } satisfies RawWechatArticleOutput);

  assert.equal(
    normalized.markdownBody,
    "## 第一部分\n\n正文内容\n\n> 引用内容\n\n- 第一项\n- 第二项",
  );
  assert.equal(normalized.blocks.length, 4);
});

test("normalizeWechatArticleOutput prefers markdownBody as the primary source and derives blocks", () => {
  const normalized = normalizeWechatArticleOutput({
    title: "Markdown 主输出",
    markdownBody: "## 第一节\n\n正文第一段\n\n> 引用一段\n\n- 第一项\n- 第二项\n\n---\n\n收尾一段",
  });

  assert.equal(
    normalized.markdownBody,
    "## 第一节\n\n正文第一段\n\n> 引用一段\n\n- 第一项\n- 第二项\n\n---\n\n收尾一段",
  );
  assert.deepEqual(
    normalized.blocks.map((block) => block.type),
    ["heading", "paragraph", "quote", "list", "divider", "paragraph"],
  );
});

test("normalizeWechatArticleOutput rejects malformed payloads", () => {
  assert.throws(
    () => normalizeWechatArticleOutput("not-an-object"),
    /Invalid wechat article output/,
  );
});

test("assertMeaningfulWechatArticle rejects outputs that only contain fallback placeholder text", () => {
  const normalized = normalizeWechatArticleOutput({
    title: "提升工作效率的实用方法",
    blocks: [
      {
        type: "heading",
      },
      {
        type: "paragraph",
      },
    ],
  } satisfies RawWechatArticleOutput);

  assert.throws(
    () => assertMeaningfulWechatArticle(normalized),
    /Generated wechat article did not contain meaningful content/,
  );
});

test("assertMeaningfulWechatArticle accepts outputs with meaningful text content", () => {
  const normalized = normalizeWechatArticleOutput({
    title: "提升工作效率的实用方法",
    blocks: [
      {
        type: "heading",
        text: "为什么很多人总是越忙越低效",
      },
      {
        type: "paragraph",
        text: "真正的效率不是做更多，而是减少无效切换。",
      },
    ],
  } satisfies RawWechatArticleOutput);

  assert.doesNotThrow(() => assertMeaningfulWechatArticle(normalized));
});

test("extractWechatArticleJsonPayload reads plain json text", () => {
  const payload = extractWechatArticleJsonPayload(
    '{"title":"效率系统","blocks":[{"type":"paragraph","text":"正文"}]}',
  );

  assert.deepEqual(payload, {
    title: "效率系统",
    blocks: [{ type: "paragraph", text: "正文" }],
  });
});

test("extractWechatArticleJsonPayload reads json wrapped in markdown fences", () => {
  const payload = extractWechatArticleJsonPayload(
    '```json\n{"title":"效率系统","blocks":[{"type":"paragraph","text":"正文"}]}\n```',
  );

  assert.deepEqual(payload, {
    title: "效率系统",
    blocks: [{ type: "paragraph", text: "正文" }],
  });
});

test("extractWechatArticleJsonPayload repairs bareword block types in almost-json output", () => {
  const payload = extractWechatArticleJsonPayload(
    '{"title":"效率系统","blocks":[{"type": paragraph,"text":"正文"}]}',
  );

  assert.deepEqual(payload, {
    title: "效率系统",
    blocks: [{ type: "paragraph", text: "正文" }],
  });
});

test("extractWechatArticleJsonPayload repairs trailing commas in almost-json output", () => {
  const payload = extractWechatArticleJsonPayload(
    '{"title":"效率系统","blocks":[{"type":"paragraph","text":"正文",},],}',
  );

  assert.deepEqual(payload, {
    title: "效率系统",
    blocks: [{ type: "paragraph", text: "正文" }],
  });
});

test("extractWechatArticleJsonPayload rejects text without a json object", () => {
  assert.throws(
    () => extractWechatArticleJsonPayload("这里没有合法 JSON"),
    /Invalid wechat article output/,
  );
});
