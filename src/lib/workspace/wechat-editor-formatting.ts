export type WechatHeadingSize = "md" | "lg" | "xl";
export type WechatHeadingColor = "slate" | "amber" | "emerald" | "rose";

export type WechatHeadingStyle = {
  size?: WechatHeadingSize;
  color?: WechatHeadingColor;
  bold?: boolean;
  underline?: boolean;
  center?: boolean;
};

export type WechatInlineSegment = {
  text: string;
  bold?: boolean;
  underline?: boolean;
};

const HEADING_STYLE_PREFIX = "{{h:";
const HEADING_STYLE_SUFFIX = "}}";

const VALID_SIZES = new Set<WechatHeadingSize>(["md", "lg", "xl"]);
const VALID_COLORS = new Set<WechatHeadingColor>([
  "slate",
  "amber",
  "emerald",
  "rose",
]);

export function formatWechatHeadingStyleMarker(
  style: WechatHeadingStyle | null | undefined,
): string {
  if (!style) {
    return "";
  }

  const parts: string[] = [];

  if (style.size && VALID_SIZES.has(style.size)) {
    parts.push(`size=${style.size}`);
  }

  if (style.color && VALID_COLORS.has(style.color)) {
    parts.push(`color=${style.color}`);
  }

  if (style.bold) {
    parts.push("bold");
  }

  if (style.underline) {
    parts.push("underline");
  }

  if (style.center) {
    parts.push("center");
  }

  return parts.length > 0
    ? `${HEADING_STYLE_PREFIX}${parts.join(";")}${HEADING_STYLE_SUFFIX}`
    : "";
}

export function parseWechatHeadingContent(content: string): {
  text: string;
  style: WechatHeadingStyle | null;
  marker: string | null;
} {
  const trimmed = content.trim();
  const markerStart = trimmed.lastIndexOf(` ${HEADING_STYLE_PREFIX}`);

  if (markerStart < 0) {
    return {
      text: trimmed,
      style: null,
      marker: null,
    };
  }

  const marker = trimmed.slice(markerStart + 1);
  const text = trimmed.slice(0, markerStart).trim();
  const style = parseWechatHeadingStyleMarker(marker);

  if (!style || text.length === 0) {
    return {
      text: trimmed,
      style: null,
      marker: null,
    };
  }

  return {
    text,
    style,
    marker,
  };
}

export function applyHeadingStyleToLine(
  line: string,
  patch: Partial<WechatHeadingStyle>,
): string {
  if (!line.startsWith("## ")) {
    return line;
  }

  const headingBody = line.slice(3);
  const parsed = parseWechatHeadingContent(headingBody);
  const baseText = parsed.text;
  const nextStyle = normalizeHeadingStyle({
    ...parsed.style,
    ...patch,
  });
  const marker = formatWechatHeadingStyleMarker(nextStyle);

  return marker.length > 0 ? `## ${baseText} ${marker}` : `## ${baseText}`;
}

export function wrapSelectionWithMarker(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  marker: "**" | "__",
): {
  text: string;
  selection: { start: number; end: number };
} {
  if (selectionStart === selectionEnd) {
    return {
      text,
      selection: {
        start: selectionStart,
        end: selectionEnd,
      },
    };
  }

  const selectedText = text.slice(selectionStart, selectionEnd);
  const nextText =
    text.slice(0, selectionStart) +
    marker +
    selectedText +
    marker +
    text.slice(selectionEnd);

  return {
    text: nextText,
    selection: {
      start: selectionStart + marker.length,
      end: selectionEnd + marker.length,
    },
  };
}

export function insertDividerAtCursor(
  text: string,
  cursorPosition: number,
): {
  text: string;
  selection: { start: number; end: number };
} {
  const before = text.slice(0, cursorPosition).replace(/\s+$/, "");
  const after = text.slice(cursorPosition).replace(/^\s+/, "");

  const segments = [before, "---", after].filter((segment) => segment.length > 0);
  const nextText = segments.join("\n\n");
  const dividerIndex = nextText.indexOf("---");

  return {
    text: nextText,
    selection: {
      start: dividerIndex,
      end: dividerIndex + 3,
    },
  };
}

export function getCurrentLineRange(text: string, cursorPosition: number): {
  start: number;
  end: number;
  line: string;
} {
  const safePosition = Math.min(Math.max(cursorPosition, 0), text.length);
  const start = text.lastIndexOf("\n", safePosition - 1) + 1;
  const nextBreak = text.indexOf("\n", safePosition);
  const end = nextBreak === -1 ? text.length : nextBreak;

  return {
    start,
    end,
    line: text.slice(start, end),
  };
}

