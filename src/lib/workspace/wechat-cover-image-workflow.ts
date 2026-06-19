import type { WechatArticleContent, WechatCoverImage } from "../types/history.ts";
import { resolveWechatCoverImage } from "./wechat-cover-image.ts";

type WechatCoverImageGenerationResult = {
  imageUrl: string;
  prompt: string;
  model: string;
  generatedAt: string;
};

export function startWechatCoverImageGeneration(
  content: WechatArticleContent,
): WechatArticleContent {
  const current = resolveWechatCoverImage(content.coverImage);

  return {
    ...content,
    coverImage: {
      ...current,
      status: "generating",
      error: undefined,
    },
  };
}

export function finishWechatCoverImageGeneration(
  content: WechatArticleContent,
  result: WechatCoverImageGenerationResult,
): WechatArticleContent {
  const current = resolveWechatCoverImage(content.coverImage);
  const previousImage = current.imageUrl
    ? {
        imageUrl: current.imageUrl,
        ...(current.prompt ? { prompt: current.prompt } : {}),
        ...(current.model ? { model: current.model } : {}),
        ...(current.generatedAt ? { generatedAt: current.generatedAt } : {}),
      }
    : current.previousImage;

  return {
    ...content,
    coverImage: {
      status: "generated",
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      model: result.model,
      generatedAt: result.generatedAt,
      ...(previousImage ? { previousImage } : {}),
    },
  };
}

export function failWechatCoverImageGeneration(
  content: WechatArticleContent,
  failure: {
    error: string;
  },
): WechatArticleContent {
  const current = resolveWechatCoverImage(content.coverImage);

  return {
    ...content,
    coverImage: {
      ...current,
      status: "failed",
      error: failure.error,
    },
  };
}

export function hasGeneratedWechatCoverImage(
  coverImage: WechatCoverImage | null | undefined,
) {
  const resolved = resolveWechatCoverImage(coverImage);

  return resolved.status === "generated" && Boolean(resolved.imageUrl);
}
