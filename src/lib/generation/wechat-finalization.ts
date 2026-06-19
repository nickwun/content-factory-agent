export type WechatFinalizationOptions = {
  enabled: boolean;
  targetMinWords: number;
  targetMaxWords: number;
  oneSentencePerParagraph: boolean;
  keepSectionStructure: boolean;
};

export const DEFAULT_WECHAT_FINALIZATION_OPTIONS: WechatFinalizationOptions = {
  enabled: false,
  targetMinWords: 1100,
  targetMaxWords: 1200,
  oneSentencePerParagraph: true,
  keepSectionStructure: true,
};

export function buildWechatFinalizationOptions(
  enabled: boolean,
): WechatFinalizationOptions {
  return {
    ...DEFAULT_WECHAT_FINALIZATION_OPTIONS,
    enabled,
  };
}

export function parseWechatFinalizationPayload(
  payload: unknown,
): WechatFinalizationOptions {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("wechatFinalization must be an object");
  }

  const {
    enabled,
    targetMinWords,
    targetMaxWords,
    oneSentencePerParagraph,
    keepSectionStructure,
  } = payload as Record<string, unknown>;

  if (typeof enabled !== "boolean") {
    throw new Error("wechatFinalization.enabled must be a boolean");
  }

  if (!Number.isInteger(targetMinWords) || Number(targetMinWords) <= 0) {
    throw new Error("wechatFinalization.targetMinWords must be a positive integer");
  }

  if (!Number.isInteger(targetMaxWords) || Number(targetMaxWords) <= 0) {
    throw new Error("wechatFinalization.targetMaxWords must be a positive integer");
  }

  if (Number(targetMinWords) > Number(targetMaxWords)) {
    throw new Error("wechatFinalization targetMinWords must be <= targetMaxWords");
  }

  if (typeof oneSentencePerParagraph !== "boolean") {
    throw new Error(
      "wechatFinalization.oneSentencePerParagraph must be a boolean",
    );
  }

  if (typeof keepSectionStructure !== "boolean") {
    throw new Error("wechatFinalization.keepSectionStructure must be a boolean");
  }

  return {
    enabled,
    targetMinWords: Number(targetMinWords),
    targetMaxWords: Number(targetMaxWords),
    oneSentencePerParagraph,
    keepSectionStructure,
  };
}
