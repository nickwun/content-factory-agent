import { PublishServiceError } from "./publish-errors.ts";
import type { XiaohongshuPublishRequest, XiaohongshuPublishSnapshot } from "./types.ts";

export function parseXiaohongshuPublishRequestPayload(
  payload: unknown,
): XiaohongshuPublishRequest {
  if (!payload || typeof payload !== "object") {
    throw new PublishServiceError(
      "validation_error",
      "缺少小红书发布请求体。",
      400,
    );
  }

  const candidate = payload as {
    snapshot?: {
      schemaVersion?: unknown;
      platform?: unknown;
      recordId?: unknown;
      title?: unknown;
      caption?: unknown;
      tags?: unknown;
      images?: unknown;
    };
  };

  const snapshot = candidate.snapshot;

  if (!snapshot || typeof snapshot !== "object") {
    throw new PublishServiceError(
      "validation_error",
      "缺少小红书发布快照。",
      400,
    );
  }

  const title =
    typeof snapshot.title === "string" ? snapshot.title.trim() : "";
  const caption =
    typeof snapshot.caption === "string" ? snapshot.caption.trim() : "";

  if (!title && !caption) {
    throw new PublishServiceError(
      "validation_error",
      "小红书发布需要至少提供标题或正文。",
      400,
    );
  }

  if (
    typeof snapshot.schemaVersion !== "string" ||
    !snapshot.schemaVersion.trim() ||
    snapshot.platform !== "xiaohongshu" ||
    typeof snapshot.recordId !== "string" ||
    !snapshot.recordId.trim()
  ) {
    throw new PublishServiceError(
      "validation_error",
      "小红书发布快照结构无效。",
      400,
    );
  }

  if (!Array.isArray(snapshot.tags)) {
    throw new PublishServiceError(
      "validation_error",
      "小红书发布标签结构无效。",
      400,
    );
  }

  if (!Array.isArray(snapshot.images) || snapshot.images.length === 0) {
    throw new PublishServiceError(
      "missing_images",
      "小红书发布至少需要 1 张可用图片。",
      400,
    );
  }

  const images = snapshot.images
    .map((image) => {
      if (!image || typeof image !== "object") {
        return null;
      }

      const candidateImage = image as {
        url?: unknown;
        index?: unknown;
        isCover?: unknown;
        source?: unknown;
      };

      if (
        typeof candidateImage.url !== "string" ||
        !candidateImage.url.trim() ||
        typeof candidateImage.index !== "number" ||
        !Number.isFinite(candidateImage.index) ||
        typeof candidateImage.isCover !== "boolean"
      ) {
        return null;
      }

      return {
        url: candidateImage.url.trim(),
        index: candidateImage.index,
        isCover: candidateImage.isCover,
        source:
          candidateImage.source === "external_url" ? "external_url" : "generated_image",
      } satisfies XiaohongshuPublishSnapshot["images"][number];
    })
    .filter(Boolean) as XiaohongshuPublishSnapshot["images"];

  if (images.length === 0) {
    throw new PublishServiceError(
      "missing_images",
      "小红书发布至少需要 1 张可用图片。",
      400,
    );
  }

  return {
    snapshot: {
      schemaVersion: snapshot.schemaVersion.trim(),
      platform: "xiaohongshu",
      recordId: snapshot.recordId.trim(),
      title,
      caption,
      tags: snapshot.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean),
      images,
    },
  };
}
