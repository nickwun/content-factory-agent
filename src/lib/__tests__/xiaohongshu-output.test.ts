import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMeaningfulXiaohongshuContent,
  extractXiaohongshuJsonPayload,
  normalizeXiaohongshuOutput,
  type RawXiaohongshuOutput,
} from "../generation/xiaohongshu-output.ts";

test("normalizeXiaohongshuOutput fills title caption image suggestions and tag fallbacks", () => {
  const normalized = normalizeXiaohongshuOutput({
    title: "",
    caption:
      "这是一段非常长非常长的小红书正文草稿，长到明显已经不像一篇适合小红书直接编辑的正文，而更像公众号摘要，因此应该在本地清洗后变得更紧凑一些，避免直接把冗长内容塞进当前编辑区，让用户一进来就看到过于沉重的大段文字。",
    imageSuggestions: [
      {
        title: "清晨整理桌面",
        description: "展示开始工作前的桌面准备。",
      },
    ],
    tags: ["#工作效率", " 工作效率 ", "#时间管理", ""],
  } satisfies RawXiaohongshuOutput);

  assert.equal(normalized.platform, "xiaohongshu");
  assert.equal(normalized.title, "未命名小红书草稿");
  assert.equal(normalized.caption.length <= 220, true);
  assert.equal(normalized.imageSuggestions.length >= 3, true);
  assert.equal(normalized.imageSuggestions[0]?.status, "suggested");
  assert.deepEqual(normalized.tags, ["工作效率", "时间管理"]);
});

test("normalizeXiaohongshuOutput caps image suggestions at nine and strips hash from tags", () => {
  const normalized = normalizeXiaohongshuOutput({
    title: "效率女孩的办公桌",
    caption: "适合小红书的精简正文。",
    imageSuggestions: Array.from({ length: 12 }, (_, index) => ({
      title: `画面 ${index + 1}`,
      description: `描述 ${index + 1}`,
    })),
    tags: ["#效率", " #办公", "成长"],
  } satisfies RawXiaohongshuOutput);

  assert.equal(normalized.imageSuggestions.length, 9);
  assert.deepEqual(normalized.tags, ["效率", "办公", "成长"]);
  assert.deepEqual(
    normalized.imageSuggestions.map((item) => item.index),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("normalizeXiaohongshuOutput rejects malformed payloads", () => {
  assert.throws(
    () => normalizeXiaohongshuOutput("not-an-object"),
    /Invalid xiaohongshu output/,
  );
});

test("assertMeaningfulXiaohongshuContent rejects fully placeholder output", () => {
  const normalized = normalizeXiaohongshuOutput({
    title: "",
    caption: "",
    imageSuggestions: [],
    tags: [],
  } satisfies RawXiaohongshuOutput);

  assert.throws(
    () => assertMeaningfulXiaohongshuContent(normalized),
    /Generated xiaohongshu content did not contain meaningful content/,
  );
});

test("extractXiaohongshuJsonPayload reads plain json text", () => {
  const payload = extractXiaohongshuJsonPayload(
    '{"title":"效率翻倍","caption":"正文","imageSuggestions":[{"title":"配图 1","description":"说明"}],"tags":["效率"]}',
  );

  assert.deepEqual(payload, {
    title: "效率翻倍",
    caption: "正文",
    imageSuggestions: [{ title: "配图 1", description: "说明" }],
    tags: ["效率"],
  });
});

test("extractXiaohongshuJsonPayload reads json wrapped in markdown fences", () => {
  const payload = extractXiaohongshuJsonPayload(
    '```json\n{"title":"效率翻倍","caption":"正文","imageSuggestions":[{"title":"配图 1","description":"说明"}],"tags":["效率"]}\n```',
  );

  assert.deepEqual(payload, {
    title: "效率翻倍",
    caption: "正文",
    imageSuggestions: [{ title: "配图 1", description: "说明" }],
    tags: ["效率"],
  });
});
