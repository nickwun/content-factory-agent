import assert from "node:assert/strict";
import test from "node:test";

import { getWorkspaceStatusLabel } from "../workspace/workspace-status.ts";

test("getWorkspaceStatusLabel returns a compact single-line status label", () => {
  assert.equal(getWorkspaceStatusLabel("idle"), "可编辑 · 自动保存");
  assert.equal(getWorkspaceStatusLabel("dirty"), "有修改 · 待保存");
  assert.equal(getWorkspaceStatusLabel("saving"), "保存中 · 可编辑");
  assert.equal(getWorkspaceStatusLabel("saved"), "已保存 · 可编辑");
  assert.equal(getWorkspaceStatusLabel("error"), "保存失败 · 可编辑");
});
