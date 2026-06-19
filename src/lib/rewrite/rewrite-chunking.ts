import { normalizeRewriteText } from "./rewrite-source.ts";

export type RewriteSourceRoleHint =
  | "intro"
  | "body"
  | "transition"
  | "conclusion";

export type RewriteChunk = {
  index: number;
  heading?: string;
  text: string;
  charCount: number;
  paragraphCount: number;
  paragraphGroups: number;
  sourceRoleHint: RewriteSourceRoleHint;
};

type ChunkingOptions = {
  targetChars?: number;
  softMaxChars?: number;
  hardMaxChars?: number;
};

type ParsedBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "separator" };

type ParagraphGroup = {
  heading?: string;
  paragraphs: string[];
};

const DEFAULT_TARGET_CHARS = 1_000;
const DEFAULT_SOFT_MAX_CHARS = 1_400;
const DEFAULT_HARD_MAX_CHARS = 2_200;

export function countParagraphGroups(text: string) {
  const blocks = parseBlocks(text);
  let count = 0;
  let inParagraphGroup = false;

  for (const block of blocks) {
    if (block.type === "paragraph") {
      if (!inParagraphGroup) {
        count += 1;
        inParagraphGroup = true;
      }
      continue;
    }

    inParagraphGroup = false;
  }

  return count;
}

export function chunkRewriteSourceText(
  text: string,
  options: ChunkingOptions = {},
) {
  const targetChars = options.targetChars ?? DEFAULT_TARGET_CHARS;
  const softMaxChars = options.softMaxChars ?? DEFAULT_SOFT_MAX_CHARS;
  const hardMaxChars = options.hardMaxChars ?? DEFAULT_HARD_MAX_CHARS;
  const groups = buildParagraphGroups(text);
  const chunks: Array<Omit<RewriteChunk, "index" | "sourceRoleHint">> = [];
  let currentGroups: ParagraphGroup[] = [];

  for (const group of groups) {
    const splitGroups = splitOversizedGroup(group, hardMaxChars);

    for (const candidateGroup of splitGroups) {
      const currentLength = getGroupsCharCount(currentGroups);
      const candidateLength = getGroupsCharCount([candidateGroup]);

      if (
        currentGroups.length > 0 &&
        (currentLength + candidateLength > softMaxChars ||
          currentLength >= targetChars)
      ) {
        chunks.push(buildChunk(currentGroups));
        currentGroups = [];
      }

      currentGroups.push(candidateGroup);
    }
  }

  if (currentGroups.length > 0) {
    chunks.push(buildChunk(currentGroups));
  }

  return chunks.map((chunk, index, allChunks) => ({
    ...chunk,
    index,
    sourceRoleHint: inferSourceRoleHint(chunk, index, allChunks.length),
  }));
}

function buildParagraphGroups(text: string) {
  const blocks = parseBlocks(text);
  const groups: ParagraphGroup[] = [];
  let current: ParagraphGroup | null = null;
  let pendingHeading: string | undefined;

  for (const block of blocks) {
    if (block.type === "separator") {
      if (current && current.paragraphs.length > 0) {
        groups.push(current);
      }
      current = null;
      pendingHeading = undefined;
      continue;
    }

    if (block.type === "heading") {
      if (current && current.paragraphs.length > 0) {
        groups.push(current);
      }
      current = null;
      pendingHeading = block.text;
      continue;
    }

    if (!current) {
      current = {
        ...(pendingHeading ? { heading: pendingHeading } : {}),
        paragraphs: [],
      };
      pendingHeading = undefined;
    }

    current.paragraphs.push(block.text);
  }

  if (current && current.paragraphs.length > 0) {
    groups.push(current);
  }

  return groups;
}

function parseBlocks(text: string): ParsedBlock[] {
  const normalized = normalizeRewriteText(text);

  if (!normalized) {
    return [];
  }

  return normalized
    .split("\n\n")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment): ParsedBlock => {
      if (isExplicitSeparator(segment)) {
        return { type: "separator" };
      }

      if (isHeading(segment)) {
        return { type: "heading", text: segment };
      }

      return { type: "paragraph", text: segment };
    });
}