export function replaceCurrentLine(
  text: string,
  cursorPosition: number,
  updater: (line: string) => string,
): {
  text: string;
  selection: { start: number; end: number };
} {
  const range = getCurrentLineRange(text, cursorPosition);
  const updatedLine = updater(range.line);
  const nextText = text.slice(0, range.start) + updatedLine + text.slice(range.end);
  const nextCursor = range.start + updatedLine.length;

  return {
    text: nextText,
    selection: {
      start: nextCursor,
      end: nextCursor,
    },
  };
}

export function insertHeadingAtCurrentLine(
  text: string,
  cursorPosition: number,
): {
  text: string;
  selection: { start: number; end: number };
} {
  return replaceCurrentLine(text, cursorPosition, (line) => {
    if (line.startsWith("## ")) {
      return line;
    }

    return `## ${line.trimStart()}`;
  });
}

export function tokenizeWechatInlineFormatting(text: string): WechatInlineSegment[] {
  const segments: WechatInlineSegment[] = [];
  let index = 0;

  while (index < text.length) {
    const marker = text.startsWith("**", index)
      ? "**"
      : text.startsWith("__", index)
        ? "__"
        : null;

    if (!marker) {
      const nextMarkerIndex = findNextInlineMarker(text, index);
      segments.push({
        text: text.slice(index, nextMarkerIndex === -1 ? text.length : nextMarkerIndex),
      });
      index = nextMarkerIndex === -1 ? text.length : nextMarkerIndex;
      continue;
    }

    const end = text.indexOf(marker, index + marker.length);
    const content =
      end === -1 ? "" : text.slice(index + marker.length, end);

    if (
      end !== -1 &&
      content.length > 0 &&
      !content.includes("**") &&
      !content.includes("__")
    ) {
      segments.push({
        text: content,
        bold: marker === "**" || undefined,
        underline: marker === "__" || undefined,
      });
      index = end + marker.length;
      continue;
    }

    if (end !== -1) {
      segments.push({
        text: text.slice(index, end + marker.length),
      });
      index = end + marker.length;
      continue;
    }

    segments.push({
      text: marker,
    });
    index += marker.length;
  }

  return segments;
}

function parseWechatHeadingStyleMarker(
  marker: string,
): WechatHeadingStyle | null {
  if (
    !marker.startsWith(HEADING_STYLE_PREFIX) ||
    !marker.endsWith(HEADING_STYLE_SUFFIX)
  ) {
    return null;
  }

  const body = marker.slice(
    HEADING_STYLE_PREFIX.length,
    marker.length - HEADING_STYLE_SUFFIX.length,
  );

  if (body.length === 0) {
    return null;
  }

  const style: WechatHeadingStyle = {};
  const seenKeys = new Set<string>();

  for (const part of body.split(";")) {
    if (part === "bold" || part === "underline" || part === "center") {
      if (seenKeys.has(part)) {
        return null;
      }
      seenKeys.add(part);
      style[part] = true;
      continue;
    }

    const [key, value] = part.split("=");

    if (!key || !value || seenKeys.has(key)) {
      return null;
    }

    if (key === "size" && VALID_SIZES.has(value as WechatHeadingSize)) {
      seenKeys.add(key);
      style.size = value as WechatHeadingSize;
      continue;
    }

    if (key === "color" && VALID_COLORS.has(value as WechatHeadingColor)) {
      seenKeys.add(key);
      style.color = value as WechatHeadingColor;
      continue;
    }

    return null;
  }

  return style;
}

function normalizeHeadingStyle(
  style: Partial<WechatHeadingStyle>,
): WechatHeadingStyle {
  const normalized: WechatHeadingStyle = {};

  if (style.size && VALID_SIZES.has(style.size)) {
    normalized.size = style.size;
  }

  if (style.color && VALID_COLORS.has(style.color)) {
    normalized.color = style.color;
  }

  if (style.bold) {
    normalized.bold = true;
  }

  if (style.underline) {
    normalized.underline = true;
  }

  if (style.center) {
    normalized.center = true;
  }

  return normalized;
}

function findNextInlineMarker(text: string, fromIndex: number): number {
  const nextBold = text.indexOf("**", fromIndex);
  const nextUnderline = text.indexOf("__", fromIndex);

  if (nextBold === -1) {
    return nextUnderline;
  }

  if (nextUnderline === -1) {
    return nextBold;
  }

  return Math.min(nextBold, nextUnderline);
}
