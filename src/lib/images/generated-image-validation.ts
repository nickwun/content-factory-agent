import type { ImageMetadata } from "./image-metadata";

export type XiaohongshuImageReviewResult = {
  hasReadableText: boolean;
  hasUiLikeElements: boolean;
  hasSignageOrLogo: boolean;
};

export type XiaohongshuImageFailureReason =
  | "failed_ratio_check"
  | "failed_text_ui_check"
  | "failed_upstream_generation";

const TARGET_RATIO = 4 / 5;
const MIN_RATIO = 0.76;
const MAX_RATIO = 0.84;

export function validateXiaohongshuImageRatio(metadata: ImageMetadata) {
  const ratio = metadata.width / metadata.height;

  return {
    passed:
      metadata.height > metadata.width &&
      ratio >= MIN_RATIO &&
      ratio <= MAX_RATIO,
    ratio,
    targetRatio: TARGET_RATIO,
  };
}

export function buildXiaohongshuImageReviewPrompt() {
  return [
    "请只做一个非常窄的图片复检任务，并只返回 JSON。",
    '返回格式：{"hasReadableText":boolean,"hasUiLikeElements":boolean,"hasSignageOrLogo":boolean}',
    "检查范围只限以下三项：",
    "1. 是否存在明显可读文字或数字",
    "2. 是否存在 UI 感元素，例如界面、截图、面板、按钮、明显表单模块",
    "3. 是否存在 logo、品牌标识、标牌、招牌感元素",
    "不要做审美评价，不要解释，不要输出额外字段。",
  ].join("\n");
}

export function parseXiaohongshuImageReviewResult(
  raw: string,
): XiaohongshuImageReviewResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Unable to parse image review result");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<XiaohongshuImageReviewResult>;

  return {
    hasReadableText: Boolean(parsed.hasReadableText),
    hasUiLikeElements: Boolean(parsed.hasUiLikeElements),
    hasSignageOrLogo: Boolean(parsed.hasSignageOrLogo),
  };
}

export function resolveXiaohongshuImageFailureReason(input: {
  metadata: ImageMetadata;
  review: XiaohongshuImageReviewResult;
}): XiaohongshuImageFailureReason | null {
  const ratioCheck = validateXiaohongshuImageRatio(input.metadata);

  if (!ratioCheck.passed) {
    return "failed_ratio_check";
  }

  if (
    input.review.hasReadableText ||
    input.review.hasUiLikeElements ||
    input.review.hasSignageOrLogo
  ) {
    return "failed_text_ui_check";
  }

  return null;
}