function isExplicitSeparator(text: string) {
  return /^(---+|——+|\*\*\*+)$/.test(text.trim());
}

function isHeading(text: string) {
  const singleLine = !text.includes("\n");
  const trimmed = text.trim();

  return (
    singleLine &&
    trimmed.length <= 60 &&
    (/^#{1,6}\s+/.test(trimmed) ||
      /^第[一二三四五六七八九十百千0-9]+[章节部分篇]/.test(trimmed) ||
      /^[一二三四五六七八九十]+[、.．]/.test(trimmed) ||
      /^[0-9]+[、.．]/.test(trimmed) ||
      /^（[一二三四五六七八九十0-9]+）/.test(trimmed))
  );
}

function splitOversizedGroup(group: ParagraphGroup, hardMaxChars: number) {
  const parts: ParagraphGroup[] = [];
  let currentParagraphs: string[] = [];
  let currentLength = group.heading ? group.heading.length + 2 : 0;

  for (const paragraph of group.paragraphs) {
    const paragraphLength = paragraph.length + (currentParagraphs.length > 0 ? 2 : 0);

    if (
      currentParagraphs.length > 0 &&
      currentLength + paragraphLength > hardMaxChars
    ) {
      parts.push({
        ...(group.heading && parts.length === 0 ? { heading: group.heading } : {}),
        paragraphs: currentParagraphs,
      });
      currentParagraphs = [];
      currentLength = 0;
    }

    if (paragraph.length > hardMaxChars) {
      const splitParagraphs = splitLongParagraph(paragraph, hardMaxChars);
      for (const splitParagraph of splitParagraphs) {
        if (currentParagraphs.length > 0) {
          parts.push({
            ...(group.heading && parts.length === 0 ? { heading: group.heading } : {}),
            paragraphs: currentParagraphs,
          });
          currentParagraphs = [];
        }

        parts.push({
          ...(group.heading && parts.length === 0 ? { heading: group.heading } : {}),
          paragraphs: [splitParagraph],
        });
      }
      currentLength = 0;
      continue;
    }

    currentParagraphs.push(paragraph);
    currentLength += paragraphLength;
  }

  if (currentParagraphs.length > 0) {
    parts.push({
      ...(group.heading && parts.length === 0 ? { heading: group.heading } : {}),
      paragraphs: currentParagraphs,
    });
  }

  return parts.length > 0 ? parts : [group];
}

function splitLongParagraph(paragraph: string, hardMaxChars: number) {
  const slices: string[] = [];
  let offset = 0;

  while (offset < paragraph.length) {
    slices.push(paragraph.slice(offset, offset + hardMaxChars).trim());
    offset += hardMaxChars;
  }

  return slices.filter(Boolean);
}

function buildChunk(groups: ParagraphGroup[]): Omit<RewriteChunk, "index" | "sourceRoleHint"> {
  const heading = groups.find((group) => group.heading)?.heading;
  const paragraphs = groups.flatMap((group) => group.paragraphs);
  const text = [
    ...(heading ? [heading] : []),
    ...paragraphs,
  ].join("\n\n");

  return {
    ...(heading ? { heading } : {}),
    text,
    charCount: text.length,
    paragraphCount: paragraphs.length,
    paragraphGroups: groups.length,
  };
}

function getGroupsCharCount(groups: ParagraphGroup[]) {
  return buildChunk(groups).charCount;
}

function inferSourceRoleHint(
  chunk: Omit<RewriteChunk, "index" | "sourceRoleHint">,
  index: number,
  totalChunks: number,
): RewriteSourceRoleHint {
  const sample = [chunk.heading, chunk.text].filter(Boolean).join("\n").toLowerCase();

  if (index === 0) {
    return "intro";
  }

  if (
    index === totalChunks - 1 ||
    /最后|总结|结尾|收束|结论|总之|回到一开始/.test(sample)
  ) {
    return "conclusion";
  }

  if (
    /接下来|然后|再看|进一步|另一方面|换个角度|继续说|下一步/.test(sample)
  ) {
    return "transition";
  }

  return "body";
}
