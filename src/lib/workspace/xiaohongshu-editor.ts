import type { XiaohongshuImageSuggestion } from "../types/history.ts";

export function formatXiaohongshuTagsInput(tags: string[]) {
  return tags.map((tag) => `#${tag}`).join(" ");
}

export function getXiaohongshuImageStatusLabel(
  status: XiaohongshuImageSuggestion["status"],
) {
  if (status === "generated") {
    return "已生成";
  }

  if (status === "generating") {
    return "生成中";
  }

  if (status === "failed") {
    return "生成失败";
  }

  return "建议中";
}

export function getXiaohongshuImageSummary(count: number) {
  return `当前共 ${count} 条图片建议`;
}
