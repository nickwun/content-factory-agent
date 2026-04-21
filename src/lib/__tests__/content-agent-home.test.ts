import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CONTENT_AGENT_HOME_PATH =
  "/Users/hui/Documents/distributing-web/src/components/home/content-agent-home.tsx";

test("content agent home no longer renders a freeform rewrite requirement section", () => {
  const source = readFileSync(CONTENT_AGENT_HOME_PATH, "utf8");

  assert.equal(source.includes("仿写要求 / 创作需求"), false);
  assert.equal(source.includes("先输入这一批素材共用的仿写要求"), false);
  assert.equal(source.includes("没有原文时"), false);
  assert.equal(source.includes("普通生成"), false);
});

test("content agent home uses rewrite-only copy for action labels and empty states", () => {
  const source = readFileSync(CONTENT_AGENT_HOME_PATH, "utf8");

  assert.equal(source.includes("开始创作"), false);
  assert.equal(source.includes("开始生成"), false);
  assert.ok(source.includes("开始仿写"));
  assert.ok(source.includes("本页只支持基于素材仿写"));
  assert.ok(source.includes("先上传原文或素材，再选择提示词预设"));
});
