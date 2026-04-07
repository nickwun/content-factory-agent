import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMeaningfulTwitterContent,
  extractTwitterJsonPayload,
  normalizeTwitterOutput,
  type RawTwitterOutput,
} from "../generation/twitter-output.ts";

test("normalizeTwitterOutput downgrades invalid short thread recommendations to single", () => {
  const normalized = normalizeTwitterOutput({
    recommendedMode: "thread",
    singleDraft:
      "这是一条很长很长的单条推文草稿，长到已经不像推文，而更像一段冗长的小作文摘要，需要被本地清洗成合理长度，避免直接显示成不自然的 single 草稿内容。",
    threadDraft: ["只有一条线程"],
  } satisfies RawTwitterOutput);

  assert.equal(normalized.mode, "single");
  assert.equal(normalized.autoDetectedMode, "single");
  assert.equal(normalized.singleDraft.length <= 280, true);
  assert.deepEqual(normalized.threadDraft, [normalized.singleDraft]);
});

test("normalizeTwitterOutput keeps a valid thread and fills single from the first tweet", () => {
  const normalized = normalizeTwitterOutput({
    recommendedMode: "thread",
    singleDraft: "",
    threadDraft: ["第一条观点钩子", "第二条展开说明", "第三条收尾"],
  } satisfies RawTwitterOutput);

  assert.equal(normalized.mode, "thread");
  assert.equal(normalized.autoDetectedMode, "thread");
  assert.equal(normalized.singleDraft, "第一条观点钩子");
  assert.equal(normalized.threadDraft.length, 3);
});

test("normalizeTwitterOutput rejects malformed payloads", () => {
  assert.throws(
    () => normalizeTwitterOutput("not-an-object"),
    /Invalid twitter output/,
  );
});

test("assertMeaningfulTwitterContent rejects fully placeholder output", () => {
  const normalized = normalizeTwitterOutput({
    recommendedMode: "single",
    singleDraft: "",
    threadDraft: [],
  } satisfies RawTwitterOutput);

  assert.throws(
    () => assertMeaningfulTwitterContent(normalized),
    /Generated twitter content did not contain meaningful content/,
  );
});

test("extractTwitterJsonPayload reads plain json text", () => {
  const payload = extractTwitterJsonPayload(
    '{"recommendedMode":"single","singleDraft":"正文","threadDraft":["正文"]}',
  );

  assert.deepEqual(payload, {
    recommendedMode: "single",
    singleDraft: "正文",
    threadDraft: ["正文"],
  });
});
