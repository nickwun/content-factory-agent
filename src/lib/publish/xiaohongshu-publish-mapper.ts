import type {
  XiaohongshuPublishPayload,
  XiaohongshuPublishSnapshot,
} from "./types.ts";
import { PublishServiceError } from "./publish-errors.ts";

export function mapXiaohongshuSnapshotToPayload(
  snapshot: XiaohongshuPublishSnapshot,
  baseOrigin: string,
): XiaohongshuPublishPayload {
  const sortedImages = [...snapshot.images]
    .sort((a, b) => a.index - b.index)
    .map((image) => ({
      ...image,
      url: resolveAbsoluteImageUrl(image.url, baseOrigin),
    }));
  const coverImage = sortedImages[0];
  const bodyImages = sortedImages.slice(1);

  return {
    title: snapshot.title.trim(),
    plainText: normalizePlainText(snapshot.caption),
    coverImageUrl: coverImage?.url ?? "",
    bodyImageUrls: bodyImages.map((image) => image.url),
    tags: snapshot.tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean),
  };
}

export function renderXiaohongshuTags(tags: string[]) {
  return tags.map((tag) => `#${tag.replace(/^#/, "").trim()}`).join(" ");
}

export function normalizePlainText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildXiaohongshuPublishContent(payload: XiaohongshuPublishPayload) {
  const tagsText = renderXiaohongshuTags(payload.tags);

  if (!tagsText) {
    return payload.plainText;
  }

  if (!payload.plainText) {
    return tagsText;
  }

  return `${payload.plainText}\n\n${tagsText}`;
}

export function resolveAbsoluteImageUrl(url: string, baseOrigin: string) {
  try {
    return new URL(url, baseOrigin).toString();
  } catch {
    throw new PublishServiceError(
      "invalid_image_url",
      "小红书图片地址无法转换为可发布的绝对地址。",
      400,
    );
  }
}
