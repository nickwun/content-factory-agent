import type { XiaohongshuContent } from "../types/history.ts";

export type RawXiaohongshuOutput = {
  title?: unknown;
  caption?: unknown;
  imageSuggestions?: unknown;
  tags?: unknown;
};

export type XiaohongshuNormalizeOptions = {
  preserveLongformCaption?: boolean;
};

type RawImageSuggestion = {
  title?: unknown;
  description?: unknown;
};

const DEFAULT_TITLE = "未命名小红书草稿";
const DEFAULT_CAPTION_PLACEHOLDER =
  "这是一篇新生成的小红书草稿，请继续补充你的真实经验和表达。";
const DEFAULT_IMAGE_TITLE = "配图建议";
const DEFAULT_IMAGE_DESCRIPTION =
  "展示与主题相关的真实生活或工作场景，帮助笔记更有代入感。";
const MIN_IMAGE_SUGGESTIONS = 3;
const MAX_IMAGE_SUGGESTIONS = 9;
const MAX_CAPTION_LENGTH = 220;
const MAX_LONGFORM_CAPTION_LENGTH = 1_200;
const MAX_TAGS = 8;

export function normalizeXiaohongshuOutput(
  raw: unknown,
  options: XiaohongshuNormalizeOptions = {},
): XiaohongshuContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid xiaohongshu output");
  }

  const source = raw as RawXiaohongshuOutput;
  const imageSuggestions = normalizeImageSuggestions(source.imageSuggestions);
  const caption = normalizeCaption(source.caption, options);

  return {
    platform: "xiaohongshu",
    title:
      typeof source.title === "string" && source.title.trim()
        ? source.title.trim()
        : DEFAULT_TITLE,
    caption,
    imageSuggestions:
      imageSuggestions.length > 0
        ? ensureMinimumImageSuggestions(imageSuggestions)
        : createFallbackImageSuggestions(),
    tags: normalizeTags(source.tags),
  };
}

export function assertMeaningfulXiaohongshuContent(content: XiaohongshuContent) {
  const meaningfulTitle =
    content.title.trim() && content.title.trim() !== DEFAULT_TITLE;
  const meaningfulCaption =
    content.caption.trim() &&
    content.caption.trim() !== DEFAULT_CAPTION_PLACEHOLDER;
  const meaningfulImageSuggestions = content.imageSuggestions.some(
    (image) =>
      !image.title.trim().startsWith(DEFAULT_IMAGE_TITLE) ||
      image.description.trim() !== DEFAULT_IMAGE_DESCRIPTION,
  );
  const meaningfulTags = content.tags.length > 0;

  if (
    !meaningfulTitle &&
    !meaningfulCaption &&
    !meaningfulImageSuggestions &&
    !meaningfulTags
  ) {
    throw new Error(
      "Generated xiaohongshu content did not contain meaningful content",
    );
  }
}

export function extractXiaohongshuJsonPayload(rawText: string) {
  const text = rawText.trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const jsonText = findFirstJsonObject(candidate);

  if (!jsonText) {
    throw new Error("Invalid xiaohongshu output");
  }

  return JSON.parse(jsonText);
}

function normalizeCaption(
  rawCaption: unknown,
  options: XiaohongshuNormalizeOptions,
) {
  const raw = typeof rawCaption === "string" ? rawCaption : "";
  const normalized = options.preserveLongformCaption
    ? normalizeLongformCaption(raw)
    : raw.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return DEFAULT_CAPTION_PLACEHOLDER;
  }

  const maxLength = options.preserveLongformCaption
    ? MAX_LONGFORM_CAPTION_LENGTH
    : MAX_CAPTION_LENGTH;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function normalizeLongformCaption(raw: string) {
  return raw
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

function normalizeImageSuggestions(rawImageSuggestions: unknown) {
  if (!Array.isArray(rawImageSuggestions)) {
    return [];
  }

  return rawImageSuggestions
    .map((image) => normalizeImageSuggestion(image))
    .filter(
      (
        image,
      ): image is {
        title: string;
        description: string;
      } => image !== null,
    )
    .slice(0, MAX_IMAGE_SUGGESTIONS)
    .map((image, index) => ({
      id: crypto.randomUUID(),
      index: index + 1,
      title: image.title,
      description: image.description,
      status: "suggested" as const,
    }));
}

function normalizeImageSuggestion(rawImage: unknown) {
  if (!rawImage || typeof rawImage !== "object" || Array.isArray(rawImage)) {
    return null;
  }

  const source = rawImage as RawImageSuggestion;
  const title =
    typeof source.title === "string" ? source.title.trim() : "";
  const description =
    typeof source.description === "string" ? source.description.trim() : "";

  if (!title && !description) {
    return null;
  }

  return {
    title: title || DEFAULT_IMAGE_TITLE,
    description: description || DEFAULT_IMAGE_DESCRIPTION,
  };
}

function ensureMinimumImageSuggestions(
  images: Array<{
    id: string;
    index: number;
    title: string;
    description: string;
    status: "suggested";
  }>,
) {
  if (images.length >= MIN_IMAGE_SUGGESTIONS) {
    return images;
  }

  const fallbackImages = createFallbackImageSuggestions();

  return images
    .concat(fallbackImages.slice(images.length, MIN_IMAGE_SUGGESTIONS))
    .map((image, index) => ({
      ...image,
      index: index + 1,
    }));
}

function createFallbackImageSuggestions() {
  return Array.from({ length: MIN_IMAGE_SUGGESTIONS }, (_, index) => ({
    id: crypto.randomUUID(),
    index: index + 1,
    title: `${DEFAULT_IMAGE_TITLE} ${index + 1}`,
    description: DEFAULT_IMAGE_DESCRIPTION,
    status: "suggested" as const,
  }));
}

function normalizeTags(rawTags: unknown) {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return Array.from(
    new Set(
      rawTags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.replace(/#/g, "").trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_TAGS);
}

function findFirstJsonObject(text: string) {
  const startIndex = text.indexOf("{");

  if (startIndex === -1) {
    return null;
  }

  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}
