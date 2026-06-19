import type { GenerationMetadata } from "../types/history";

export type WechatFinalizationStatusSummary = {
  enabled: boolean;
  applied: boolean;
  targetRangeLabel: string | null;
};

export function resolveWechatFinalizationStatus(
  generation?: GenerationMetadata,
): WechatFinalizationStatusSummary | null {
  if (typeof generation?.wechatFinalizationEnabled !== "boolean") {
    return null;
  }

  const min = generation.wechatFinalizationTargetMinWords;
  const max = generation.wechatFinalizationTargetMaxWords;

  return {
    enabled: generation.wechatFinalizationEnabled,
    applied: generation.wechatFinalizationApplied === true,
    targetRangeLabel:
      typeof min === "number" && typeof max === "number"
        ? `${min}-${max} 字`
        : null,
  };
}
