import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CONTENT_AGENT_HOME_PATH =
  "/Users/hui/Documents/distributing-web/src/components/home/content-agent-home.tsx";
const PROMPT_PRESET_SELECTOR_PATH =
  "/Users/hui/Documents/distributing-web/src/components/home/prompt-preset-selector.tsx";
const CONTENT_TRACE_PANEL_PATH =
  "/Users/hui/Documents/distributing-web/src/components/workspace/content-trace-panel.tsx";

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
  assert.ok(source.includes("本页只支持基于素材生成文章"));
  assert.ok(source.includes("上传或粘贴素材，再选择处理方式和提示词预设"));
});

test("content agent home exposes explicit processing mode choices", () => {
  const source = readFileSync(CONTENT_AGENT_HOME_PATH, "utf8");

  assert.ok(source.includes("ContentProcessingMode"));
  assert.ok(source.includes("processingMode"));
  assert.ok(source.includes("选择处理方式"));
  assert.ok(source.includes("仿写"));
  assert.ok(source.includes("翻译成中文文章"));
  assert.ok(source.includes("翻译模式首版只支持单篇"));
  assert.ok(source.includes("开始翻译整理"));
});

test("prompt preset selector filters presets by processing mode", () => {
  const source = readFileSync(PROMPT_PRESET_SELECTOR_PATH, "utf8");

  assert.ok(source.includes("processingMode"));
  assert.ok(source.includes("preset.processingMode === processingMode"));
  assert.ok(source.includes("当前处理方式下还没有可用的提示词预设"));
});

test("workspace surfaces processing mode metadata with light labels", () => {
  const homeSource = readFileSync(CONTENT_AGENT_HOME_PATH, "utf8");
  const traceSource = readFileSync(CONTENT_TRACE_PANEL_PATH, "utf8");

  assert.ok(homeSource.includes("处理方式"));
  assert.ok(homeSource.includes("翻译整理"));
  assert.ok(homeSource.includes("activeRecord.generation.processingMode"));
  assert.ok(traceSource.includes("处理方式"));
  assert.ok(traceSource.includes("summary.source.processingMode"));
});
