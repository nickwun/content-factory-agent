import type { ExternalTopicInsight } from "./external-wechat-types.ts";

export type ExternalWechatInsightSectionKey =
  | "titlePatterns"
  | "demandDrivers"
  | "structurePatterns"
  | "stylePatterns"
  | "emotionalDrivers"
  | "rewritePotential"
  | "references";

export function getInsightSectionItems(
  insight: ExternalTopicInsight,
  key: ExternalWechatInsightSectionKey,
) {
  const directItems = normalizeItems(insight[key]);

  if (directItems.length > 0) {
    return directItems;
  }

  if (key === "demandDrivers") {
    return normalizeItems(insight.whyViral);
  }

  if (key === "stylePatterns") {
    return normalizeItems(insight.characteristics);
  }

  return [];
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}
