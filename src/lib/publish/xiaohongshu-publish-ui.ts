import type { HistoryRecord } from "../types/history.ts";
import type { XiaohongshuPublishSnapshot } from "./types.ts";

export function createXiaohongshuPublishSnapshot(
  record: HistoryRecord,
): XiaohongshuPublishSnapshot {
  const note = record.content.xiaohongshu;

  if (!note) {
    throw new Error("Missing xiaohongshu content");
  }

  const images = note.imageSuggestions
    .filter((image) => image.status === "generated" && image.imageUrl)
    .sort((a, b) => a.index - b.index)
    .map((image, index) => ({
      url: image.imageUrl ?? "",
      index: image.index,
      isCover: index === 0,
      source: "generated_image" as const,
    }));

  return {
    schemaVersion: "v1",
    platform: "xiaohongshu",
    recordId: record.id,
    title: note.title,
    caption: note.caption,
    tags: note.tags,
    images,
  };
}

export function buildXiaohongshuPublishPreviewChecks(record: HistoryRecord) {
  const note = record.content.xiaohongshu;
  const generatedImages =
    note?.imageSuggestions.filter(
      (image) => image.status === "generated" && image.imageUrl,
    ) ?? [];

  const items = [
    {
      id: "title_or_caption_exists",
      label: "标题或正文存在",
      passed: Boolean(note && (note.title.trim() || note.caption.trim())),
    },
    {
      id: "generated_images_exists",
      label: "至少 1 张已生成图片",
      passed: generatedImages.length > 0,
    },
  ];

  return {
    ready: items.every((item) => item.passed),
    items,
  };
}
