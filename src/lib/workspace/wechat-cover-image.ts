import type { WechatCoverImage } from "../types/history.ts";

export const DEFAULT_WECHAT_COVER_IMAGE: WechatCoverImage = {
  status: "idle",
};

function resolveWechatPreviousCoverImage(
  previousImage:
    | WechatCoverImage["previousImage"]
    | null
    | undefined,
) {
  if (!previousImage?.imageUrl) {
    return undefined;
  }

  return {
    imageUrl: previousImage.imageUrl,
    ...(previousImage.prompt ? { prompt: previousImage.prompt } : {}),
    ...(previousImage.model ? { model: previousImage.model } : {}),
    ...(previousImage.generatedAt ? { generatedAt: previousImage.generatedAt } : {}),
  };
}

export function resolveWechatCoverImage(
  coverImage: WechatCoverImage | null | undefined,
): WechatCoverImage {
  if (!coverImage) {
    return DEFAULT_WECHAT_COVER_IMAGE;
  }

  switch (coverImage.status) {
    case "idle":
      return DEFAULT_WECHAT_COVER_IMAGE;
    case "generating":
      return {
        status: "generating",
        ...(coverImage.imageUrl ? { imageUrl: coverImage.imageUrl } : {}),
        ...(coverImage.prompt ? { prompt: coverImage.prompt } : {}),
        ...(coverImage.model ? { model: coverImage.model } : {}),
        ...(coverImage.generatedAt ? { generatedAt: coverImage.generatedAt } : {}),
        ...(resolveWechatPreviousCoverImage(coverImage.previousImage)
          ? {
              previousImage: resolveWechatPreviousCoverImage(coverImage.previousImage),
            }
          : {}),
        ...(coverImage.error ? { error: coverImage.error } : {}),
      };
    case "generated":
      return {
        status: "generated",
        ...(coverImage.imageUrl ? { imageUrl: coverImage.imageUrl } : {}),
        ...(coverImage.prompt ? { prompt: coverImage.prompt } : {}),
        ...(coverImage.model ? { model: coverImage.model } : {}),
        ...(coverImage.generatedAt ? { generatedAt: coverImage.generatedAt } : {}),
        ...(resolveWechatPreviousCoverImage(coverImage.previousImage)
          ? {
              previousImage: resolveWechatPreviousCoverImage(coverImage.previousImage),
            }
          : {}),
      };
    case "failed":
      return {
        status: "failed",
        ...(coverImage.imageUrl ? { imageUrl: coverImage.imageUrl } : {}),
        ...(coverImage.error ? { error: coverImage.error } : {}),
        ...(coverImage.prompt ? { prompt: coverImage.prompt } : {}),
        ...(coverImage.model ? { model: coverImage.model } : {}),
        ...(coverImage.generatedAt ? { generatedAt: coverImage.generatedAt } : {}),
        ...(resolveWechatPreviousCoverImage(coverImage.previousImage)
          ? {
              previousImage: resolveWechatPreviousCoverImage(coverImage.previousImage),
            }
          : {}),
      };
    default:
      return DEFAULT_WECHAT_COVER_IMAGE;
  }
}

export function getWechatCoverImageStatusLabel(status: WechatCoverImage["status"]) {
  switch (status) {
    case "generating":
      return "正在生成";
    case "generated":
      return "已生成";
    case "failed":
      return "生成失败";
    case "idle":
    default:
      return "尚未生成";
  }
}

export function hasWechatCoverImageComparison(
  coverImage: WechatCoverImage | null | undefined,
) {
  const resolved = resolveWechatCoverImage(coverImage);

  return (
    resolved.status === "generated" &&
    Boolean(resolved.imageUrl) &&
    Boolean(resolved.previousImage?.imageUrl)
  );
}
