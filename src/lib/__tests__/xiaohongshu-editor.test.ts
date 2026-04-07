import assert from "node:assert/strict";
import test from "node:test";

import {
  formatXiaohongshuTagsInput,
  getXiaohongshuImageStatusLabel,
  getXiaohongshuImageSummary,
} from "../workspace/xiaohongshu-editor.ts";

test("formatXiaohongshuTagsInput prefixes tags for display while keeping storage hash-free", () => {
  assert.equal(
    formatXiaohongshuTagsInput(["工作效率", "时间管理", "职场成长"]),
    "#工作效率 #时间管理 #职场成长",
  );
  assert.equal(formatXiaohongshuTagsInput([]), "");
});

test("getXiaohongshuImageStatusLabel returns lighter editor-facing labels", () => {
  assert.equal(getXiaohongshuImageStatusLabel("suggested"), "建议中");
  assert.equal(getXiaohongshuImageStatusLabel("generating"), "生成中");
  assert.equal(getXiaohongshuImageStatusLabel("generated"), "已生成");
  assert.equal(getXiaohongshuImageStatusLabel("failed"), "生成失败");
});

test("getXiaohongshuImageSummary describes the editable suggestion list compactly", () => {
  assert.equal(getXiaohongshuImageSummary(5), "当前共 5 条图片建议");
  assert.equal(getXiaohongshuImageSummary(1), "当前共 1 条图片建议");
});
