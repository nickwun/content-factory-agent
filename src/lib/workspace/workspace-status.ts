import type { EditorSaveState } from "../types/platform";

export function getWorkspaceStatusLabel(saveState: EditorSaveState) {
  if (saveState === "dirty") {
    return "有修改 · 待保存";
  }

  if (saveState === "saving") {
    return "保存中 · 可编辑";
  }

  if (saveState === "saved") {
    return "已保存 · 可编辑";
  }

  if (saveState === "error") {
    return "保存失败 · 可编辑";
  }

  return "可编辑 · 自动保存";
}
