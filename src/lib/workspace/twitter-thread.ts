import type { TwitterContent } from "../types/history";

export type TwitterThreadOverview = {
  count: number;
  activeIndex: number;
  items: Array<{
    index: number;
    label: string;
    isActive: boolean;
  }>;
};

export function getTwitterModeStatusLabel(content: TwitterContent) {
  return content.userLockedMode
    ? "手动锁定"
    : `推荐：${content.autoDetectedMode === "thread" ? "Thread" : "Single"}`;
}

export function getTwitterThreadOverview(
  content: TwitterContent,
  activeIndex: number,
): TwitterThreadOverview | null {
  if (content.mode !== "thread") {
    return null;
  }

  const count = content.threadDraft.length;
  const safeActiveIndex = clampIndex(activeIndex, count);

  return {
    count,
    activeIndex: safeActiveIndex,
    items: content.threadDraft.map((_tweet, index) => ({
      index,
      label: `${index + 1}`,
      isActive: index === safeActiveIndex,
    })),
  };
}

function clampIndex(index: number, count: number) {
  if (count <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= count) {
    return count - 1;
  }

  return index;
}
